// SGW 쪽지(messages) — Cloudflare D1 backed cross-browser direct messages.
// Table: messages(id, sender_id, sender_name, receiver_id, receiver_name,
//                  content, ts, is_read, file_name, file_data)

import { LIMITS, over } from '../_lib/validate.js';
import { ownsRow } from '../_lib/row-own.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// D1 row → Message (snake→camel, 0/1→boolean, ts→timestamp)
const rowToMessage = (r) => {
  const m = {
    id: String(r.id),
    senderId: r.sender_id == null ? '' : String(r.sender_id),
    senderName: r.sender_name == null ? '' : String(r.sender_name),
    receiverId: r.receiver_id == null ? '' : String(r.receiver_id),
    receiverName: r.receiver_name == null ? '' : String(r.receiver_name),
    content: r.content == null ? '' : String(r.content),
    timestamp: Number(r.ts) || 0,
    isRead: !!r.is_read,
  };
  if (r.file_name) m.fileName = String(r.file_name);
  if (r.file_data) m.fileData = String(r.file_data);
  return m;
};

export async function onRequestGet({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ messages: [] }, 500);
    // 본인 쪽지만 — 토큰 신원(sub) 강제(?userId 신뢰 안 함).
    const user = data && data.user;
    const userId = user && user.sub ? String(user.sub) : '';
    if (!userId) return json({ messages: [] }, 400);

    const res = await env.DB.prepare(
      'SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? ORDER BY ts ASC'
    )
      .bind(String(userId), String(userId))
      .all();

    const messages = (res.results || []).map(rowToMessage);
    return json({ messages });
  } catch (e) {
    return json({ messages: [], error: 'db_error' }, 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    const user = data && data.user;
    const uid = user && user.sub ? String(user.sub) : '';
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // 대화 일괄 읽음 처리: 상대(otherId)→나(sub) 메시지 전부 read
    if (action === 'read') {
      const userId = uid;
      const otherId = url.searchParams.get('otherId');
      if (!userId || !otherId) return json({ ok: false }, 400);
      await env.DB.prepare(
        'UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ?'
      )
        .bind(String(userId), String(otherId))
        .run();
      return json({ ok: true });
    }

    // 대화 당사자(발신/수신자) 확인.
    const partyOf = async (id) => {
      const r = await env.DB.prepare('SELECT sender_id, receiver_id FROM messages WHERE id = ?')
        .bind(String(id)).first();
      if (!r) return false;
      return String(r.sender_id) === uid || String(r.receiver_id) === uid;
    };

    // 단일 메시지 읽음 처리 (당사자만)
    if (action === 'readone') {
      const id = url.searchParams.get('id');
      if (!id) return json({ ok: false }, 400);
      if (!(await partyOf(id))) return json({ ok: false, error: 'forbidden' }, 403);
      await env.DB.prepare('UPDATE messages SET is_read = 1 WHERE id = ?')
        .bind(String(id))
        .run();
      return json({ ok: true });
    }

    // 삭제 (당사자만)
    if (action === 'delete') {
      const id = url.searchParams.get('id');
      if (!id) return json({ ok: false }, 400);
      if (!(await partyOf(id))) return json({ ok: false, error: 'forbidden' }, 403);
      await env.DB.prepare('DELETE FROM messages WHERE id = ?')
        .bind(String(id))
        .run();
      return json({ ok: true });
    }

    // 신규 쪽지 INSERT
    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);
    if (over(body.content, LIMITS.content)) return json({ ok: false, error: 'too_long' }, 400);
    if (over(body.fileData, LIMITS.fileB64)) return json({ ok: false, error: 'file_too_large' }, 400);

    const id = body.id != null && body.id !== '' ? String(body.id) : `msg_${Date.now()}`;
    // ★ 남의 쪽지 행 덮어쓰기 차단 (클라 지정 id + INSERT OR REPLACE).
    if (!(await ownsRow(env, 'messages', ['sender_id', 'receiver_id'], id, uid))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
    const ts = Number(body.timestamp) || Date.now();

    await env.DB.prepare(
      'INSERT OR REPLACE INTO messages(id, sender_id, sender_name, receiver_id, receiver_name, content, ts, is_read, file_name, file_data) VALUES(?,?,?,?,?,?,?,?,?,?)'
    )
      .bind(
        id,
        // 발신자는 토큰 신원(sub)으로 강제 — 타인 명의 발송 차단.
        uid || (body.senderId == null ? '' : String(body.senderId)),
        (user && user.name) ? String(user.name) : (body.senderName == null ? '' : String(body.senderName)),
        body.receiverId == null ? '' : String(body.receiverId),
        body.receiverName == null ? '' : String(body.receiverName),
        body.content == null ? '' : String(body.content),
        ts,
        body.isRead ? 1 : 0,
        body.fileName == null ? null : String(body.fileName),
        body.fileData == null ? null : String(body.fileData)
      )
      .run();

    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
