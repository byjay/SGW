// GET /api/nas/list?path= — 폴더 목록 (nas.read). env 미설정 시 503.
// → { files:[{name,path,isdir,size,mtime}] }.
import { isConfigured, list } from '../../_lib/nas-client.js';
import { guardPath } from '../../_lib/nas-acl.js';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const NOT_SET = { error: 'NAS 미설정', hint: 'CF Pages Secret NAS_BASE_URL/NAS_SVC_ACCOUNT/NAS_SVC_PASSWORD 등록 필요' };

export async function onRequestGet({ request, env, data }) {
  if (!isConfigured(env)) return json(NOT_SET, 503);
  const user = data && data.user;
  const path = new URL(request.url).searchParams.get('path') || '';
  const g = await guardPath(env, user, path, 'read');
  if (!g.ok) return json({ error: g.error, level: g.level }, g.status);
  try {
    return json(await list(env, g.path));
  } catch (e) {
    return json({ error: 'nas_error', message: String((e && e.message) || e) }, 502);
  }
}
