// GET /api/health — 무인증 헬스체크(_middleware PUBLIC_API 화이트리스트).
// D1 SELECT 1 핑 → { ok:true, db:true, ts } 200, 실패 시 503. 민감정보 미노출.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestGet({ env }) {
  const ts = Date.now();
  try {
    if (!env || !env.DB) return json({ ok: false, db: false, ts }, 503);
    await env.DB.prepare('SELECT 1').first();
    return json({ ok: true, db: true, ts });
  } catch {
    return json({ ok: false, db: false, ts: Date.now() }, 503);
  }
}
