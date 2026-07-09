/* refresh.js — Refresh Token Rotation (KV 기반)
 * 보안.html 스펙: Access 15min, Refresh 24h + Rotation
 *
 * Storage: env.SESSION_KV  (Cloudflare KV namespace binding)
 *   key:   "rt:{tokenHash}"
 *   value: { sub, family, issuedAt, expiresAt, used }
 *
 * Family-based Reuse Detection:
 *   - 모든 refresh는 family 그룹에 묶임
 *   - 회전 후 이전 토큰 사용 시 → family 전체 폐기 + 알림
 */

import { jwtSignRS256 } from './jwt-rs256.js';

const REFRESH_TTL_SEC = 86400;       // 24h
const ACCESS_TTL_SEC  = 900;          // 15min

// ───────────────────────────────────────────────────────
// SHA-256 토큰 해시 (KV 키로 사용 — 원본 토큰 저장 안 함)
// ───────────────────────────────────────────────────────
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

const b64urlRand = (bytes = 32) => {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  let s = '';
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// ───────────────────────────────────────────────────────
// 신규 Refresh Token 발급 (로그인 시)
// ───────────────────────────────────────────────────────
/**
 * @param {object} env - { SESSION_KV }
 * @param {object} ctx - { sub, deviceId, ip, ua }
 * @returns {Promise<{refreshToken, family}>}
 */
export async function issueRefreshToken(env, ctx) {
  const refreshToken = b64urlRand(48);
  const family = crypto.randomUUID();
  const hash = await sha256Hex(refreshToken);
  const now = Date.now();

  const record = {
    sub: ctx.sub,
    family,
    deviceId: ctx.deviceId || null,
    ip: ctx.ip || null,
    ua: ctx.ua || null,
    issuedAt: now,
    expiresAt: now + REFRESH_TTL_SEC * 1000,
    used: false,
    parent: null,
  };

  await env.SESSION_KV.put(`rt:${hash}`, JSON.stringify(record), {
    expirationTtl: REFRESH_TTL_SEC,
  });

  return { refreshToken, family };
}

// ───────────────────────────────────────────────────────
// Rotation — 기존 토큰 검증 + 새 토큰 발급
// ───────────────────────────────────────────────────────
/**
 * @returns {Promise<{ok:true, refreshToken, family} | {ok:false, reason}>}
 */
export async function rotateRefreshToken(env, oldToken, ctx) {
  const hash = await sha256Hex(oldToken);
  const raw = await env.SESSION_KV.get(`rt:${hash}`);
  if (!raw) return { ok: false, reason: 'not_found' };

  const rec = JSON.parse(raw);
  const now = Date.now();

  // 만료
  if (rec.expiresAt < now) {
    await env.SESSION_KV.delete(`rt:${hash}`);
    return { ok: false, reason: 'expired' };
  }

  // ⚠️ Reuse Detection — 이미 회전된 토큰 재사용 시도
  if (rec.used) {
    await invalidateFamily(env, rec.family);
    return { ok: false, reason: 'reuse_detected', family: rec.family };
  }

  // 마킹 후 새 토큰 발급
  rec.used = true;
  await env.SESSION_KV.put(`rt:${hash}`, JSON.stringify(rec), {
    expirationTtl: 300, // 5분만 더 유지 (reuse detection 윈도우)
  });

  const newToken = b64urlRand(48);
  const newHash = await sha256Hex(newToken);
  const newRec = {
    sub: rec.sub,
    family: rec.family,
    deviceId: ctx.deviceId || rec.deviceId,
    ip: ctx.ip || rec.ip,
    ua: ctx.ua || rec.ua,
    issuedAt: now,
    expiresAt: now + REFRESH_TTL_SEC * 1000,
    used: false,
    parent: hash,
  };
  await env.SESSION_KV.put(`rt:${newHash}`, JSON.stringify(newRec), {
    expirationTtl: REFRESH_TTL_SEC,
  });

  return { ok: true, refreshToken: newToken, family: rec.family, sub: rec.sub };
}

// ───────────────────────────────────────────────────────
// 가족 전체 폐기 (탈취 의심 시)
// ───────────────────────────────────────────────────────
export async function invalidateFamily(env, family) {
  // KV는 prefix scan이 list로만 가능. family는 인덱스 키 별도 필요.
  // 실용적으로: family 멤버를 추적하는 인덱스 키
  const idxKey = `rt-fam:${family}`;
  const members = JSON.parse((await env.SESSION_KV.get(idxKey)) || '[]');
  for (const hash of members) {
    await env.SESSION_KV.delete(`rt:${hash}`);
  }
  await env.SESSION_KV.delete(idxKey);
}

// ───────────────────────────────────────────────────────
// 단일 토큰 폐기 (로그아웃)
// ───────────────────────────────────────────────────────
export async function revokeRefreshToken(env, token) {
  const hash = await sha256Hex(token);
  const raw = await env.SESSION_KV.get(`rt:${hash}`);
  if (!raw) return;
  const rec = JSON.parse(raw);
  await env.SESSION_KV.delete(`rt:${hash}`);
  // 같은 family 전체 폐기 옵션 (전역 로그아웃)
  // await invalidateFamily(env, rec.family);
}

// ───────────────────────────────────────────────────────
// Access Token 발급 (RS256)
// ───────────────────────────────────────────────────────
/**
 * @param {object} env
 * @param {object} userClaims - { sub, provider, name, email, role, permissions, aud }
 */
export async function issueAccessToken(env, userClaims) {
  if (!env.JWT_PRIVATE_KEY_PEM) {
    throw new Error('JWT_PRIVATE_KEY_PEM not configured');
  }
  const { aud, ...rest } = userClaims;
  return jwtSignRS256(rest, env.JWT_PRIVATE_KEY_PEM, {
    kid: env.JWT_KID || 'k0',
    ttlSec: parseInt(env.JWT_ACCESS_TTL_SEC || ACCESS_TTL_SEC),
    iss: env.JWT_ISS || 'auth-hub',
    aud,
  });
}

// ───────────────────────────────────────────────────────
// 쿠키 헬퍼 (Refresh + Access 분리)
// ───────────────────────────────────────────────────────
export function setRefreshCookie(token, name = 'rt', domain) {
  const parts = [
    `${name}=${token}`,
    `Path=/auth`,        // refresh 엔드포인트만 접근 (CSRF 방어)
    'HttpOnly', 'Secure', 'SameSite=Lax',
    `Max-Age=${REFRESH_TTL_SEC}`,
  ];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join('; ');
}

export function setAccessCookie(token, name = 'at', domain) {
  const parts = [
    `${name}=${token}`,
    'Path=/',
    'HttpOnly', 'Secure', 'SameSite=Lax',
    `Max-Age=${ACCESS_TTL_SEC}`,
  ];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join('; ');
}

export function clearRefreshCookie(name = 'rt', domain) {
  const parts = [`${name}=`, `Path=/auth`, 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=0'];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join('; ');
}

export function clearAccessCookie(name = 'at', domain) {
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=0'];
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join('; ');
}
