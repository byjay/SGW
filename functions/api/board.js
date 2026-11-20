// SGW 게시판/공지(posts + post_comments) — Cloudflare D1 backed cross-browser board.
// Tables: posts(id, type, author_id, author_name, title, content, timestamp, likes)
//         post_comments(id, post_id, author_id, author_name, content, timestamp)
// GET  /api/board                          -> { posts: [ {..., comments:[...] } ] }
// POST /api/board                          글 작성 (body = Post)
// POST /api/board?action=comment&postId=   댓글 (body = Comment)
// POST /api/board?action=like&postId=      좋아요 +1

import { isManager } from '../_lib/sgw-roles.js';
import { LIMITS, over } from '../_lib/validate.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const rowToComment = (r) => ({
  id: String(r.id),
  authorId: r.author_id == null ? '' : String(r.author_id),
  authorName: r.author_name == null ? '' : String(r.author_name),
  content: r.content == null ? '' : String(r.content),
  timestamp: Number(r.timestamp) || 0,
});

const rowToPost = (r, comments) => ({
  id: String(r.id),
  type: r.type === 'notice' ? 'notice' : 'normal',
  authorId: r.author_id == null ? '' : String(r.author_id),
  authorName: r.author_name == null ? '' : String(r.author_name),
  title: r.title == null ? '' : String(r.title),
  content: r.content == null ? '' : String(r.content),
  timestamp: Number(r.timestamp) || 0,
  likes: Number(r.likes) || 0,
  category: r.category == null ? '' : String(r.category),
  comments: comments || [],
});

export async function onRequestGet({ env }) {
  try {
    if (!env || !env.DB) return json({ posts: [] }, 500);

    const postsRes = await env.DB.prepare(
      'SELECT * FROM posts ORDER BY timestamp DESC'
    ).all();
    const commentsRes = await env.DB.prepare(
      'SELECT * FROM post_comments ORDER BY timestamp ASC'
    ).all();

    const byPost = {};
    for (const c of commentsRes.results || []) {
      const pid = String(c.post_id);
      (byPost[pid] = byPost[pid] || []).push(rowToComment(c));
    }

    const posts = (postsRes.results || []).map((r) =>
      rowToPost(r, byPost[String(r.id)])
    );
    return json({ posts });
  } catch (e) {
    return json({ posts: [], error: 'db_error' }, 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    const user = data && data.user;
    const uid = user && user.sub ? String(user.sub) : '';
    const uname = user && user.name ? String(user.name) : '';
    const mgr = isManager(user);
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // 대상 게시글의 작성자 확인(본인 글만 수정/삭제, 매니저 예외).
    const ownsPost = async (id) => {
      const r = await env.DB.prepare('SELECT author_id FROM posts WHERE id = ?')
        .bind(String(id)).first();
      return !r || String(r.author_id) === uid; // 신규 id면 통과, 기존이면 소유자만.
    };

    // 좋아요 +1
    if (action === 'like') {
      const postId = url.searchParams.get('postId');
      if (!postId) return json({ ok: false }, 400);
      await env.DB.prepare(
        'UPDATE posts SET likes = likes + 1 WHERE id = ?'
      )
        .bind(String(postId))
        .run();
      return json({ ok: true });
    }

    // 댓글 INSERT
    if (action === 'comment') {
      const postId = url.searchParams.get('postId');
      if (!postId) return json({ ok: false }, 400);
      let body;
      try {
        body = await request.json();
      } catch {
        body = null;
      }
      if (!body) return json({ ok: false, error: 'body required' }, 400);
      if (over(body.content, LIMITS.content)) return json({ ok: false, error: 'too_long' }, 400);
      const id =
        body.id != null && body.id !== '' ? String(body.id) : `cmt_${Date.now()}`;
      // 기존 댓글 덮어쓰기는 작성자 본인만(매니저 예외).
      if (body.id != null && body.id !== '' && !mgr) {
        const r = await env.DB.prepare('SELECT author_id FROM post_comments WHERE id = ?')
          .bind(id).first();
        if (r && String(r.author_id) !== uid) return json({ ok: false, error: 'forbidden' }, 403);
      }
      const ts = Number(body.timestamp) || Date.now();
      await env.DB.prepare(
        'INSERT OR REPLACE INTO post_comments(id, post_id, author_id, author_name, content, timestamp) VALUES(?,?,?,?,?,?)'
      )
        .bind(
          id,
          String(postId),
          // 작성자는 토큰 신원(sub)으로 강제 — 타인 명의 댓글 차단.
          uid || (body.authorId == null ? '' : String(body.authorId)),
          uname || (body.authorName == null ? '' : String(body.authorName)),
          body.content == null ? '' : String(body.content),
          ts
        )
        .run();
      return json({ ok: true, id });
    }

    // 삭제 (작성자 본인 또는 매니저)
    if (action === 'delete') {
      const postId = url.searchParams.get('postId');
      if (!postId) return json({ ok: false }, 400);
      if (!mgr && !(await ownsPost(postId))) return json({ ok: false, error: 'forbidden' }, 403);
      await env.DB.prepare('DELETE FROM posts WHERE id = ?')
        .bind(String(postId))
        .run();
      await env.DB.prepare('DELETE FROM post_comments WHERE post_id = ?')
        .bind(String(postId))
        .run();
      return json({ ok: true });
    }

    // 글 작성 INSERT
    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);
    if (over(body.title, LIMITS.title) || over(body.content, LIMITS.content)) {
      return json({ ok: false, error: 'too_long' }, 400);
    }

    const id =
      body.id != null && body.id !== '' ? String(body.id) : `post_${Date.now()}`;
    // 기존 글 덮어쓰기는 작성자 본인만(매니저 예외).
    if (body.id != null && body.id !== '' && !mgr && !(await ownsPost(id))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
    const ts = Number(body.timestamp) || Date.now();

    await env.DB.prepare(
      'INSERT OR REPLACE INTO posts(id, type, author_id, author_name, title, content, timestamp, likes, category) VALUES(?,?,?,?,?,?,?,?,?)'
    )
      .bind(
        id,
        // 공지(notice)는 전 직원에게 팝업으로 뜨는 채널 → 매니저/관리자만 발행 가능.
        // 일반 사용자가 type='notice' 를 넣으면 일반글로 강등(요청 거부 대신 강등 = 회귀 안전).
        body.type === 'notice' && mgr ? 'notice' : 'normal',
        // 작성자는 토큰 신원(sub)으로 강제 — 타인 명의 게시 차단.
        uid || (body.authorId == null ? '' : String(body.authorId)),
        uname || (body.authorName == null ? '' : String(body.authorName)),
        body.title == null ? '' : String(body.title),
        body.content == null ? '' : String(body.content),
        ts,
        Number(body.likes) || 0,
        body.category == null ? '' : String(body.category)
      )
      .run();

    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
