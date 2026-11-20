// POST /api/nas/downloadlink {path} — 단기 서명 다운로드 URL 발급 (nas.download).
// → { url:'/api/nas/download?path=..&exp=..&t=HMAC(JWT_SECRET, path:exp)' } (60초 유효).
// 실제 스트림은 /api/nas/download가 t를 자체검증(Bearer 없이) → 미들웨어 PUBLIC.
import { isConfigured } from '../../_lib/nas-client.js';
import { guardPath } from '../../_lib/nas-acl.js';
import { signPathToken, TOKEN_TTL } from '../../_lib/nas-dl-token.js';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const NOT_SET = { error: 'NAS 미설정', hint: 'CF Pages Secret NAS_BASE_URL/NAS_SVC_ACCOUNT/NAS_SVC_PASSWORD 등록 필요' };

export async function onRequestPost({ request, env, data }) {
  if (!isConfigured(env)) return json(NOT_SET, 503);
  if (!env.JWT_SECRET) return json({ error: 'no_secret' }, 500);
  const user = data && data.user;
  let body;
  try { body = await request.json(); } catch { body = null; }
  const path = body && body.path ? String(body.path) : '';
  const g = await guardPath(env, user, path, 'read');
  if (!g.ok) return json({ error: g.error, level: g.level }, g.status);

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  const t = await signPathToken(env.JWT_SECRET, g.path, exp);
  const url = `/api/nas/download?path=${encodeURIComponent(g.path)}&exp=${exp}&t=${t}`;
  return json({ url });
}
