// SGW presence (동시접속) — Cloudflare D1 backed cross-browser online status.
// Table: presence(user_id TEXT PRIMARY KEY, last_seen INTEGER)

const TTL_MS = 30000; // 30s liveness window

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    // 하트비트는 토큰 신원(sub)으로 강제.
    const user = data && data.user;
    const userId = user && user.sub ? String(user.sub) : '';
    if (!userId) return json({ ok: false, error: 'userId required' }, 400);

    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO presence(user_id, last_seen) VALUES(?, ?) ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen'
    )
      .bind(userId, now)
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}

export async function onRequestGet({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ online: [] }, 500);
    const url = new URL(request.url);
    const logoutId = url.searchParams.get('logout');

    if (logoutId) {
      // 본인만 로그아웃(온라인 목록 제거) 가능 — 토큰 신원(sub)으로 강제.
      const user = data && data.user;
      const uid = user && user.sub ? String(user.sub) : '';
      await env.DB.prepare('DELETE FROM presence WHERE user_id = ?')
        .bind(uid || String(logoutId))
        .run();
      return json({ ok: true });
    }

    const threshold = Date.now() - TTL_MS;
    const res = await env.DB.prepare(
      'SELECT user_id FROM presence WHERE last_seen > ?'
    )
      .bind(threshold)
      .all();

    const online = (res.results || []).map((r) => String(r.user_id));
    return json({ online });
  } catch (e) {
    return json({ online: [], error: 'db_error' }, 500);
  }
}
