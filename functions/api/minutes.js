// SGW 회의록(minutes) — Cloudflare D1 backed meeting minutes.
// Table: minutes(id, author_id, author_name, title, content, attendees,
//                meeting_date, doc_data, created_at, updated_at)
// 열람은 전직원(인증된 사용자) 허용, 작성/수정/삭제는 작성자(또는 매니저)만.
// GET    /api/minutes            -> { minutes: [...] }  전체(목록은 doc_data 제외 — 경량)
// GET    /api/minutes?id=...     -> { minutes: [one] }  단건(doc_data 포함)
// POST   /api/minutes            신규 (author_id = 토큰 sub 강제)
// PUT    /api/minutes?id=...     수정 (작성자 또는 매니저)
// DELETE /api/minutes?id=...     삭제 (작성자 또는 매니저)

import { isManager } from '../_lib/sgw-roles.js';
import { LIMITS, over } from '../_lib/validate.js';
import { ownsRow } from '../_lib/row-own.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const ATTENDEES_MAX = 2000;

// D1 row → Minutes (snake→camel). withDoc=false 면 doc_data 생략(목록 경량화).
const rowToMinutes = (r, withDoc) => {
  const m = {
    id: String(r.id),
    authorId: r.author_id == null ? '' : String(r.author_id),
    authorName: r.author_name == null ? '' : String(r.author_name),
    title: r.title == null ? '' : String(r.title),
    content: r.content == null ? '' : String(r.content),
    attendees: r.attendees == null ? '' : String(r.attendees),
    meetingDate: r.meeting_date == null ? '' : String(r.meeting_date),
    hasDoc: !!r.doc_data,
    createdAt: Number(r.created_at) || 0,
    updatedAt: Number(r.updated_at) || 0,
  };
  if (withDoc && r.doc_data) m.docData = String(r.doc_data);
  return m;
};

// 작성자 또는 매니저만 수정/삭제.
const canEdit = async (env, id, uid, mgr) => {
  const r = await env.DB.prepare('SELECT author_id FROM minutes WHERE id = ?')
    .bind(String(id)).first();
  if (!r) return false;
  return mgr || String(r.author_id) === uid;
};

export async function onRequestGet({ request, env }) {
  try {
    if (!env || !env.DB) return json({ minutes: [] }, 500);
    const id = new URL(request.url).searchParams.get('id');

    // 단건 조회 — 첨부(base64 docx) 포함.
    if (id) {
      const r = await env.DB.prepare('SELECT * FROM minutes WHERE id = ?')
        .bind(String(id)).first();
      if (!r) return json({ minutes: [], error: 'not_found' }, 404);
      return json({ minutes: [rowToMinutes(r, true)] });
    }

    // 목록 — doc_data 제외(응답 폭증 방지).
    const res = await env.DB.prepare(
      'SELECT id, author_id, author_name, title, content, attendees, meeting_date, created_at, updated_at, (doc_data IS NOT NULL) AS doc_data FROM minutes ORDER BY created_at DESC'
    ).all();

    return json({ minutes: (res.results || []).map((r) => rowToMinutes(r, false)) });
  } catch (e) {
    return json({ minutes: [], error: 'db_error' }, 500);
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
    if (over(body.title, LIMITS.title)) return json({ ok: false, error: 'title_too_long' }, 400);
    if (over(body.content, LIMITS.content)) return json({ ok: false, error: 'content_too_long' }, 400);
    if (over(body.attendees, ATTENDEES_MAX)) return json({ ok: false, error: 'attendees_too_long' }, 400);
    if (over(body.docData, LIMITS.fileB64)) return json({ ok: false, error: 'file_too_large' }, 400);

    const id = body.id != null && body.id !== '' ? String(body.id) : `minutes_${Date.now()}`;
    // ★ 남의 회의록 덮어쓰기 차단 — POST 는 canEdit 를 안 거치므로 여기서 막지 않으면
    //   PUT 권한 검사를 우회해 임의 회의록을 통째로 교체할 수 있다.
    if (!isManager(user) && !(await ownsRow(env, 'minutes', ['author_id'], id, uid))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
    const ts = Date.now();
    const createdAt = Number(body.createdAt) || ts;

    await env.DB.prepare(
      'INSERT OR REPLACE INTO minutes(id, author_id, author_name, title, content, attendees, meeting_date, doc_data, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)'
    )
      .bind(
        id,
        // 작성자는 토큰 신원(sub)으로 강제 — 타인 명의 저장 차단.
        uid,
        (user && user.name) ? String(user.name) : (body.authorName == null ? '' : String(body.authorName)),
        body.title == null ? '' : String(body.title),
        body.content == null ? '' : String(body.content),
        body.attendees == null ? '' : String(body.attendees),
        body.meetingDate == null ? '' : String(body.meetingDate),
        body.docData == null || body.docData === '' ? null : String(body.docData),
        createdAt,
        ts
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
    const mgr = isManager(user);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ ok: false, error: 'id required' }, 400);
    if (!(await canEdit(env, id, uid, mgr))) return json({ ok: false, error: 'forbidden' }, 403);

    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);
    if (over(body.title, LIMITS.title)) return json({ ok: false, error: 'title_too_long' }, 400);
    if (over(body.content, LIMITS.content)) return json({ ok: false, error: 'content_too_long' }, 400);
    if (over(body.attendees, ATTENDEES_MAX)) return json({ ok: false, error: 'attendees_too_long' }, 400);
    if (over(body.docData, LIMITS.fileB64)) return json({ ok: false, error: 'file_too_large' }, 400);

    const map = {
      title: 'title',
      content: 'content',
      attendees: 'attendees',
      meetingDate: 'meeting_date',
      docData: 'doc_data',
    };
    const sets = [];
    const vals = [];
    for (const [k, col] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${col} = ?`);
        // docData 는 빈 문자열이면 NULL(첨부 제거)로 저장.
        vals.push(k === 'docData' && (body[k] === null || body[k] === '') ? null : String(body[k]));
      }
    }
    if (sets.length === 0) return json({ ok: true, id: String(id) });
    sets.push('updated_at = ?');
    vals.push(Date.now(), String(id));

    await env.DB.prepare(`UPDATE minutes SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...vals)
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
    const mgr = isManager(user);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ ok: false, error: 'id required' }, 400);
    if (!(await canEdit(env, id, uid, mgr))) return json({ ok: false, error: 'forbidden' }, 403);
    await env.DB.prepare('DELETE FROM minutes WHERE id = ?')
      .bind(String(id))
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
