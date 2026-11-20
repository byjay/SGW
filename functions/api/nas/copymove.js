// POST /api/nas/copymove {from, to, move} — 복사/이동 (nas.move). env 미설정 시 503.
// 이동(move=true): from write + to write. 복사: from read + to write.
import { isConfigured, copyMove } from '../../_lib/nas-client.js';
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
  const from = body && body.from ? String(body.from) : '';
  const to = body && body.to ? String(body.to) : '';
  const move = !!(body && body.move);

  const gFrom = await guardPath(env, user, from, move ? 'write' : 'read');
  if (!gFrom.ok) return json({ error: gFrom.error, level: gFrom.level, at: 'from' }, gFrom.status);
  const gTo = await guardPath(env, user, to, 'write');
  if (!gTo.ok) return json({ error: gTo.error, level: gTo.level, at: 'to' }, gTo.status);
  try {
    await copyMove(env, gFrom.path, gTo.path, move);
    await writeAudit(env, {
      event: move ? 'nas.move' : 'nas.copy', sub: gFrom.uctx.sub, resource: gFrom.path,
      action: move ? 'move' : 'copy', result: 'ok', dest: gTo.path,
      ip: request.headers.get('cf-connecting-ip'),
    }).catch(() => {});
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'nas_error', message: String((e && e.message) || e) }, 502);
  }
}
