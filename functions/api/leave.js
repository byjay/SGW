// SGW 연차(leave_requests) — Cloudflare D1 backed cross-browser leave requests.
// Table: leave_requests(id, user_id, user_name, type, start_date, end_date,
//                       days, status, reason, emergency_contact, request_date)
// GET  /api/leave            -> { requests: [...] }  (admin 전체)
// GET  /api/leave?userId=2   -> { requests: [...] }  (본인)
// POST /api/leave                        신청 (body = LeaveRequest)
// POST /api/leave?action=update&id=...   수정 (body = 부분 필드)
// POST /api/leave?action=delete&id=...   삭제
// POST /api/leave?action=approve&id=...&status=approved|rejected  승인/반려

import { isManager } from '../_lib/sgw-roles.js';
import { LIMITS, over } from '../_lib/validate.js';
import { ownsRow } from '../_lib/row-own.js';

// 연차 상태 허용값 — 임의 문자열 주입 차단.
const LEAVE_STATUSES = new Set(['pending', 'approved', 'rejected', 'canceled']);

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// D1 row → LeaveRequest (snake→camel)
const rowToLeave = (r) => ({
  id: String(r.id),
  userId: r.user_id == null ? '' : String(r.user_id),
  userName: r.user_name == null ? '' : String(r.user_name),
  type: r.type == null ? '' : String(r.type),
  startDate: r.start_date == null ? '' : String(r.start_date),
  endDate: r.end_date == null ? '' : String(r.end_date),
  days: r.days == null ? 0 : Number(r.days),
  status: r.status == null ? '' : String(r.status),
  reason: r.reason == null ? '' : String(r.reason),
  emergencyContact: r.emergency_contact == null ? '' : String(r.emergency_contact),
  requestDate: Number(r.request_date) || 0,
});

