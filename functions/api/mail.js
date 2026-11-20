// SGW 사내메일(internal_mail) — Cloudflare D1 backed 1:1 internal mail.
// Table: internal_mail(id, sender_id, sender_name, recipient_id, recipient_name,
//                      subject, body, is_read, created_at)
// GET    /api/mail                 -> { mail: [...] }  본인(발신/수신)분만 (토큰 sub 강제)
// GET    /api/mail?box=inbox       -> 수신함만 / ?box=sent -> 발신함만
// POST   /api/mail                 신규 발송 (발신자 = 토큰 신원 강제)
// PUT    /api/mail?id=...          읽음 처리(수신자만) — body {isRead:true}
// DELETE /api/mail?id=...          삭제 (발신/수신 당사자만)

import { LIMITS, over } from '../_lib/validate.js';
import { ownsRow } from '../_lib/row-own.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// D1 row → Mail (snake→camel, 0/1→boolean)
const rowToMail = (r) => ({
  id: String(r.id),
  senderId: r.sender_id == null ? '' : String(r.sender_id),
  senderName: r.sender_name == null ? '' : String(r.sender_name),
  recipientId: r.recipient_id == null ? '' : String(r.recipient_id),
  recipientName: r.recipient_name == null ? '' : String(r.recipient_name),
  subject: r.subject == null ? '' : String(r.subject),
  body: r.body == null ? '' : String(r.body),
  isRead: !!r.is_read,
  createdAt: Number(r.created_at) || 0,
});

// 당사자(발신/수신자) 확인.
const partyOf = async (env, id, uid) => {
  const r = await env.DB.prepare('SELECT sender_id, recipient_id FROM internal_mail WHERE id = ?')
    .bind(String(id)).first();
  if (!r) return false;
  return String(r.sender_id) === uid || String(r.recipient_id) === uid;
};

export async function onRequestGet({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ mail: [] }, 500);
    const user = data && data.user;
    const uid = user && user.sub ? String(user.sub) : '';
    if (!uid) return json({ mail: [] }, 400);

    const box = new URL(request.url).searchParams.get('box');
    let res;
    if (box === 'inbox') {
      res = await env.DB.prepare(
        'SELECT * FROM internal_mail WHERE recipient_id = ? ORDER BY created_at DESC'
      ).bind(uid).all();
    } else if (box === 'sent') {
      res = await env.DB.prepare(
        'SELECT * FROM internal_mail WHERE sender_id = ? ORDER BY created_at DESC'
      ).bind(uid).all();
    } else {
      res = await env.DB.prepare(
        'SELECT * FROM internal_mail WHERE sender_id = ? OR recipient_id = ? ORDER BY created_at DESC'
      ).bind(uid, uid).all();
    }

    const mail = (res.results || []).map(rowToMail);
    return json({ mail });
  } catch (e) {
    return json({ mail: [], error: 'db_error' }, 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    const user = data && data.user;
    const uid = user && user.sub ? String(user.sub) : '';
    if (!uid) return json({ ok: false, error: 'auth_required' }, 401);

    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);
    if (over(body.subject, LIMITS.title)) return json({ ok: false, error: 'subject_too_long' }, 400);
    if (over(body.body, LIMITS.content)) return json({ ok: false, error: 'body_too_long' }, 400);
    if (body.recipientId == null || String(body.recipientId) === '') {
      return json({ ok: false, error: 'recipient_required' }, 400);
    }

    const id = body.id != null && body.id !== '' ? String(body.id) : `mail_${Date.now()}`;
    // ★ 남의 메일 행 덮어쓰기 차단(클라 지정 id + INSERT OR REPLACE).
    if (!(await ownsRow(env, 'internal_mail', ['sender_id', 'recipient_id'], id, uid))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
    const createdAt = Number(body.createdAt) || Date.now();

    await env.DB.prepare(
      'INSERT OR REPLACE INTO internal_mail(id, sender_id, sender_name, recipient_id, recipient_name, subject, body, is_read, created_at) VALUES(?,?,?,?,?,?,?,?,?)'
    )
      .bind(
        id,
        // 발신자는 토큰 신원(sub)으로 강제 — 타인 명의 발송 차단.
        uid,
        (user && user.name) ? String(user.name) : (body.senderName == null ? '' : String(body.senderName)),
        String(body.recipientId),
        body.recipientName == null ? '' : String(body.recipientName),
        body.subject == null ? '' : String(body.subject),
        body.body == null ? '' : String(body.body),
        body.isRead ? 1 : 0,
        createdAt
      )
      .run();

    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}

export async function onRequestPut({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    const user = data && data.user;
    const uid = user && user.sub ? String(user.sub) : '';
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ ok: false, error: 'id required' }, 400);

    // 읽음 처리는 수신자만.
    const r = await env.DB.prepare('SELECT recipient_id FROM internal_mail WHERE id = ?')
      .bind(String(id)).first();
    if (!r) return json({ ok: false, error: 'not_found' }, 404);
    if (String(r.recipient_id) !== uid) return json({ ok: false, error: 'forbidden' }, 403);

    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const isRead = body && body.isRead === false ? 0 : 1;
    await env.DB.prepare('UPDATE internal_mail SET is_read = ? WHERE id = ?')
      .bind(isRead, String(id))
      .run();
    return json({ ok: true, id: String(id) });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}

export async function onRequestDelete({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    const user = data && data.user;
    const uid = user && user.sub ? String(user.sub) : '';
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ ok: false, error: 'id required' }, 400);
    if (!(await partyOf(env, id, uid))) return json({ ok: false, error: 'forbidden' }, 403);
    await env.DB.prepare('DELETE FROM internal_mail WHERE id = ?')
      .bind(String(id))
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
