// POST /api/admin/approve {userId, role, department?, position?}
//   가입 신청(pending) 계정을 승인하고 역할을 부여한다 → status='active'.
// 권한: 매니저 이상. role='admin' 부여는 admin만(canGrantRole).
import { isManager, canGrantRole } from '../../_lib/sgw-roles.js';
import { LIMITS, over } from '../../_lib/validate.js';
import { writeAudit } from '../../_lib/audit.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, 500);
    const actor = data && data.user;
    if (!isManager(actor)) return json({ ok: false, error: 'forbidden' }, 403);

    let body;
    try { body = await request.json(); } catch { body = null; }
    if (!body) return json({ ok: false, error: 'body required' }, 400);

    const userId = String(body.userId == null ? '' : body.userId).trim();
    if (!userId) return json({ ok: false, error: 'userId required' }, 400);
    if (over(body.department, LIMITS.name) || over(body.position, LIMITS.name)) {
      return json({ ok: false, error: 'too_long' }, 400);
    }

    const grant = canGrantRole(actor, body.role == null ? 'user' : body.role);
    if (!grant.ok) return json({ ok: false, error: grant.error }, grant.status);

    const row = await env.DB.prepare('SELECT id, email, status FROM sgw_users WHERE id = ?')
      .bind(userId).first();
    if (!row) return json({ ok: false, error: 'not_found' }, 404);

    await env.DB.prepare(
      "UPDATE sgw_users SET status = 'active', role = ?, department = ?, position = ? WHERE id = ?"
    ).bind(
      grant.role,
      body.department == null ? '' : String(body.department),
      body.position == null ? '' : String(body.position),
      userId
    ).run();

    await writeAudit(env, {
      event: 'admin.user.approve', severity: 'INFO', sub: String(actor.sub || ''),
      meta: { userId, email: row.email || '', role: grant.role, prevStatus: row.status || '' },
    });
    return json({ ok: true, userId, role: grant.role, status: 'active' });
  } catch {
    return json({ ok: false, error: 'approve_failed' }, 500);
  }
}
