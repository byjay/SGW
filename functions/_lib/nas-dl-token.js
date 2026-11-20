// nas-dl-token.js — 다운로드 단기 서명 토큰(HMAC-SHA256, JWT_SECRET).
// downloadlink가 발급, download가 자체검증(Bearer 없이). path+exp를 서명해 위변조·재사용 창을 60초로 제한.

export const TOKEN_TTL = 60; // 초

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
}

// 서명 대상 문자열은 **모호하지 않아야** 한다.
// `${path}:${exp}` 는 path 안에 ':' 가 들어가면 (path, exp) 분해가 유일하지 않다
// → 길이 접두어를 붙여 (path, exp) 쌍 하나만 대응되도록 고정한다.
const canonical = (path, exp) => `v1:${String(path).length}:${path}:${exp}`;

export async function signPathToken(secret, path, exp) {
  return hmac(secret, canonical(path, exp));
}

// 상수시간 비교(타이밍 누수 최소화).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifyPathToken(secret, path, exp, token) {
  const now = Math.floor(Date.now() / 1000);
  if (!exp || exp < now) return false;
  const expected = await signPathToken(secret, path, exp);
  return safeEqual(token, expected);
}
