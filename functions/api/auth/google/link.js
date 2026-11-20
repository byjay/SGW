// POST /api/auth/google/link  {idToken}   ← **인증 필요**(미들웨어 게이트, 화이트리스트 아님)
//   로그인된 상태에서 자신의 회사 구글 계정을 1회 연결한다.
//   연결 이후에는 이름 선택 + 구글 ID 토큰만으로 로그인 가능(POST /api/auth/google/login).
//
// 가드:
//   * 구글 ID 토큰 서버 검증(서명·iss·aud·exp·email_verified) — _lib/google-idtoken.js
//   * 회사 도메인(@seastargo.com) 강제
//   * 토큰의 email 이 **로그인된 본인 계정의 DB 이메일과 일치**해야 함
//     → 남의 구글 계정을 자기 계정에 붙이거나, 자기 구글 계정을 남 계정에 붙이는 경로 차단
//   * 이미 다른 직원에게 연결된 google_sub → 409
//   * 이미 다른 구글 계정에 연결된 내 계정 → 409 (재연결은 관리자 조치 필요)
import { json } from '../../../_lib/social-auth.js';
import { verifyGoogleIdToken, isAllowedDomain } from '../../../_lib/google-idtoken.js';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, { status: 500, headers: NO_STORE });

    const uid = data && data.user && data.user.sub ? String(data.user.sub) : '';
    if (!uid) return json({ ok: false, error: 'auth_required' }, { status: 401, headers: NO_STORE });

    let body;
    try { body = await request.json(); } catch { body = null; }
    const idToken = body && body.idToken ? String(body.idToken) : '';
    if (!idToken) return json({ ok: false, error: 'missing_id_token' }, { status: 400, headers: NO_STORE });

    const v = await verifyGoogleIdToken(idToken, env);
    if (!v.ok) {
      const status = v.error === 'server_misconfigured' ? 500 : 401;
      return json({ ok: false, error: v.error }, { status, headers: NO_STORE });
    }
    const gSub = String(v.payload.sub);
    const gEmail = String(v.payload.email);

    if (!isAllowedDomain(gEmail, env)) {
      return json({ ok: false, error: 'domain_not_allowed' }, { status: 403, headers: NO_STORE });
    }

    const me = await env.DB.prepare(
      'SELECT id, name, email, google_sub, google_email FROM sgw_users WHERE id = ?'
    ).bind(uid).first();
    if (!me) return json({ ok: false, error: 'user_not_found' }, { status: 404, headers: NO_STORE });

    // 본인 확인: 구글 계정 이메일 == 사내 계정 이메일.
    if (String(me.email || '').trim().toLowerCase() !== gEmail) {
      return json({ ok: false, error: 'email_mismatch' }, { status: 403, headers: NO_STORE });
    }

    // 이미 이 구글 계정이 다른 직원에게 연결돼 있으면 거부(UNIQUE 인덱스와 이중 방어).
    const owner = await env.DB.prepare(
      'SELECT id FROM sgw_users WHERE google_sub = ?'
    ).bind(gSub).first();
    if (owner && String(owner.id) !== uid) {
      return json({ ok: false, error: 'already_linked_other' }, { status: 409, headers: NO_STORE });
    }

    // 내 계정이 이미 **다른** 구글 계정에 묶여 있으면 조용히 갈아끼우지 않는다(계정 탈취 경로).
    if (me.google_sub && String(me.google_sub) !== gSub) {
      return json({ ok: false, error: 'already_linked_self' }, { status: 409, headers: NO_STORE });
    }

    const now = Date.now();
    await env.DB.prepare(
      'UPDATE sgw_users SET google_sub = ?, google_email = ?, google_linked_at = ? WHERE id = ?'
    ).bind(gSub, gEmail, now, uid).run();

    return json(
      { ok: true, linked: true, googleEmail: gEmail, linkedAt: now },
      { headers: NO_STORE }
    );
  } catch {
    return json({ ok: false, error: 'link_failed' }, { status: 500, headers: NO_STORE });
  }
}
