// SGW 개인 메모(memos) — Cloudflare D1 backed personal notes.
// Table: memos(id, user_id, title, content, created_at, updated_at)
// 소유자 전용: 조회·작성·수정·삭제 모두 토큰 신원(sub) 스코프. 타인 메모 접근 불가.
// GET    /api/memos          -> { memos: [...] }  본인 것만
// POST   /api/memos          신규 (user_id = 토큰 sub 강제)
// PUT    /api/memos?id=...   수정 (소유자만) — body {title?, content?}
// DELETE /api/memos?id=...   삭제 (소유자만)

import { LIMITS, over } from '../_lib/validate.js';
import { ownsRow } from '../_lib/row-own.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// D1 row → Memo (snake→camel)
const rowToMemo = (r) => ({
  id: String(r.id),
  userId: r.user_id == null ? '' : String(r.user_id),
  title: r.title == null ? '' : String(r.title),
  content: r.content == null ? '' : String(r.content),
  createdAt: Number(r.created_at) || 0,
  updatedAt: Number(r.updated_at) || 0,
});

// 소유권 확인(본인 메모만 수정/삭제).
const ownsMemo = async (env, id, uid) => {
  const r = await env.DB.prepare('SELECT user_id FROM memos WHERE id = ?')
    .bind(String(id)).first();
  return !!r && String(r.user_id) === uid;
};

export async function onRequestGet({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ memos: [] }, 500);
    const user = data && data.user;
    const uid = user && user.sub ? String(user.sub) : '';
    if (!uid) return json({ memos: [] }, 400);

    const res = await env.DB.prepare(
      'SELECT * FROM memos WHERE user_id = ? ORDER BY updated_at DESC'
    ).bind(uid).all();

    return json({ memos: (res.results || []).map(rowToMemo) });
  } catch (e) {
    return json({ memos: [], error: 'db_error' }, 500);
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

    const id = body.id != null && body.id !== '' ? String(body.id) : `memo_${Date.now()}`;
    // ★ 남의 메모 행 덮어쓰기(=탈취/소실) 차단. 클라 지정 id + INSERT OR REPLACE 경로.
    if (!(await ownsRow(env, 'memos', ['user_id'], id, uid))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
    const ts = Date.now();
    const createdAt = Number(body.createdAt) || ts;

    await env.DB.prepare(
      'INSERT OR REPLACE INTO memos(id, user_id, title, content, created_at, updated_at) VALUES(?,?,?,?,?,?)'
    )
      .bind(
        id,
        // 소유자는 토큰 신원(sub)으로 강제 — 타인 명의 저장 차단.
        uid,
        body.title == null ? '' : String(body.title),
        body.content == null ? '' : String(body.content),
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
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ ok: false, error: 'id required' }, 400);
    if (!(await ownsMemo(env, id, uid))) return json({ ok: false, error: 'forbidden' }, 403);

    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);
    if (over(body.title, LIMITS.title)) return json({ ok: false, error: 'title_too_long' }, 400);
    if (over(body.content, LIMITS.content)) return json({ ok: false, error: 'content_too_long' }, 400);

    const map = { title: 'title', content: 'content' };
    const sets = [];
    const vals = [];
    for (const [k, col] of Object.entries(map)) {
      if (body[k] !== undefined) {
        sets.push(`${col} = ?`);
        vals.push(String(body[k]));
      }
    }
    if (sets.length === 0) return json({ ok: true, id: String(id) });
    sets.push('updated_at = ?');
    vals.push(Date.now(), String(id));

    await env.DB.prepare(`UPDATE memos SET ${sets.join(', ')} WHERE id = ?`)
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
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ ok: false, error: 'id required' }, 400);
    if (!(await ownsMemo(env, id, uid))) return json({ ok: false, error: 'forbidden' }, 403);
    await env.DB.prepare('DELETE FROM memos WHERE id = ?')
      .bind(String(id))
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
