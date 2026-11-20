// 사전 허용목록(초대) CRUD — 회사 도메인 밖 구글 계정의 가입 경로 B.
//   GET    /api/admin/invites            → { ok, invites: [...] }
//   POST   /api/admin/invites            {email, role, department?, position?, note?}
//   DELETE /api/admin/invites?email=...
// 권한: 매니저 이상. **role='admin' 부여는 admin만**(_lib/sgw-roles.js canGrantRole).
import { isManager, canGrantRole } from '../../_lib/sgw-roles.js';
import { LIMITS, over, isValidEmail } from '../../_lib/validate.js';
import { writeAudit } from '../../_lib/audit.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function onRequestGet({ env, data }) {
  if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, 500);
  if (!isManager(data && data.user)) return json({ ok: false, error: 'forbidden' }, 403);
  const res = await env.DB.prepare(
    'SELECT email, role, department, position, note, created_by, created_at, used_at FROM sgw_invites'
  ).all();
  return json({ ok: true, invites: res.results || [] });
}

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, 500);
    const actor = data && data.user;
    if (!isManager(actor)) return json({ ok: false, error: 'forbidden' }, 403);

    let body;
    try { body = await request.json(); } catch { body = null; }
    if (!body) return json({ ok: false, error: 'body required' }, 400);

    const email = String(body.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) return json({ ok: false, error: 'invalid_email' }, 400);
    if (over(body.department, LIMITS.name) || over(body.position, LIMITS.name) || over(body.note, LIMITS.reason)) {
      return json({ ok: false, error: 'too_long' }, 400);
    }

    // 역할 화이트리스트 + 권한 상승 방지(매니저는 admin 부여 불가).
    const grant = canGrantRole(actor, body.role == null ? 'user' : body.role);
    if (!grant.ok) return json({ ok: false, error: grant.error }, grant.status);

    await env.DB.prepare(
      `INSERT OR REPLACE INTO sgw_invites(email, role, department, position, note, created_by, created_at, used_at)
       VALUES(?,?,?,?,?,?,?,?)`
    ).bind(
      email, grant.role,
      String(body.department || ''), String(body.position || ''), String(body.note || ''),
      String(actor.sub || ''), Date.now(), null
    ).run();

    await writeAudit(env, {
      event: 'admin.invite.create', severity: 'INFO', sub: String(actor.sub || ''),
      meta: { email, role: grant.role },
    });
    return json({ ok: true, email, role: grant.role });
  } catch {
    return json({ ok: false, error: 'invite_failed' }, 500);
  }
}

export async function onRequestDelete({ request, env, data }) {
  if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, 500);
  const actor = data && data.user;
  if (!isManager(actor)) return json({ ok: false, error: 'forbidden' }, 403);
  const email = String(new URL(request.url).searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return json({ ok: false, error: 'email required' }, 400);
  await env.DB.prepare('DELETE FROM sgw_invites WHERE lower(email) = ?').bind(email).run();
  await writeAudit(env, {
    event: 'admin.invite.delete', severity: 'INFO', sub: String(actor.sub || ''), meta: { email },
  });
  return json({ ok: true, email });
}