export async function onRequestGet({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ requests: [] }, 500);
    const user = data && data.user;
    // 매니저/관리자는 전체(userId 미지정 시), 일반 사용자는 본인분만(토큰 sub 강제).
    const userId = isManager(user)
      ? new URL(request.url).searchParams.get('userId')
      : (user && user.sub ? String(user.sub) : '__none__');

    let res;
    if (userId) {
      res = await env.DB.prepare(
        'SELECT * FROM leave_requests WHERE user_id = ? ORDER BY request_date DESC'
      )
        .bind(String(userId))
        .all();
    } else {
      res = await env.DB.prepare(
        'SELECT * FROM leave_requests ORDER BY request_date DESC'
      ).all();
    }

    const requests = (res.results || []).map(rowToLeave);
    return json({ requests });
  } catch (e) {
    return json({ requests: [], error: 'db_error' }, 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    const user = data && data.user;
    const uid = user && user.sub ? String(user.sub) : '';
    const mgr = isManager(user);
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // 대상 레코드 소유자 확인(본인 신청분만 수정/삭제 허용).
    const ownsLeave = async (id) => {
      const r = await env.DB.prepare('SELECT user_id FROM leave_requests WHERE id = ?')
        .bind(String(id)).first();
      return r && String(r.user_id) === uid;
    };

    // 삭제 (매니저 또는 본인 신청분)
    if (action === 'delete') {
      const id = url.searchParams.get('id');
      if (!id) return json({ ok: false }, 400);
      if (!mgr && !(await ownsLeave(id))) return json({ ok: false, error: 'forbidden' }, 403);
      await env.DB.prepare('DELETE FROM leave_requests WHERE id = ?')
        .bind(String(id))
        .run();
      return json({ ok: true });
    }

    // 승인/반려 (매니저/관리자만)
    if (action === 'approve') {
      if (!mgr) return json({ ok: false, error: 'forbidden' }, 403);
      const id = url.searchParams.get('id');
      const status = url.searchParams.get('status');
      if (!id || !status) return json({ ok: false }, 400);
      if (!LEAVE_STATUSES.has(String(status))) return json({ ok: false, error: 'invalid_status' }, 400);
      await env.DB.prepare('UPDATE leave_requests SET status = ? WHERE id = ?')
        .bind(String(status), String(id))
        .run();
      return json({ ok: true });
    }

    // 수정 (매니저 또는 본인 신청분)
    if (action === 'update') {
      const id = url.searchParams.get('id');
      if (!id) return json({ ok: false }, 400);
      if (!mgr && !(await ownsLeave(id))) return json({ ok: false, error: 'forbidden' }, 403);
      let body;
      try {
        body = await request.json();
      } catch {
        body = null;
      }
      if (!body) return json({ ok: false, error: 'body required' }, 400);
      if (over(body.reason, LIMITS.reason) || over(body.userName, LIMITS.name)) {
        return json({ ok: false, error: 'too_long' }, 400);
      }

      const map = {
        type: 'type',
        startDate: 'start_date',
        endDate: 'end_date',
        days: 'days',
        status: 'status',
        reason: 'reason',
        emergencyContact: 'emergency_contact',
        userName: 'user_name',
      };
      const sets = [];
      const vals = [];
      for (const [k, col] of Object.entries(map)) {
        if (body[k] !== undefined) {
          // ★ 상태 변경은 매니저만 — 본인 신청분 update 로 자가승인(status='approved')하는 경로 차단.
          if (k === 'status') {
            if (!mgr) continue;
            if (!LEAVE_STATUSES.has(String(body[k]))) {
              return json({ ok: false, error: 'invalid_status' }, 400);
            }
          }
          sets.push(`${col} = ?`);
          vals.push(k === 'days' ? Number(body[k]) : String(body[k]));
        }
      }
      if (sets.length === 0) return json({ ok: true, id: String(id) });
      vals.push(String(id));
      await env.DB.prepare(
        `UPDATE leave_requests SET ${sets.join(', ')} WHERE id = ?`
      )
        .bind(...vals)
        .run();
      return json({ ok: true, id: String(id) });
    }

    // 신규 신청 INSERT
    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);
    if (over(body.reason, LIMITS.reason) || over(body.userName, LIMITS.name)) {
      return json({ ok: false, error: 'too_long' }, 400);
    }

    const id =
      body.id != null && body.id !== '' ? String(body.id) : `leave_${Date.now()}`;
    // ★ 남의 연차 신청 행 덮어쓰기 차단(클라 지정 id + INSERT OR REPLACE).
    if (!mgr && !(await ownsRow(env, 'leave_requests', ['user_id'], id, uid))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
    const requestDate = Number(body.requestDate) || Date.now();

    // 관리자(매니저)가 body.userId로 타인 명의 연차를 대리 등록하는지 판별.
    // 대리등록이면 대상 구성원(user_id/user_name)을 body 값으로 저장한다.
    // 비관리자(또는 본인 신청)는 기존대로 토큰 sub로 신청자를 강제(타인 명의 차단).
    const delegated =
      mgr &&
      body.userId != null &&
      body.userId !== '' &&
      String(body.userId) !== uid;
    const insertUserId = delegated
      ? String(body.userId)
      : uid || (body.userId == null ? '' : String(body.userId));
    const insertUserName = delegated
      ? (body.userName == null ? '' : String(body.userName))
      : (user && user.name)
        ? String(user.name)
        : (body.userName == null ? '' : String(body.userName));

    await env.DB.prepare(
      'INSERT OR REPLACE INTO leave_requests(id, user_id, user_name, type, start_date, end_date, days, status, reason, emergency_contact, request_date) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
    )
      .bind(
        id,
        insertUserId,
        insertUserName,
        body.type == null ? '' : String(body.type),
        body.startDate == null ? '' : String(body.startDate),
        body.endDate == null ? '' : String(body.endDate),
        body.days == null ? 0 : Number(body.days),
        // ponytail: 기본값 'approved' 는 기존 제품 동작(사내 규정상 연차는 즉시 반영)이라 유지.
        //           단 임의 문자열 주입은 차단(허용값 밖이면 기본값으로 강제).
        LEAVE_STATUSES.has(String(body.status)) ? String(body.status) : 'approved',
        body.reason == null ? '' : String(body.reason),
        body.emergencyContact == null ? '' : String(body.emergencyContact),
        requestDate
      )
      .run();

    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
