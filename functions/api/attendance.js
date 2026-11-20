// SGW 근태(attendance) — Cloudflare D1 backed cross-browser 출퇴근 기록.
// Table: attendance(id, user_id, type('clock_in'|'clock_out'), timestamp, location)
//   GET  ?userId=  → 오늘(로컬 자정 이후) 기록 { clockIn, clockOut, records[] }
//   POST { userId, type, location? } → 기록 INSERT

import { LIMITS, over } from '../_lib/validate.js';
import { ownsRow } from '../_lib/row-own.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// 자정 경계는 서버(UTC)가 아니라 KST 기준으로 계산한다(사내 근태 = 한국 시간).
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const startOfKstToday = () => {
  const now = Date.now();
  const kst = now + KST_OFFSET_MS;
  const midnightKst = Math.floor(kst / 86400000) * 86400000;
  return midnightKst - KST_OFFSET_MS; // UTC epoch of KST 00:00
};

export async function onRequestGet({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ clockIn: null, clockOut: null, records: [] }, 500);
    // 본인 근태만 — 토큰 신원(sub) 강제.
    const user = data && data.user;
    const userId = user && user.sub ? String(user.sub) : '';
    if (!userId) return json({ clockIn: null, clockOut: null, records: [] }, 400);

    const since = startOfKstToday();
    const res = await env.DB.prepare(
      'SELECT * FROM attendance WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp ASC'
    )
      .bind(String(userId), since)
      .all();

    const rows = (res.results || []).map((r) => ({
      id: String(r.id),
      userId: r.user_id == null ? '' : String(r.user_id),
      type: r.type == null ? '' : String(r.type),
      timestamp: Number(r.timestamp) || 0,
      location: r.location == null ? '' : String(r.location),
    }));

    const clockIn = rows.find((r) => r.type === 'clock_in')?.timestamp ?? null;
    const clockOut = rows
      .filter((r) => r.type === 'clock_out')
      .sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp ?? null;

    return json({ clockIn, clockOut, records: rows });
  } catch (e) {
    return json({ clockIn: null, clockOut: null, records: [], error: 'db_error' }, 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);
    if (over(body.location, LIMITS.location)) return json({ ok: false, error: 'too_long' }, 400);

    // 근태 기록은 토큰 신원(sub)으로 강제 — 타인 명의 출퇴근 차단.
    const user = data && data.user;
    // 클라이언트가 보낸 body.userId 는 신뢰하지 않는다(타인 명의 출퇴근 차단).
    const userId = user && user.sub ? String(user.sub) : '';
    const type = body.type === 'clock_out' ? 'clock_out' : 'clock_in';
    if (!userId) return json({ ok: false, error: 'userId required' }, 400);

    const id = body.id != null && body.id !== '' ? String(body.id) : `att_${Date.now()}`;
    // ★ 남의 근태 행 덮어쓰기 차단(클라 지정 id + INSERT OR REPLACE).
    if (!(await ownsRow(env, 'attendance', ['user_id'], id, userId))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
    // ★ 출퇴근 시각은 서버 시계로 강제 — 클라가 timestamp 를 조작해 지각을 소급 위조하는 것 차단.
    const ts = Date.now();
    const location =
      body.location == null ? '지정 근무지 (인증됨)' : String(body.location);

    await env.DB.prepare(
      'INSERT OR REPLACE INTO attendance(id, user_id, type, timestamp, location) VALUES(?,?,?,?,?)'
    )
      .bind(id, userId, type, ts, location)
      .run();

    return json({ ok: true, id, type, timestamp: ts });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
