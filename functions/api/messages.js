// SGW 쪽지(messages) — Cloudflare D1 backed cross-browser direct messages.
// Table: messages(id, sender_id, sender_name, receiver_id, receiver_name,
//                  content, ts, is_read, file_name, file_data)

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

export async function onRequestGet({ request, env }) {
  try {
    if (!env || !env.DB) return json({ messages: [] }, 500);
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return json({ messages: [] }, 400);

    const res = await env.DB.prepare(
      'SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? ORDER BY ts ASC'
    )
      .bind(String(userId), String(userId))
      .all();

    const messages = (res.results || []).map(rowToMessage);
    return json({ messages });
  } catch (e) {
    return json({ messages: [] }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // 대화 일괄 읽음 처리: 상대(otherId)→나(userId) 메시지 전부 read
    if (action === 'read') {
      const userId = url.searchParams.get('userId');
      const otherId = url.searchParams.get('otherId');
      if (!userId || !otherId) return json({ ok: false }, 400);
      await env.DB.prepare(
        'UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ?'
      )
        .bind(String(userId), String(otherId))
        .run();
      return json({ ok: true });
    }

    // 단일 메시지 읽음 처리
    if (action === 'readone') {
      const id = url.searchParams.get('id');
      if (!id) return json({ ok: false }, 400);
      await env.DB.prepare('UPDATE messages SET is_read = 1 WHERE id = ?')
        .bind(String(id))
        .run();
      return json({ ok: true });
    }

    // 삭제
    if (action === 'delete') {
      const id = url.searchParams.get('id');
      if (!id) return json({ ok: false }, 400);
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

    const id = body.id != null && body.id !== '' ? String(body.id) : `msg_${Date.now()}`;
    const ts = Number(body.timestamp) || Date.now();

    await env.DB.prepare(
      'INSERT OR REPLACE INTO messages(id, sender_id, sender_name, receiver_id, receiver_name, content, ts, is_read, file_name, file_data) VALUES(?,?,?,?,?,?,?,?,?,?)'
    )
      .bind(
        id,
        body.senderId == null ? '' : String(body.senderId),
        body.senderName == null ? '' : String(body.senderName),
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
