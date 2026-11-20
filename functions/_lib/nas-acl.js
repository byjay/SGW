// nas-acl.js — nas_acl 권한 매트릭스 조회 + 접근수준 계산.
// 우선순위: user > dept > role. 매트릭스에 없으면 기본 HIDDEN(차단).
// JWT엔 dept가 없으므로 sub로 sgw_users.department/role/is_part_time 조회.
import { resolvePath } from './nas-map.js';
import { roleOf } from './sgw-roles.js';

// sgw 역할 + 알바 여부 → NAS 역할 버킷(admin | engineer | viewer).
export function nasRole(role, isPartTime) {
  const r = String(role || 'user').toLowerCase();
  if (r === 'admin' || r === 'super' || r === 'owner') return 'admin';
  if (isPartTime) return 'viewer';
  return 'engineer';
}

// 사용자 컨텍스트 로드(dept는 JWT에 없어 DB에서). { sub, dept, role, nrole }.
export async function loadUserContext(env, user) {
  const sub = user && (user.sub || user.id) ? String(user.sub || user.id) : '';
  let dept = '';
  let role = user && user.role ? user.role : 'user';
  let isPartTime = false;
  if (env && env.DB && sub) {
    const row = await env.DB.prepare(
      'SELECT department, role, is_part_time FROM sgw_users WHERE id = ?'
    ).bind(sub).first().catch(() => null);
    if (row) {
      dept = row.department || '';
      if (row.role) role = row.role;
      isPartTime = Number(row.is_part_time) === 1;
    }
  }
  return { sub, dept, role, nrole: nasRole(role, isPartTime) };
}

// 폴더 접근수준 계산. user > dept > role 순으로 첫 매칭 채택, 없으면 HIDDEN.
export async function accessFor(env, uctx, folderKey) {
  if (!env || !env.DB) return 'HIDDEN';
  const rows = (await env.DB.prepare(
    'SELECT subject_type, subject, level FROM nas_acl WHERE folder_key = ?'
  ).bind(folderKey).all().catch(() => ({ results: [] }))).results || [];
  const byType = { user: null, dept: null, role: null };
  for (const r of rows) {
    if (r.subject_type === 'user' && r.subject === uctx.sub) byType.user = r.level;
    else if (r.subject_type === 'dept' && r.subject === uctx.dept) byType.dept = r.level;
    else if (r.subject_type === 'role' && r.subject === uctx.nrole) byType.role = r.level;
  }
  return String(byType.user || byType.dept || byType.role || 'HIDDEN').toUpperCase();
}

export function canRead(level) { return level === 'RW' || level === 'RO'; }
export function canWrite(level) { return level === 'RW'; }

// 경로 해석 + 접근 확인 원샷 가드. need: 'read' | 'write'.
// { ok, path, folderKey, level, uctx } | { ok:false, status, error, level? }.
export async function guardPath(env, user, rawPath, need) {
  const rp = resolvePath(rawPath);
  if (!rp.ok) return { ok: false, status: 400, error: rp.error };
  const uctx = await loadUserContext(env, user);
  const level = await accessFor(env, uctx, rp.folderKey);
  const allowed = need === 'write' ? canWrite(level) : canRead(level);
  if (!allowed) return { ok: false, status: 403, error: 'forbidden', level };
  return { ok: true, path: rp.path, folderKey: rp.folderKey, level, uctx };
}

// roleOf re-export (일부 호출부 편의).
export { roleOf };
