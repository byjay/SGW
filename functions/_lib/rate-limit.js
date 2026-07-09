/* rate-limit.js — KV 기반 Sliding Window Rate Limiter
 * 보안.html L1: Rate Limit
 *
 * Cloudflare KV의 eventual consistency 한계를 고려한 best-effort 구현.
 * 엄격한 정확도가 필요한 경로는 Durable Objects 권장.
 */

/**
 * Sliding window rate limit
 * @param {object} env - { RATE_KV }
 * @param {string} key - 식별자 (IP, sub, ip+path 등)
 * @param {object} opts - { limit, windowSec }
 * @returns {Promise<{ok:boolean, remaining:number, resetAt:number}>}
 */
export async function checkRateLimit(env, key, { limit = 10, windowSec = 60 } = {}) {
  if (!env.RATE_KV) return { ok: true, remaining: limit, resetAt: 0 };

  const now = Math.floor(Date.now() / 1000);
  const slot = Math.floor(now / windowSec);
  const kvKey = `rl:${key}:${slot}`;

  const current = parseInt((await env.RATE_KV.get(kvKey)) || '0');
  if (current >= limit) {
    return { ok: false, remaining: 0, resetAt: (slot + 1) * windowSec };
  }

  await env.RATE_KV.put(kvKey, String(current + 1), {
    expirationTtl: windowSec * 2,
  });
  return { ok: true, remaining: limit - current - 1, resetAt: (slot + 1) * windowSec };
}

/**
 * 로그인 시도 제한 (IP + sub 조합)
 */
export async function checkLoginRateLimit(env, ip) {
  return checkRateLimit(env, `login:${ip}`, { limit: 10, windowSec: 60 });
}

/**
 * Refresh 토큰 회전 제한
 */
export async function checkRefreshRateLimit(env, ip) {
  return checkRateLimit(env, `refresh:${ip}`, { limit: 30, windowSec: 60 });
}
