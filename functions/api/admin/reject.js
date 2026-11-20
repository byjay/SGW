// POST /api/admin/reject {userId, reason?}
//   가입 신청 거절 → status='rejected'. 이후 구글 로그인 시 403(account_disabled),
//   기존에 발급된 토큰도 _middleware.js 의 status 재확인으로 즉시 차단된다.
// 권한: 매니저 이상.
import { isManager } from '../../_lib/sgw-roles.js';
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
    if (over(body.reason, LIMITS.reason)) return json({ ok: false, error: 'too_long' }, 400);

    const row = await env.DB.prepare('SELECT id, email, status FROM sgw_users WHERE id = ?')
      .bind(userId).first();
    if (!row) return json({ ok: false, error: 'not_found' }, 404);

    await env.DB.prepare("UPDATE sgw_users SET status = 'rejected' WHERE id = ?").bind(userId).run();

    await writeAudit(env, {
      event: 'admin.user.reject', severity: 'WARN', sub: String(actor.sub || ''),
      meta: { userId, email: row.email || '', reason: String(body.reason || '') },
    });
    return json({ ok: true, userId, status: 'rejected' });
  } catch {
    return json({ ok: false, error: 'reject_failed' }, 500);
  }
}
