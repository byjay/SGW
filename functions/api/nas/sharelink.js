// POST /api/nas/sharelink {path} → { url } — 공유링크 생성 (nas.read 이상). env 미설정 시 503.
import { isConfigured, shareLink } from '../../_lib/nas-client.js';
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

  const g = await guardPath(env, user, path, 'read');
  if (!g.ok) return json({ error: g.error, level: g.level }, g.status);
  try {
    const out = await shareLink(env, g.path);
    await writeAudit(env, {
      event: 'nas.sharelink', sub: g.uctx.sub, resource: g.path, action: 'share',
      result: 'ok', ip: request.headers.get('cf-connecting-ip'),
    }).catch(() => {});
    return json(out);
  } catch (e) {
    return json({ error: 'nas_error', message: String((e && e.message) || e) }, 502);
  }
}
