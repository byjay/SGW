// POST /api/auth/login  {email, password}
//  → sgw_users 조회 + PBKDF2 검증 → 성공 시 HS256 JWT 발급(env.JWT_SECRET).
//  → Set-Cookie: at=<jwt> (HttpOnly/Secure/SameSite=Lax, 7d) + body {ok,token,user,passwordChanged}.
//  실패 401. 무인증 화이트리스트(_middleware.js)라 이 라우트만 토큰 없이 접근 가능.
import { json } from '../../_lib/social-auth.js';
import { verifyPassword } from '../../_lib/password.js';
import { checkLoginRateLimit } from '../../_lib/rate-limit.js';
import { sessionResponse } from '../../_lib/session.js';

// 인증 응답은 캐시 금지(토큰·프로필·존재여부 포함).
const NO_STORE = { 'Cache-Control': 'no-store' };
// 계정 열거 방지용 더미 해시(실제 계정 아님 — 비교 비용을 맞추기 위한 상수).
const DUMMY_HASH =
  'pbkdf2$100000$LiNTpQ2qnbLTSUUeBgl2iA==$CrY6poCCtxb1JUfl4FO0aMO8rA47SqC1hmnRLnwHRGE=';

export async function onRequestPost({ request, env }) {
  try {
    if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, { status: 500 });
    if (!env.JWT_SECRET) return json({ ok: false, error: 'no_secret' }, { status: 500 });

    // 무차별 대입 방어: IP당 10회/분. (ponytail: RATE_KV 바인딩 없으면 무해한 no-op)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await checkLoginRateLimit(env, ip);
    if (!rl.ok) {
      return json(
        { ok: false, error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, rl.resetAt - Math.floor(Date.now() / 1000))) } }
      );
    }

    let body;
    try { body = await request.json(); } catch { body = null; }
    const email = (body && body.email ? String(body.email) : '').trim().toLowerCase();
    const password = body && body.password != null ? String(body.password) : '';
    if (!email || !password) {
      return json({ ok: false, error: 'missing_credentials' }, { status: 400 });
    }

    const row = await env.DB.prepare(
      'SELECT id, name, email, role, department, position, password_hash FROM sgw_users WHERE lower(email) = ?'
    ).bind(email).first();

    if (!row || !row.password_hash) {
      // 계정 열거 방지: 미존재 계정도 동일한 PBKDF2 비용을 치른다.
      // (즉시 401을 내면 응답시간 차이로 "이 이메일은 존재한다"가 새어나간다)
      await verifyPassword(password, DUMMY_HASH);
      return json({ ok: false, error: 'invalid_credentials' }, { status: 401, headers: NO_STORE });
    }
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return json({ ok: false, error: 'invalid_credentials' }, { status: 401, headers: NO_STORE });
    }

    // 초기 비번('1') 그대로면 강제변경 유도 플래그.
    const passwordChanged = !(await verifyPassword('1', row.password_hash));

    // 세션 발급은 _lib/session.js 단일 경로(구글 로그인과 동일한 JWT·쿠키·no-store).
    return sessionResponse(env, row, { passwordChanged });
  } catch {
    return json({ ok: false, error: 'login_failed' }, { status: 500 });
  }
}
