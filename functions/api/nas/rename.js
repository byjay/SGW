// POST /api/nas/rename {path, name} — 이름변경 (nas.write). env 미설정 시 503.
import { isConfigured, rename } from '../../_lib/nas-client.js';
import { guardPath } from '../../_lib/nas-acl.js';
import { writeAudit } from '../../_lib/audit.js';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const NOT_SET = { error: 'NAS 미설정', hint: 'CF Pages Secret NAS_BASE_URL/NAS_SVC_ACCOUNT/NAS_SVC_PASSWORD 등록 필요' };

export async function onRequestPost({ request, env, data }) {
  if (!isConfigured(env)) return json(NOT_SET, 503);
  const user = data && data.user;
  let body;
  try { body = await request.json(); } catch { body = null; }
  const path = body && body.path ? String(body.path) : '';
  const name = body && body.name ? String(body.name) : '';
  if (!name || name.includes('/') || name.includes('\\')) return json({ error: 'bad_name' }, 400);

  const g = await guardPath(env, user, path, 'write');
  if (!g.ok) return json({ error: g.error, level: g.level }, g.status);
  try {
    await rename(env, g.path, name);
    await writeAudit(env, {
      event: 'nas.rename', sub: g.uctx.sub, resource: g.path, action: 'rename',
      result: 'ok', ip: request.headers.get('cf-connecting-ip'), name,
    }).catch(() => {});
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'nas_error', message: String((e && e.message) || e) }, 502);
  }
}
