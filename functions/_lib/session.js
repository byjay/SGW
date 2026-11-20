/* session.js — SGW 세션(JWT + 쿠키) 발급 단일 경로.
 *
 * 비밀번호 로그인(api/auth/login.js)과 구글 로그인(api/auth/google/login.js)이
 * **같은 코드**로 세션을 만든다. 발급 경로가 둘로 갈라지면 한쪽에만 가드가 빠지는
 * 사고가 난다(승인 게이트·쿠키 플래그·no-store 누락 등) → 여기 한 곳으로 모은다.
 */
import { jwtSign, json } from './social-auth.js';

export const SESSION_TTL_SEC = 604800; // 7d

// 계정 status 화이트리스트(fail-closed). 값이 없거나 모르는 값이면 로그인 거부.
//   'active'   = sgw_users 로스터 시드가 쓰는 값(현행 운영 데이터)
//   'approved' = 소셜 가입 승인 플로우가 쓰는 값
const ACTIVE_STATUS = new Set(['active', 'approved']);

export function isActiveAccount(row) {
  return !!row && ACTIVE_STATUS.has(String(row.status || '').toLowerCase());
}

/** DB row → 클라이언트에 내보내는 사용자 객체(민감 컬럼 제외). */
export function toSessionUser(row) {
  return {
    id: String(row.id),
    name: row.name || '',
    email: row.email || '',
    role: row.role || 'user',
    department: row.department || '',
    position: row.position || '',
  };
}

/** 세션 JWT 발급. env.JWT_SECRET 없으면 던진다(fail-closed — 호출측이 500). */
export async function issueSessionToken(env, user) {
  if (!env || !env.JWT_SECRET) throw new Error('no_secret');
  return jwtSign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    env.JWT_SECRET,
    SESSION_TTL_SEC
  );
}

export function sessionCookie(token) {
  return `at=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SEC}`;
}

/** 로그인 성공 응답(쿠키 + no-store)을 만든다. extra 는 body 에 병합. */
export async function sessionResponse(env, row, extra = {}) {
  const user = toSessionUser(row);
  const token = await issueSessionToken(env, user);
  return json(
    { ok: true, token, user, ...extra },
    {
      headers: {
        'Set-Cookie': sessionCookie(token),
        // 토큰이 담긴 응답은 중간 캐시·브라우저 캐시에 절대 남기지 않는다.
        'Cache-Control': 'no-store',
      },
    }
  );
}
