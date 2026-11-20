/* GET /auth/logout — 소셜 로그인 세션 종료
 * 선택 env: AUTH_COOKIE (기본: auth_sess), AUTH_LOGOUT_URL (기본: /)
 *
 * ⚠️ 대상 프로젝트에 이미 logout.js가 있다면:
 *    이 파일로 덮어쓰지 말고 onRequestGet 핸들러만 기존 파일에 추가하세요.
 *    (AGENT-GUIDE.md Section 3 STEP 1 참고)
 */
import { clearAuthCookie } from '../_lib/social-auth.js';

export async function onRequestGet({ env }) {
  // ★ 세션 쿠키가 두 종류다: auth_sess(구글 폴백 모드)와 at(/api/auth/login·RS256 모드).
  //   하나만 지우면 로그아웃해도 나머지 쿠키로 계속 인증된다(rbac.readAuth 가 둘 다 본다).
  const headers = new Headers({ location: env.AUTH_LOGOUT_URL || '/' });
  headers.append('set-cookie', clearAuthCookie(env.AUTH_COOKIE || 'auth_sess'));
  headers.append('set-cookie', clearAuthCookie(env.ACCESS_COOKIE || 'at'));
  headers.append('set-cookie', clearAuthCookie(env.REFRESH_COOKIE || 'rt'));
  return new Response(null, { status: 302, headers });
}
