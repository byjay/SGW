/* GET /auth/me — 현재 로그인 유저 정보 반환 (RS256 + HS256 자동 분기)
 *
 * Response:
 *   200: { ok: true, user: { sub, provider, name, email, role, permissions, ... } }
 *   401: { ok: false, error: "로그인이 필요합니다" }
 */
import { readAuth } from '../_lib/rbac.js';

export async function onRequestGet({ request, env }) {
  console.log('[DEBUG me.js] cookie header=', request.headers.get('cookie'));
  console.log('[DEBUG me.js] env.JWT_SECRET set?', !!env.JWT_SECRET, 'env.AUTH_COOKIE=', env.AUTH_COOKIE);
  const user = await readAuth(request, env);
  console.log('[DEBUG me.js] user=', JSON.stringify(user));
  if (!user) {
    return new Response(
      JSON.stringify({ ok: false, error: '로그인이 필요합니다' }),
      { status: 401, headers: { 'content-type': 'application/json; charset=utf-8' }}
    );
  }
  return new Response(
    JSON.stringify({ ok: true, user }),
    { headers: { 'content-type': 'application/json; charset=utf-8' }}
  );
}
