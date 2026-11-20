/* sgw-roles.js — SGW 역할 판정 (sgw_users.role = admin | manager | user).
 * rbac.js의 ROLE_HIERARCHY(viewer..owner)는 SEcMS 도면 역할이라 SGW엔 안 맞음 → 별도 판정.
 */
export function roleOf(user) {
  return (user && user.role ? String(user.role) : 'user').toLowerCase();
}
// 관리자 콘솔 권한(명부 CRUD·연차 승인·결재 반려 등).
export function isManager(user) {
  const r = roleOf(user);
  return r === 'admin' || r === 'manager' || r === 'owner';
}
// 최상위(역할 지정 등).
export function isAdmin(user) {
  const r = roleOf(user);
  return r === 'admin' || r === 'owner';
}

// 부여 가능한 역할 화이트리스트(임의 문자열로 권한 컬럼을 오염시키는 경로 차단).
export const ASSIGNABLE_ROLES = new Set(['user', 'manager', 'admin']);

/** 초대/승인 시 역할 부여 권한 판정. admin 역할은 admin만 줄 수 있다(권한 상승 방지). */
export function canGrantRole(actor, role) {
  if (!isManager(actor)) return { ok: false, status: 403, error: 'forbidden' };
  const r = String(role == null ? '' : role).toLowerCase();
  if (!ASSIGNABLE_ROLES.has(r)) return { ok: false, status: 400, error: 'invalid_role' };
  if (r === 'admin' && !isAdmin(actor)) {
    return { ok: false, status: 403, error: 'admin_role_requires_admin' };
  }
  return { ok: true, role: r };
}

// 셀프체크: 권한 상승 가드가 깨지면 로드 시 throw.
{
  const mgr = { role: 'manager' };
  const adm = { role: 'admin' };
  if (
    canGrantRole(mgr, 'admin').ok !== false ||
    canGrantRole(mgr, 'manager').ok !== true ||
    canGrantRole(adm, 'admin').ok !== true ||
    canGrantRole(adm, 'root').ok !== false ||
    canGrantRole({ role: 'user' }, 'user').ok !== false
  ) {
    throw new Error('sgw-roles.js canGrantRole self-check failed');
  }
}
