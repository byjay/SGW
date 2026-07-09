/* sgw-sso.js — SGW → SEDMS SSO 서명 헬퍼 (server-only, Web Crypto, no npm)
 *
 * SEDMS_G `src/server/security/sgwSso.ts` 의 검증 규격과 100% 일치해야 한다:
 *   - user payload JSON: { employee_id, name, dept, email, sgw_role }
 *   - u  = base64url(utf8(JSON.stringify(user)))
 *   - t  = String(Date.now())              // 발급 epoch ms
 *   - n  = crypto.randomUUID()             // 1회용 nonce
 *   - exp= String(floor(now/1000) + ttl)   // 만료 epoch sec
 *   - ver= 'v1'
 *   - canonical = `${u}\n${t}\n${n}\n${exp}\n${ver}`  (LF 구분, trailing newline 없음)
 *   - sig= base64url(HMAC_SHA256(secret, canonical))
 *
 * ⚠️ HMAC 시크릿(SGW_SSO_SECRET)은 절대 브라우저에 노출 금지 → 이 모듈은 Pages Function(server)에서만 import.
 */

const VER = 'v1';
const ENC = new TextEncoder();

function b64uEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', ENC.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
}

/**
 * SEDMS SSO 진입 URL을 서명해 생성.
 *
 * @param {Object} user - { employee_id, name, dept?, email?, sgw_role? }
 * @param {string} secret - SGW_SSO_SECRET (SEDMS와 공유)
 * @param {Object} [opts]
 * @param {string} [opts.sedmsBase='https://sedms.app'] - SEDMS 베이스 URL
 * @param {number} [opts.ttlSec=120] - 만료 TTL(초)
 * @returns {Promise<string>} 완성된 SSO URL
 */
export async function buildSedmsSsoUrl(user, secret, opts = {}) {
  const sedmsBase = opts.sedmsBase || 'https://sedms.app';
  const ttlSec = opts.ttlSec || 120;

  // SEDMS_G SgwUser 스키마와 필드명 일치. (dept/email/sgw_role은 선택)
  const userObj = {
    employee_id: user.employee_id,
    name: user.name,
    dept: user.dept || null,
    email: user.email || null,
    sgw_role: user.sgw_role || null,
  };
  const u = b64uEncode(ENC.encode(JSON.stringify(userObj)));
  const t = String(Date.now());
  const n = crypto.randomUUID();
  const exp = String(Math.floor(Date.now() / 1000) + ttlSec);

  const canonical = `${u}\n${t}\n${n}\n${exp}\n${VER}`;
  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, ENC.encode(canonical));
  const sig = b64uEncode(new Uint8Array(sigBuf));

  const qs = new URLSearchParams({ u, t, n, exp, ver: VER, sig });
  return `${sedmsBase.replace(/\/$/, '')}/sso/sgw?${qs.toString()}`;
}
