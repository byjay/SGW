// POST /api/auth/google/login  {idToken, userId?}   ← 무인증(미들웨어 화이트리스트)
//
// 구글 ID 토큰을 서버 검증하고, 그 결과로 sgw_users 행을 확보한 뒤 **status='active'** 인
// 계정에만 세션을 발급한다. 이름은 어떤 경우에도 인증 수단이 아니다(계정 선택기일 뿐).
//
// 가입/로그인 경로 3종:
//   A 자동(JIT)      : 이메일 도메인이 회사 도메인(env.ALLOWED_EMAIL_DOMAIN, 기본 seastargo.com)
//                      → 첫 로그인에 명단 자동 등재 + 이름 자동 기입 + 최소 권한('user') + 즉시 active
//   B 사전 허용(초대) : 관리자가 sgw_invites 에 등록한 이메일 → 즉시 active + 지정 역할/부서
//   C 가입 신청       : 위 둘 다 아님 → status='pending' 으로 생성만 하고 **403 approval_pending**
//
// 이름 기반 간편 로그인 흐름:
//   POST /api/auth/lookup(이름) → 후보 선택(userId) → 구글 로그인(ID 토큰) → 여기서 신원 증명 → 세션.
//   userId 가 오면 토큰 주인과 일치할 때만 발급 → 동명이인 오선택/사칭 차단.
import { json } from '../../../_lib/social-auth.js';
import { verifyGoogleIdToken, isAllowedDomain } from '../../../_lib/google-idtoken.js';
import { checkLoginRateLimit } from '../../../_lib/rate-limit.js';
import { sessionResponse, isActiveAccount } from '../../../_lib/session.js';
import { resolveGoogleUser } from '../../../_lib/google-provision.js';
import { writeAudit } from '../../../_lib/audit.js';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function onRequestPost({ request, env }) {
  try {
    if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, { status: 500, headers: NO_STORE });
    // fail-closed: 시크릿 없으면 세션을 서명하지 않는다(공개 기본값 서명 = 위조 가능).
    if (!env.JWT_SECRET) return json({ ok: false, error: 'no_secret' }, { status: 500, headers: NO_STORE });

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await checkLoginRateLimit(env, ip);
    if (!rl.ok) {
      return json({ ok: false, error: 'rate_limited' }, {
        status: 429,
        headers: { ...NO_STORE, 'Retry-After': String(Math.max(1, rl.resetAt - Math.floor(Date.now() / 1000))) },
      });
    }

    let body;
    try { body = await request.json(); } catch { body = null; }
    const idToken = body && body.idToken ? String(body.idToken) : '';
    const userId = body && body.userId != null ? String(body.userId) : '';
    if (!idToken) return json({ ok: false, error: 'missing_id_token' }, { status: 400, headers: NO_STORE });

    // ── 신원 증명: 서명·iss·aud·exp·email_verified 전부 서버 검증 ──
    const v = await verifyGoogleIdToken(idToken, env);
    if (!v.ok) {
      const status = v.error === 'server_misconfigured' ? 500 : 401;
      return json({ ok: false, error: status === 500 ? v.error : 'invalid_id_token' }, { status, headers: NO_STORE });
    }
    const gSub = String(v.payload.sub);
    const gEmail = String(v.payload.email);
    const gName = String(v.payload.name || '').trim();
    const domainAllowed = isAllowedDomain(gEmail, env);

    // 행 확보(A/B/C 분기). 도메인 밖 + 초대 없음 → pending 생성(세션 없음).
    const res = await resolveGoogleUser(env, { gSub, gEmail, gName, ip, domainAllowed });
    if (!res.ok) {
      return json({ ok: false, error: res.error }, { status: res.status || 403, headers: NO_STORE });
    }
    const row = res.row;

    // 후보 선택 검증: 클라가 고른 userId 와 토큰 주인이 다르면 거부.
    if (userId && String(row.id) !== userId) {
      return json({ ok: false, error: 'account_mismatch' }, { status: 401, headers: NO_STORE });
    }

    // ── 승인 게이트(fail-closed 화이트리스트): active/approved 만 세션 ──
    if (!isActiveAccount(row)) {
      const st = String(row.status || '').toLowerCase();
      const pending = st === 'pending' || st === '';
      await writeAudit(env, {
        event: pending ? 'auth.google.pending' : 'auth.google.blocked',
        severity: 'WARN', sub: String(row.id), ip,
        meta: { email: gEmail, status: st, provider: 'google' },
      });
      return json(
        { ok: false, error: pending ? 'approval_pending' : 'account_disabled', status: st },
        { status: 403, headers: NO_STORE }
      );
    }

    return sessionResponse(env, row, { via: 'google', provisioned: !!res.created });
  } catch {
    return json({ ok: false, error: 'login_failed' }, { status: 500, headers: NO_STORE });
  }
}
