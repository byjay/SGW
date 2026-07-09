/* social-users-db.js — D1 기반 소셜 유저 관리 헬퍼
 * 원본: E:\code-project\auth\functions\_lib\social-users-db.js
 *
 * DB binding 이름은 env.DB (wrangler.toml [[d1_databases]] binding = "DB")
 * status: 'pending' | 'approved' | 'rejected'
 */

/**
 * sub(naver:xxx | google:xxx)로 유저 조회
 */
export async function findUserBySub(env, sub) {
  return env.DB.prepare(
    `SELECT * FROM social_users WHERE sub = ?`
  ).bind(sub).first();
}

/**
 * 신규 유저 생성 (OAuth 첫 로그인 시)
 * status = 'pending' 으로 시작
 */
export async function createUser(env, { sub, provider, name, email, profile_image }) {
  const now = Date.now();
  const r   = await env.DB.prepare(
    `INSERT INTO social_users (sub, provider, name, email, profile_image, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(sub, provider, name || null, email || null, profile_image || null, now, now).run();
  return r.meta?.last_row_id;
}

/**
 * 추가 정보 저장 (가입신청 폼 제출 시)
 */
export async function saveRegistration(env, sub, fields) {
  const { company, phone, purpose, extra } = fields;
  const now = Date.now();
  return env.DB.prepare(
    `UPDATE social_users
     SET company = ?, phone = ?, purpose = ?, extra_json = ?, updated_at = ?
     WHERE sub = ?`
  ).bind(
    company || null,
    phone   || null,
    purpose || null,
    extra   ? JSON.stringify(extra) : null,
    now, sub
  ).run();
}

/**
 * 마지막 로그인 시각 갱신
 */
export async function touchLastLogin(env, sub) {
  return env.DB.prepare(
    `UPDATE social_users SET last_login = ? WHERE sub = ?`
  ).bind(Date.now(), sub).run();
}

/**
 * 관리자: 유저 승인
 */
export async function approveUser(env, id, { approvedBy, role = 'user', permissions = [] }) {
  return env.DB.prepare(
    `UPDATE social_users
     SET status = 'approved', role = ?, permissions = ?, approved_at = ?, approved_by = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    role,
    JSON.stringify(permissions),
    Date.now(), approvedBy, Date.now(), id
  ).run();
}

/**
 * 관리자: 유저 거부
 */
export async function rejectUser(env, id, { approvedBy, reason = '' }) {
  return env.DB.prepare(
    `UPDATE social_users
     SET status = 'rejected', reject_reason = ?, approved_by = ?, updated_at = ?
     WHERE id = ?`
  ).bind(reason, approvedBy, Date.now(), id).run();
}

/**
 * 관리자: 유저 목록 조회 (status 필터)
 */
export async function listUsers(env, { status, limit = 100, offset = 0 } = {}) {
  let sql    = `SELECT id, sub, provider, name, email, company, phone, purpose,
                       status, role, permissions, created_at, approved_at, last_login
                FROM social_users`;
  const binds = [];
  if (status) { sql += ` WHERE status = ?`; binds.push(status); }
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);
  const stmt = env.DB.prepare(sql);
  const rows = (await (binds.length ? stmt.bind(...binds) : stmt).all()).results || [];
  // permissions JSON 파싱
  return rows.map(r => ({
    ...r,
    permissions: r.permissions ? JSON.parse(r.permissions) : [],
  }));
}
