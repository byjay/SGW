/* social-auth.js — JWT HS256 + Cookie 유틸 (Web Crypto, no npm)
 * 원본: E:\code-project\auth\functions\_lib\social-auth.js
 * 재생성: /oauth-cf 스킬 실행
 * 수정 금지 — 이 파일을 수정하면 /oauth-cf 재실행 시 덮어써집니다
 */

// ── JWT HS256 ──────────────────────────────────────────
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const enc = (s) => new TextEncoder().encode(s);

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  );
}

export async function jwtSign(payload, secret, ttlSec = 604800) {
  const header = b64url(enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = b64url(enc(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  })));
  const msg = `${header}.${body}`;
  const key = await hmacKey(secret);
  const sig = b64url(await crypto.subtle.sign('HMAC', key, enc(msg)));
  return `${msg}.${sig}`;
}

export async function jwtVerify(token, secret) {
  try {
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const key   = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
      enc(`${h}.${b}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(atob(b.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ── Cookie 헬퍼 ───────────────────────────────────────
export function setAuthCookie(token, name = 'auth_sess', ttlSec = 604800) {
  return `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlSec}`;
}

export function clearAuthCookie(name = 'auth_sess') {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getCookie(req, name) {
  const m = (req.headers.get('cookie') || '')
    .match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? m[1] : null;
}

// ── requireAuth ────────────────────────────────────────
/**
 * 현재 요청의 JWT 쿠키를 검증하고 payload를 반환.
 * 미인증이면 null 반환.
 *
 * @example
 * const user = await requireAuth(request, env);
 * if (!user) return err(401, '로그인 필요');
 */
export async function requireAuth(request, env) {
  const cookieName = env.AUTH_COOKIE || 'auth_sess';
  const secret     = env.JWT_SECRET  || 'CHANGE_ME';
  const token      = getCookie(request, cookieName);
  if (!token) return null;
  return jwtVerify(token, secret);
}

// ── 공통 응답 헬퍼 ─────────────────────────────────────
export const json = (d, init = {}) =>
  new Response(JSON.stringify(d), {
    ...init,
    headers: { 'content-type': 'application/json;charset=utf-8', ...(init.headers || {}) },
  });
export const err      = (status, msg) => json({ ok: false, error: msg }, { status });
export const redirect = (url)         => Response.redirect(url, 302);
