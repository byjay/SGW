/* rbac.js — Role-Based Access Control (보안.html SECTION 5)
 *
 * Roles (낮은 권한 → 높은 권한):
 *   viewer    : 도면 읽기전용
 *   engineer  : 담당 도면 수정/다운로드
 *   auditor   : 감사 로그 전체 읽기
 *   admin     : 사용자 관리, 도면 승인
 *   owner     : 모든 권한
 *
 * Permissions (세분화된 액션):
 *   drawing.read | drawing.download | drawing.write | drawing.approve
 *   user.read    | user.write       | user.approve  | user.delete
 *   audit.read   | settings.read    | settings.write
 *   project.create | project.delete
 */

import { jwtVerifyRS256 } from './jwt-rs256.js';

// ───────────────────────────────────────────────────────
// 역할별 기본 권한 매트릭스
// ───────────────────────────────────────────────────────
export const ROLE_PERMISSIONS = {
  owner: ['*'],  // 모든 권한
  admin: [
    'drawing.read', 'drawing.download', 'drawing.write', 'drawing.approve',
    'user.read', 'user.write', 'user.approve',
    'audit.read', 'settings.read', 'settings.write',
  ],
  auditor: [
    'drawing.read.meta',  // 메타데이터만
    'audit.read',
    'user.read',
  ],
  engineer: [
    'drawing.read', 'drawing.download.own', 'drawing.write.own',
    'user.read.self',
  ],
  viewer: [
    'drawing.read.lowres',  // 저해상도만
  ],
};

export const ROLE_HIERARCHY = ['viewer', 'engineer', 'auditor', 'admin', 'owner'];

/**
 * 권한 체크 — 와일드카드 지원
 * hasPermission(['drawing.read'], 'drawing.read.lowres') → true (prefix match)
 * hasPermission(['*'], 'anything') → true
 */
export function hasPermission(userPerms, required) {
  if (!Array.isArray(userPerms)) return false;
  if (userPerms.includes('*')) return true;
  if (userPerms.includes(required)) return true;
  // prefix match: 'drawing.*' covers 'drawing.read'
  return userPerms.some(p => {
    if (p.endsWith('.*')) return required.startsWith(p.slice(0, -1));
    if (required.startsWith(p + '.')) return true;
    return false;
  });
}

/**
 * 역할 비교 — 최소 역할 충족 여부
 */
export function hasRole(userRole, minRole) {
  const u = ROLE_HIERARCHY.indexOf(userRole);
  const m = ROLE_HIERARCHY.indexOf(minRole);
  return u >= 0 && m >= 0 && u >= m;
}

/**
 * Cookie에서 Access Token 추출 + 검증
 */
function getCookie(req, name) {
  const m = (req.headers.get('cookie') || '')
    .match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? m[1] : null;
}

export async function readAuth(request, env) {
  const cookieName = env.ACCESS_COOKIE || 'at';
  // ponytail: RS256/refresh 모드는 'at' 쿠키(setAccessCookie)를 쓰지만, DB/RSA 키가 없는
  // 기본 HS256 폴백 모드(google/callback.js 참고)는 AUTH_COOKIE(기본 'auth_sess')에 세션을 담는다.
  // 두 쿠키 이름이 다르므로 여기서 둘 다 확인하지 않으면 폴백 모드의 /auth/me가 항상 401을 낸다.
  const authCookieName = env.AUTH_COOKIE || 'auth_sess';
  const token = getCookie(request, cookieName) ||
                getCookie(request, authCookieName) ||
                (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;

  // RS256 우선, fallback HS256
  if (env.JWT_PUBLIC_KEY_PEM) {
    const payload = await jwtVerifyRS256(token, env.JWT_PUBLIC_KEY_PEM, {
      iss: env.JWT_ISS || 'auth-hub',
    });
    if (payload) return payload;
  }

  // 레거시 HS256 (기존 코드 호환) — google/callback.js 폴백 모드가 발급한 auth_sess 쿠키를 검증
  if (env.JWT_SECRET) {
    const { jwtVerify } = await import('./social-auth.js');
    return jwtVerify(token, env.JWT_SECRET);
  }

  return null;
}

/**
 * 미들웨어: 최소 역할 요구
 * @returns { ok:true, user } | { ok:false, status, error }
 */
export async function requireRole(request, env, roles) {
  const user = await readAuth(request, env);
  if (!user) return { ok: false, status: 401, error: 'auth_required' };
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.some(r => hasRole(user.role, r) || user.role === r)) {
    return { ok: false, status: 403, error: 'forbidden', required: allowed };
  }
  return { ok: true, user };
}

/**
 * 미들웨어: 특정 권한 요구
 */
export async function requirePermission(request, env, permission) {
  const user = await readAuth(request, env);
  if (!user) return { ok: false, status: 401, error: 'auth_required' };
  const perms = Array.isArray(user.permissions) ? user.permissions :
                (ROLE_PERMISSIONS[user.role] || []);
  if (!hasPermission(perms, permission)) {
    return { ok: false, status: 403, error: 'forbidden', required: permission };
  }
  return { ok: true, user };
}

/**
 * 미들웨어: 인증만 요구 (역할 무관)
 */
export async function requireAuth(request, env) {
  const user = await readAuth(request, env);
  if (!user) return { ok: false, status: 401, error: 'auth_required' };
  return { ok: true, user };
}
