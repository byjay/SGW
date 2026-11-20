/* password.js — PBKDF2-HMAC-SHA256 비밀번호 해시/검증 (WebCrypto, npm 0)
 * 저장 포맷: pbkdf2$<iterations>$<saltBase64>$<hashBase64>
 * Node crypto.pbkdf2Sync(pw, salt, iter, 32, 'sha256') 와 동일 출력(시드 SQL은 Node로 계산).
 */

const ITER = 100000;
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password, salt, iter = ITER) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    key, 256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(String(password), salt);
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, iterStr, saltB64, hashB64] = String(stored).split('$');
    if (scheme !== 'pbkdf2' || !saltB64 || !hashB64) return false;
    const iter = Number(iterStr) || ITER;
    const salt = unb64(saltB64);
    const expected = unb64(hashB64);
    const actual = await pbkdf2(String(password), salt, iter);
    if (actual.length !== expected.length) return false;
    // 상수시간 비교(타이밍 누설 최소화)
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
