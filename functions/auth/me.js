/* GET /auth/me — 현재 로그인 유저 정보 반환 (RS256 + HS256 자동 분기)
 *
 * Response:
 *   200: { ok: true, user: { sub, provider, name, email, role, permissions, ... } }
 *   401: { ok: false, error: "로그인이 필요합니다" }
 */
import { readAuth } from '../_lib/rbac.js';

export async function onRequestGet({ request, env }) {
  const user = await readAuth(request, env);
  if (!user) {
    return new Response(
      JSON.stringify({ ok: false, error: '로그인이 필요합니다' }),
      { status: 401, headers: { 'content-type': 'application/json; charset=utf-8' }}
    );
  }
  return new Response(
    JSON.stringify({ ok: true, user }),
    { headers: {
      'content-type': 'application/json; charset=utf-8',
      // 신원 응답은 공용 캐시(CF Pages 엣지 포함)에 남기지 않는다.
      'cache-control': 'no-store',
    }}
  );
}
