// POST /api/nas/upload (multipart: field path + file) — 업로드 (nas.write). env 미설정 시 503.
import { isConfigured, upload } from '../../_lib/nas-client.js';
import { guardPath } from '../../_lib/nas-acl.js';
import { writeAudit } from '../../_lib/audit.js';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const NOT_SET = { error: 'NAS 미설정', hint: 'CF Pages Secret NAS_BASE_URL/NAS_SVC_ACCOUNT/NAS_SVC_PASSWORD 등록 필요' };

export async function onRequestPost({ request, env, data }) {
  if (!isConfigured(env)) return json(NOT_SET, 503);
  const user = data && data.user;
  let form;
  try { form = await request.formData(); } catch { form = null; }
  if (!form) return json({ error: 'bad_form' }, 400);
  const dirPath = String(form.get('path') || '');
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'file_required' }, 400);

  const g = await guardPath(env, user, dirPath, 'write');
  if (!g.ok) return json({ error: g.error, level: g.level }, g.status);
  try {
    await upload(env, g.path, file.name || 'upload.bin', file);
    await writeAudit(env, {
      event: 'nas.upload', sub: g.uctx.sub, resource: `${g.path}/${file.name || 'upload.bin'}`,
      action: 'upload', result: 'ok', ip: request.headers.get('cf-connecting-ip'),
    }).catch(() => {});
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'nas_error', message: String((e && e.message) || e) }, 502);
  }
}
