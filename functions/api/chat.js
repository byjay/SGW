// SGW 채팅(chat) — Cloudflare D1 backed cross-browser 1:1 chat.
// Tables:
//   chat_rooms(id, participants(JSON), last_message, last_message_time, last_message_sender_id)
//   chat_messages(id, room_id, sender_id, sender_name, content, ts, read_by(JSON))

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const parseJSON = (s, fallback) => {
  if (s == null) return fallback;
  try {
    const v = JSON.parse(s);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
};

const rowToRoom = (r) => ({
  id: String(r.id),
  participants: parseJSON(r.participants, []),
  lastMessage: r.last_message == null ? '' : String(r.last_message),
  lastMessageTime: Number(r.last_message_time) || 0,
  ...(r.last_message_sender_id != null
    ? { lastMessageSenderId: String(r.last_message_sender_id) }
    : {}),
});

const rowToChatMessage = (r) => ({
  id: String(r.id),
  roomId: String(r.room_id),
  senderId: r.sender_id == null ? '' : String(r.sender_id),
  content: r.content == null ? '' : String(r.content),
  timestamp: Number(r.ts) || 0,
  readBy: parseJSON(r.read_by, []),
});

export async function onRequestGet({ request, env }) {
  try {
    if (!env || !env.DB) return json({ messages: [], rooms: [] }, 500);
    const url = new URL(request.url);
    const roomId = url.searchParams.get('roomId');
    const userId = url.searchParams.get('userId');

    // 방 메시지 목록
    if (roomId) {
      const res = await env.DB.prepare(
        'SELECT * FROM chat_messages WHERE room_id = ? ORDER BY ts ASC'
      )
        .bind(String(roomId))
        .all();
      const messages = (res.results || []).map(rowToChatMessage);
      return json({ messages });
    }

    // 사용자가 속한 방 목록 (participants JSON에 userId 포함)
    if (userId) {
      const res = await env.DB.prepare(
        'SELECT * FROM chat_rooms ORDER BY last_message_time DESC'
      ).all();
      const uid = String(userId);
      const rooms = (res.results || [])
        .map(rowToRoom)
        .filter((r) => Array.isArray(r.participants) && r.participants.includes(uid));
      return json({ rooms });
    }

    return json({ messages: [], rooms: [] }, 400);
  } catch (e) {
    return json({ messages: [], rooms: [] }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);

    // 방 생성/갱신(upsert) — startChat 대응
    if (action === 'room') {
      const id = body.id != null && body.id !== '' ? String(body.id) : `room_${Date.now()}`;
      const participants = Array.isArray(body.participants) ? body.participants.map(String) : [];
      await env.DB.prepare(
        'INSERT OR REPLACE INTO chat_rooms(id, participants, last_message, last_message_time, last_message_sender_id) VALUES(?,?,?,?,?)'
      )
        .bind(
          id,
          JSON.stringify(participants),
          body.lastMessage == null ? '' : String(body.lastMessage),
          Number(body.lastMessageTime) || Date.now(),
          body.lastMessageSenderId == null ? null : String(body.lastMessageSenderId)
        )
        .run();
      return json({ ok: true, id });
    }

    // 채팅 메시지 INSERT + 방 마지막 메시지 갱신
    const id = body.id != null && body.id !== '' ? String(body.id) : `msg_${Date.now()}`;
    const roomId = body.roomId == null ? '' : String(body.roomId);
    const senderId = body.senderId == null ? '' : String(body.senderId);
    const ts = Number(body.ts != null ? body.ts : body.timestamp) || Date.now();
    const readBy = Array.isArray(body.readBy) ? body.readBy.map(String) : [senderId];

    await env.DB.prepare(
      'INSERT OR REPLACE INTO chat_messages(id, room_id, sender_id, sender_name, content, ts, read_by) VALUES(?,?,?,?,?,?,?)'
    )
      .bind(
        id,
        roomId,
        senderId,
        body.senderName == null ? '' : String(body.senderName),
        body.content == null ? '' : String(body.content),
        ts,
        JSON.stringify(readBy)
      )
      .run();

    // 방이 있으면 마지막 메시지 갱신 (없으면 생성)
    await env.DB.prepare(
      'UPDATE chat_rooms SET last_message = ?, last_message_time = ?, last_message_sender_id = ? WHERE id = ?'
    )
      .bind(
        body.content == null ? '' : String(body.content),
        ts,
        senderId,
        roomId
      )
      .run();

    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
