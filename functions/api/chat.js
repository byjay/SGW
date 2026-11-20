// SGW 채팅(chat) — Cloudflare D1 backed cross-browser 1:1 chat.
// Tables:
//   chat_rooms(id, participants(JSON), last_message, last_message_time, last_message_sender_id)
//   chat_messages(id, room_id, sender_id, sender_name, content, ts, read_by(JSON))

import { LIMITS, over } from '../_lib/validate.js';
import { ownsRow } from '../_lib/row-own.js';

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

const rowToChatMessage = (r) => {
  const m = {
    id: String(r.id),
    roomId: String(r.room_id),
    senderId: r.sender_id == null ? '' : String(r.sender_id),
    content: r.content == null ? '' : String(r.content),
    timestamp: Number(r.ts) || 0,
    readBy: parseJSON(r.read_by, []),
  };
  if (r.file_name) m.fileName = String(r.file_name);
  if (r.file_data) m.fileData = String(r.file_data);
  return m;
};

// 방 참여자 여부. 방이 없으면 true(신규 생성 허용) — 있으면 명단에 있어야 한다.
async function isParticipant(env, roomId, uid) {
  const room = await env.DB.prepare('SELECT participants FROM chat_rooms WHERE id = ?')
    .bind(String(roomId))
    .first()
    .catch(() => null);
  if (!room) return true;
  const parts = parseJSON(room.participants, []);
  return Array.isArray(parts) && parts.map(String).includes(String(uid));
}

export async function onRequestGet({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ messages: [], rooms: [] }, 500);
    const user = data && data.user;
    const uid = user && user.sub ? String(user.sub) : '';
    const url = new URL(request.url);
    const roomId = url.searchParams.get('roomId');
    const wantRooms = url.searchParams.has('userId');

    // 방 메시지 목록 — 참여자(sub)만 열람.
    if (roomId) {
      const room = await env.DB.prepare('SELECT participants FROM chat_rooms WHERE id = ?')
        .bind(String(roomId)).first();
      const parts = room ? parseJSON(room.participants, []) : [];
      if (!Array.isArray(parts) || !parts.map(String).includes(uid)) {
        return json({ messages: [], error: 'forbidden' }, 403);
      }
      const res = await env.DB.prepare(
        'SELECT * FROM chat_messages WHERE room_id = ? ORDER BY ts ASC'
      )
        .bind(String(roomId))
        .all();
      const messages = (res.results || []).map(rowToChatMessage);
      return json({ messages });
    }

    // 사용자가 속한 방 목록 (participants JSON에 sub 포함) — 항상 토큰 신원 기준.
    if (wantRooms) {
      const res = await env.DB.prepare(
        'SELECT * FROM chat_rooms ORDER BY last_message_time DESC'
      ).all();
      const rooms = (res.results || [])
        .map(rowToRoom)
        .filter((r) => Array.isArray(r.participants) && r.participants.map(String).includes(uid));
      return json({ rooms });
    }

    return json({ messages: [], rooms: [] }, 400);
  } catch (e) {
    return json({ messages: [], rooms: [], error: 'db_error' }, 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    const user = data && data.user;
    const uid = user && user.sub ? String(user.sub) : '';
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);

    // 방 생성/갱신(upsert) — startChat 대응. 생성자는 반드시 참여자에 포함.
    if (action === 'room') {
      if (over(body.lastMessage, LIMITS.content)) return json({ ok: false, error: 'too_long' }, 400);
      const id = body.id != null && body.id !== '' ? String(body.id) : `room_${Date.now()}`;
      const participants = Array.isArray(body.participants) ? body.participants.map(String) : [];
      if (uid && !participants.includes(uid)) return json({ ok: false, error: 'forbidden' }, 403);
      // ★ 기존 방 탈취 차단: 이미 있는 방이면 **현재 참여자**만 갱신(참여자 명단 교체) 가능.
      //   (없으면 임의의 id로 INSERT OR REPLACE 해서 남의 방 참여자에 자신을 넣고
      //    그 방의 대화 전체를 열람할 수 있다 — IDOR)
      if (!(await isParticipant(env, id, uid))) {
        return json({ ok: false, error: 'forbidden' }, 403);
      }
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
    if (over(body.content, LIMITS.content)) return json({ ok: false, error: 'too_long' }, 400);
    if (over(body.fileData, LIMITS.fileB64)) return json({ ok: false, error: 'file_too_large' }, 400);
    const id = body.id != null && body.id !== '' ? String(body.id) : `msg_${Date.now()}`;
    const roomId = body.roomId == null ? '' : String(body.roomId);
    // ★ 참여자만 발신 — 임의 roomId로 남의 대화방에 메시지를 주입하는 경로 차단.
    if (!roomId || !(await isParticipant(env, roomId, uid))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
    // ★ 남의 메시지 행 덮어쓰기 차단(클라 지정 id + INSERT OR REPLACE).
    if (!(await ownsRow(env, 'chat_messages', ['sender_id'], id, uid))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
    // 발신자는 토큰 신원(sub)으로 강제.
    const senderId = uid || (body.senderId == null ? '' : String(body.senderId));
    const ts = Number(body.ts != null ? body.ts : body.timestamp) || Date.now();
    const readBy = Array.isArray(body.readBy) ? body.readBy.map(String) : [senderId];

    await env.DB.prepare(
      'INSERT OR REPLACE INTO chat_messages(id, room_id, sender_id, sender_name, content, ts, read_by, file_name, file_data) VALUES(?,?,?,?,?,?,?,?,?)'
    )
      .bind(
        id,
        roomId,
        senderId,
        body.senderName == null ? '' : String(body.senderName),
        body.content == null ? '' : String(body.content),
        ts,
        JSON.stringify(readBy),
        body.fileName == null ? null : String(body.fileName),
        body.fileData == null ? null : String(body.fileData)
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
