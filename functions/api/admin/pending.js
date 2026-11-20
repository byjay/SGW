// GET /api/admin/pending → 승인 대기(가입 신청) 목록 + 건수.
//   관리자 화면의 배지/목록용. ponytail: 별도 메일 인프라를 만들지 않는다 —
//   관리자가 이미 매일 보는 화면의 pending 카운트로 충분하다.
// 권한: 매니저 이상.
import { isManager } from '../../_lib/sgw-roles.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function onRequestGet({ env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, 500);
    if (!isManager(data && data.user)) return json({ ok: false, error: 'forbidden' }, 403);

    const res = await env.DB.prepare(
      "SELECT id, name, email, google_email, google_linked_at, join_date, status FROM sgw_users WHERE status = 'pending'"
    ).all();

    const pending = (res.results || [])
      .filter((r) => String(r.status || '').toLowerCase() === 'pending')
      .map((r) => ({
        id: String(r.id),
        name: r.name || '',
        email: r.email || '',
        googleEmail: r.google_email || '',
        requestedAt: r.google_linked_at == null ? null : Number(r.google_linked_at),
        joinDate: r.join_date || '',
      }));

    return json({ ok: true, count: pending.length, pending });
  } catch {
    return json({ ok: false, error: 'pending_failed' }, 500);
  }
}
