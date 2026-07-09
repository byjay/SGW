/* sso-clients-db.js — D1 기반 SSO 클라이언트 관리
 * env.SSO_CLIENTS JSON 하드코딩의 후속 대체
 *
 * 안전: client_secret은 평문 저장 안 함 (SHA-256 해시만)
 * 등록 시 평문 1회 표시 → 어드민이 안전한 곳에 보관 → 분실 시 재발급
 */

const SHA256_HEX = async (s) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const randomHex = (bytes = 32) => {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
};

const constantTimeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

/**
 * 신규 클라이언트 등록 — 평문 secret을 1회 반환
 * @returns {Promise<{client_id, client_secret}>}
 */
export async function createClient(env, { client_id, display_name, redirect_uris, allowed_origins, mfa_required, min_role, notes, created_by }) {
  if (!client_id || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(client_id))
    throw new Error('invalid_client_id');
  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0)
    throw new Error('redirect_uris_required');
  for (const uri of redirect_uris) {
    try { new URL(uri); } catch { throw new Error('invalid_redirect_uri: ' + uri); }
  }

  const client_secret = randomHex(32);
  const secret_hash = await SHA256_HEX(client_secret);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO sso_clients
      (client_id, display_name, secret_hash, redirect_uris, allowed_origins, mfa_required, min_role, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    client_id,
    display_name || null,
    secret_hash,
    JSON.stringify(redirect_uris),
    allowed_origins ? JSON.stringify(allowed_origins) : null,
    mfa_required ? 1 : 0,
    min_role || null,
    notes || null,
    created_by || null,
    now, now
  ).run();

  return { client_id, client_secret };  // 평문은 이때만 반환
}

/**
 * Secret 회전 — 평문 1회 반환
 */
export async function rotateSecret(env, client_id) {
  const client_secret = randomHex(32);
  const secret_hash = await SHA256_HEX(client_secret);
  const r = await env.DB.prepare(
    `UPDATE sso_clients SET secret_hash = ?, updated_at = ? WHERE client_id = ?`
  ).bind(secret_hash, Date.now(), client_id).run();
  if (!r.meta?.changes) throw new Error('client_not_found');
  return { client_id, client_secret };
}

/**
 * 클라이언트 조회 (어드민용, secret 마스킹)
 */
export async function getClient(env, client_id) {
  const row = await env.DB.prepare(
    `SELECT * FROM sso_clients WHERE client_id = ?`
  ).bind(client_id).first();
  if (!row) return null;
  return {
    ...row,
    redirect_uris:   row.redirect_uris ? JSON.parse(row.redirect_uris) : [],
    allowed_origins: row.allowed_origins ? JSON.parse(row.allowed_origins) : [],
    secret_hash:     row.secret_hash.slice(0, 8) + '...',  // 마스킹
  };
}

/**
 * Secret 검증 (sso/exchange용)
 */
export async function verifyClientSecret(env, client_id, client_secret) {
  if (!env.DB) return false;
  const row = await env.DB.prepare(
    `SELECT secret_hash, status FROM sso_clients WHERE client_id = ?`
  ).bind(client_id).first();
  if (!row || row.status !== 'active') return false;
  const candidate_hash = await SHA256_HEX(client_secret);
  return constantTimeEqual(row.secret_hash, candidate_hash);
}

/**
 * redirect_uri 검증
 */
export async function isRedirectAllowed(env, client_id, redirect_uri) {
  if (!env.DB) return false;
  const row = await env.DB.prepare(
    `SELECT redirect_uris, status FROM sso_clients WHERE client_id = ?`
  ).bind(client_id).first();
  if (!row || row.status !== 'active') return false;
  const allowed = JSON.parse(row.redirect_uris || '[]');
  return allowed.some(pat => {
    if (pat === redirect_uri) return true;
    if (pat.endsWith('/*') && redirect_uri.startsWith(pat.slice(0, -1))) return true;
    return false;
  });
}

/**
 * 전체 목록 (어드민)
 */
export async function listClients(env) {
  if (!env.DB) return [];
  const rows = (await env.DB.prepare(
    `SELECT client_id, display_name, redirect_uris, allowed_origins, mfa_required, min_role, status, notes, created_at, updated_at
     FROM sso_clients ORDER BY created_at DESC`
  ).all()).results || [];
  return rows.map(r => ({
    ...r,
    redirect_uris:   r.redirect_uris ? JSON.parse(r.redirect_uris) : [],
    allowed_origins: r.allowed_origins ? JSON.parse(r.allowed_origins) : [],
  }));
}

/**
 * 비활성화
 */
export async function disableClient(env, client_id) {
  return env.DB.prepare(
    `UPDATE sso_clients SET status = 'disabled', updated_at = ? WHERE client_id = ?`
  ).bind(Date.now(), client_id).run();
}

/**
 * 삭제
 */
export async function deleteClient(env, client_id) {
  return env.DB.prepare(`DELETE FROM sso_clients WHERE client_id = ?`).bind(client_id).run();
}
