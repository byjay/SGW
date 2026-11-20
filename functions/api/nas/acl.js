// GET/POST /api/nas/acl — 권한 매트릭스 조회/저장 (nas.admin = isAdmin). NAS env 불필요(D1만).
// GET  → { entries:[{subject_type,subject,folder_key,level}] }
// POST { entries:[...] } → 전체 교체(DELETE+INSERT) + 감사로그.
import { isAdmin } from '../../_lib/sgw-roles.js';
import { FOLDER_KEYS } from '../../_lib/nas-map.js';
import { writeAudit } from '../../_lib/audit.js';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const SUBJECT_TYPES = new Set(['role', 'dept', 'user']);
const LEVELS = new Set(['RW', 'RO', 'HIDDEN']);

export async function onRequestGet({ env, data }) {
  const user = data && data.user;
  if (!isAdmin(user)) return json({ error: 'forbidden' }, 403);
  if (!env || !env.DB) return json({ entries: [] }, 500);
  const rows = (await env.DB.prepare(
    'SELECT subject_type, subject, folder_key, level FROM nas_acl ORDER BY folder_key, subject_type, subject'
  ).all().catch(() => ({ results: [] }))).results || [];
  return json({ entries: rows });
}

export async function onRequestPost({ request, env, data }) {
  const user = data && data.user;
  if (!isAdmin(user)) return json({ error: 'forbidden' }, 403);
  if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, 500);
  let body;
  try { body = await request.json(); } catch { body = null; }
  const raw = body && Array.isArray(body.entries) ? body.entries : null;
  if (!raw) return json({ ok: false, error: 'entries_required' }, 400);

  // 검증 + 정규화.
  const clean = [];
  for (const e of raw) {
    const st = String(e.subject_type || '');
    const subj = String(e.subject || '').trim();
    const fk = String(e.folder_key || '');
    const lv = String(e.level || '').toUpperCase();
    if (!SUBJECT_TYPES.has(st) || !subj || !FOLDER_KEYS.includes(fk) || !LEVELS.has(lv)) {
      return json({ ok: false, error: 'invalid_entry', entry: e }, 400);
    }
    clean.push({ st, subj, fk, lv });
  }

  // 전체 교체(트랜잭션 대용 batch).
  const stmts = [env.DB.prepare('DELETE FROM nas_acl')];
  const ins = env.DB.prepare(
    'INSERT OR REPLACE INTO nas_acl(subject_type, subject, folder_key, level) VALUES(?,?,?,?)'
  );
  for (const c of clean) stmts.push(ins.bind(c.st, c.subj, c.fk, c.lv));
  await env.DB.batch(stmts);

  await writeAudit(env, {
    event: 'nas.acl.update', severity: 'WARN', sub: String((user && (user.sub || user.id)) || ''),
    action: 'acl_replace', result: 'ok', count: clean.length,
    ip: request.headers.get('cf-connecting-ip'),
  }).catch(() => {});
  return json({ ok: true, count: clean.length });
}
