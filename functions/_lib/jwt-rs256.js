/* jwt-rs256.js — RSA-2048 / RS256 JWT 서명·검증 + JWKS 직렬화
 * 원본: E:\code-project\auth\functions\_lib\jwt-rs256.js
 * 의존성: Web Crypto API만 사용 (Cloudflare Pages Functions 호환)
 * 보안.html 스펙: Access 15min, Refresh 24h, 90일 키 로테이션
 *
 * 키 저장 방식:
 *   env.JWT_PRIVATE_KEY_PEM  ← Cloudflare Pages Secret (PEM PKCS8)
 *   env.JWT_PUBLIC_KEY_PEM   ← Cloudflare Pages Secret (PEM SPKI)
 *   env.JWT_KID              ← 키 식별자 (예: "k-2026-05-20")
 *
 * 신규 키 생성:
 *   node scripts/gen-rsa-key.mjs
 *   → 출력된 PEM 두 개를 wrangler pages secret put 으로 등록
 */

// ───────────────────────────────────────────────────────
// Base64URL 헬퍼
// ───────────────────────────────────────────────────────
const b64url = (buf) => {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64urlDecode = (str) => {
  const pad = str.length % 4 ? 4 - (str.length % 4) : 0;
  const base64 = (str + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

// ───────────────────────────────────────────────────────
// PEM → CryptoKey
// ───────────────────────────────────────────────────────
function pemToDer(pem) {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return b64urlDecode(body.replace(/\+/g, '-').replace(/\//g, '_'));
}

const keyCache = new Map();

export async function importPrivateKey(pem) {
  const cached = keyCache.get('priv:' + pem.length);
  if (cached) return cached;
  const der = pemToDer(pem);
  const key = await crypto.subtle.importKey(
    'pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true, ['sign']
  );
  keyCache.set('priv:' + pem.length, key);
  return key;
}

export async function importPublicKey(pem) {
  const cached = keyCache.get('pub:' + pem.length);
  if (cached) return cached;
  const der = pemToDer(pem);
  const key = await crypto.subtle.importKey(
    'spki', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true, ['verify']
  );
  keyCache.set('pub:' + pem.length, key);
  return key;
}

// ───────────────────────────────────────────────────────
// JWT RS256 서명
// ───────────────────────────────────────────────────────
/**
 * @param {object} payload — claims
 * @param {string} privatePem — PKCS8 PEM
 * @param {object} opts — { kid, ttlSec, iss, aud }
 */
export async function jwtSignRS256(payload, privatePem, opts = {}) {
  const { kid = 'k0', ttlSec = 900, iss = 'auth-hub', aud } = opts;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const body = {
    iss,
    ...(aud ? { aud } : {}),
    iat: now,
    nbf: now,
    exp: now + ttlSec,
    jti: crypto.randomUUID(),
    ...payload,
  };
  const h = b64url(enc(JSON.stringify(header)));
  const p = b64url(enc(JSON.stringify(body)));
  const msg = `${h}.${p}`;
  const key = await importPrivateKey(privatePem);
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' }, key, enc(msg)
  );
  return `${msg}.${b64url(sig)}`;
}

// ───────────────────────────────────────────────────────
// JWT RS256 검증
// ───────────────────────────────────────────────────────
/**
 * @param {string} token
 * @param {string} publicPem
 * @param {object} opts — { iss, aud, clockSkewSec }
 * @returns {Promise<object|null>} payload or null
 */
export async function jwtVerifyRS256(token, publicPem, opts = {}) {
  try {
    const { iss, aud, clockSkewSec = 5 } = opts;
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;

    const header = JSON.parse(dec(b64urlDecode(h)));
    if (header.alg !== 'RS256') return null;

    const key = await importPublicKey(publicPem);
    const ok = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' }, key,
      b64urlDecode(s), enc(`${h}.${p}`)
    );
    if (!ok) return null;

    const payload = JSON.parse(dec(b64urlDecode(p)));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp + clockSkewSec < now) return null;
    if (payload.nbf && payload.nbf - clockSkewSec > now) return null;
    if (iss && payload.iss !== iss) return null;
    if (aud) {
      const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!auds.includes(aud)) return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────
// JWKS — 공개키를 JWK 포맷으로 직렬화
// ───────────────────────────────────────────────────────
/**
 * 공개키 PEM → JWK { kty, n, e, alg, use, kid }
 * 다른 프로젝트는 이 JWKS만 읽어서 토큰 검증 가능
 */
export async function publicPemToJwk(publicPem, kid = 'k0') {
  const key = await importPublicKey(publicPem);
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    alg: 'RS256',
    use: 'sig',
    kid,
  };
}

/**
 * JWKS 빌드 — 여러 키 동시 노출 (롤오버용)
 * @param {Array<{pem:string, kid:string}>} keys
 */
export async function buildJwks(keys) {
  const list = await Promise.all(keys.map(k => publicPemToJwk(k.pem, k.kid)));
  return { keys: list };
}

// ───────────────────────────────────────────────────────
// JWK → CryptoKey (JWKS 검증용, 외부 프로젝트에서 사용)
// ───────────────────────────────────────────────────────
export async function jwkToPublicKey(jwk) {
  return crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true, ['verify']
  );
}

/**
 * JWKS URL 기반 검증 — 외부 프로젝트 SDK용
 * @param {string} token
 * @param {string} jwksUrl - https://auth-hub.pages.dev/.well-known/jwks.json
 * @param {object} opts - { iss, aud, cacheStore }
 */
export async function jwtVerifyWithJwks(token, jwksUrl, opts = {}) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;

    const header = JSON.parse(dec(b64urlDecode(h)));
    if (header.alg !== 'RS256') return null;

    const jwks = await fetchJwksCached(jwksUrl, opts.cacheStore);
    const jwk = jwks.keys.find(k => k.kid === header.kid) || jwks.keys[0];
    if (!jwk) return null;

    const key = await jwkToPublicKey(jwk);
    const ok = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' }, key,
      b64urlDecode(s), enc(`${h}.${p}`)
    );
    if (!ok) return null;

    const payload = JSON.parse(dec(b64urlDecode(p)));
    const now = Math.floor(Date.now() / 1000);
    const skew = opts.clockSkewSec ?? 5;
    if (payload.exp && payload.exp + skew < now) return null;
    if (opts.iss && payload.iss !== opts.iss) return null;
    if (opts.aud) {
      const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!auds.includes(opts.aud)) return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// JWKS 캐싱 (1시간) — KV 또는 in-memory
const jwksMemCache = new Map();
async function fetchJwksCached(url, kv) {
  const now = Date.now();
  if (kv) {
    const cached = await kv.get('jwks:' + url, 'json');
    if (cached && cached.expiresAt > now) return cached.data;
  } else {
    const cached = jwksMemCache.get(url);
    if (cached && cached.expiresAt > now) return cached.data;
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('JWKS fetch failed');
  const data = await resp.json();
  const entry = { data, expiresAt: now + 3600_000 };
  if (kv) await kv.put('jwks:' + url, JSON.stringify(entry), { expirationTtl: 3600 });
  else jwksMemCache.set(url, entry);
  return data;
}
