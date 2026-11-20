// SGW shared employee roster — D1 CRUD API.
// Table: sgw_users (separate from sgw-admin owned `employees`).
// GET  /api/employees                     -> { employees: [ {id,name,email,role,department,position,annualLeave,totalLeave,carryover,joinDate,status,isPartTime}, ... ] }
// POST /api/employees                      신규 등록 (body = 프로필 필드; id 미제공 시 서버 생성). 필수 name/email.
// POST /api/employees?action=update&id=... 수정 (전달된 필드만 UPDATE)
// POST /api/employees?action=delete&id=... 삭제 (hard delete — swgs 관례: leave_requests와 동일)
// 주의: sgw_users엔 password 컬럼 없음 → 비번 초기화는 클라(v2) 로컬에서만 처리.

import { isManager, isAdmin } from '../_lib/sgw-roles.js';
import { LIMITS, over, isValidEmail, isValidRole } from '../_lib/validate.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// 인증 사용자 전원이 명부(이름·부서 등, password_hash 제외)를 읽을 수 있다(채팅/멤버 목록용).
export async function onRequestGet({ env }) {
  try {
    if (!env || !env.DB) return json({ employees: [] }, 500);

    const res = await env.DB.prepare(
      'SELECT id, name, email, role, department, position, annual_leave, total_leave, carryover, join_date, status, is_part_time FROM sgw_users'
    ).all();

    const employees = (res.results || []).map((r) => ({
      id: String(r.id),
      name: r.name || '',
      email: r.email || '',
      role: r.role || 'user',
      department: r.department || '',
      position: r.position || '',
      annualLeave: r.annual_leave == null ? 0 : Number(r.annual_leave),
      totalLeave: r.total_leave == null ? 15 : Number(r.total_leave),
      carryover: r.carryover == null ? 0 : Number(r.carryover),
      joinDate: r.join_date || '',
      status: r.status || 'active',
      isPartTime: Number(r.is_part_time) === 1,
    }));

    return json({ employees });
  } catch (e) {
    return json({ employees: [], error: 'db_error' }, 500);
  }
}

// camelCase(body) → sgw_users 컬럼. update/create 공용 매핑.
const FIELD_MAP = {
  name: 'name',
  email: 'email',
  role: 'role',
  department: 'department',
  position: 'position',
  totalLeave: 'total_leave',
  carryover: 'carryover',
  annualLeave: 'annual_leave',
  isPartTime: 'is_part_time',
  status: 'status',
};
const NUM_COLS = new Set(['total_leave', 'carryover', 'annual_leave', 'is_part_time']);

// 이메일 중복 방지 — 로그인이 `WHERE lower(email) = ?` 단건 조회라 중복이 생기면
// 엉뚱한 행이 매칭돼 정상 계정이 잠기거나(계정 잠금) 신원이 뒤섞인다.
async function emailTaken(env, email, exceptId) {
  const r = await env.DB.prepare(
    'SELECT id FROM sgw_users WHERE lower(email) = ? AND id <> ?'
  )
    .bind(String(email).toLowerCase(), String(exceptId == null ? '' : exceptId))
    .first()
    .catch(() => null);
  return !!r;
}

// body 값을 컬럼 타입에 맞춰 변환(숫자 컬럼은 Number, is_part_time은 0/1).
function coerce(col, v) {
  if (col === 'is_part_time') return v === true || v === 1 || v === '1' ? 1 : 0;
  if (NUM_COLS.has(col)) return Number(v) || 0;
  return v == null ? '' : String(v);
}

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    // 명부 CRUD(생성/수정/삭제)는 관리자/매니저만.
    const user = data && data.user;
    if (!isManager(user)) return json({ ok: false, error: 'forbidden' }, 403);
    const admin = isAdmin(user);
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // 삭제 (hard delete)
    if (action === 'delete') {
      const id = url.searchParams.get('id');
      if (!id) return json({ ok: false, error: 'id required' }, 400);
      await env.DB.prepare('DELETE FROM sgw_users WHERE id = ?')
        .bind(String(id))
        .run();
      return json({ ok: true, id: String(id) });
    }

    // 수정 (부분 업데이트: 전달된 필드만)
    if (action === 'update') {
      const id = url.searchParams.get('id');
      if (!id) return json({ ok: false, error: 'id required' }, 400);
      let body;
      try {
        body = await request.json();
      } catch {
        body = null;
      }
      if (!body) return json({ ok: false, error: 'body required' }, 400);
      // 형식/길이 검증(전달된 필드만).
      if (over(body.name, LIMITS.name) || over(body.department, LIMITS.name) || over(body.position, LIMITS.name)) {
        return json({ ok: false, error: 'too_long' }, 400);
      }
      if (body.email !== undefined) {
        if (!isValidEmail(String(body.email).trim())) {
          return json({ ok: false, error: 'invalid_email' }, 400);
        }
        if (await emailTaken(env, String(body.email).trim(), id)) {
          return json({ ok: false, error: 'email_taken' }, 409);
        }
      }
      if (body.role !== undefined && admin && !isValidRole(body.role)) {
        return json({ ok: false, error: 'invalid_role' }, 400);
      }

      const sets = [];
      const vals = [];
      for (const [k, col] of Object.entries(FIELD_MAP)) {
        if (body[k] !== undefined) {
          if (col === 'role' && !admin) continue; // 역할 변경은 admin만.
          sets.push(`${col} = ?`);
          vals.push(coerce(col, body[k]));
        }
      }
      if (sets.length === 0) return json({ ok: true, id: String(id) });
      vals.push(String(id));
      await env.DB.prepare(
        `UPDATE sgw_users SET ${sets.join(', ')} WHERE id = ?`
      )
        .bind(...vals)
        .run();
      return json({ ok: true, id: String(id) });
    }

    // 신규 등록 INSERT
    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);

    const name = body.name == null ? '' : String(body.name).trim();
    const email = body.email == null ? '' : String(body.email).trim();
    if (!name) return json({ ok: false, error: 'name required' }, 400);
    if (!email) return json({ ok: false, error: 'email required' }, 400);
    if (over(name, LIMITS.name) || over(body.department, LIMITS.name) || over(body.position, LIMITS.name)) {
      return json({ ok: false, error: 'too_long' }, 400);
    }
    if (!isValidEmail(email)) return json({ ok: false, error: 'invalid_email' }, 400);
    if (await emailTaken(env, email, null)) return json({ ok: false, error: 'email_taken' }, 409);
    if (admin && body.role != null && !isValidRole(body.role)) {
      return json({ ok: false, error: 'invalid_role' }, 400);
    }

    // 신규는 항상 서버가 id 생성(클라 지정 id로 기존 레코드/비밀번호 덮어쓰기 차단).
    // 숫자 id 최대값+1 (비숫자 id는 CAST에서 0 처리).
    const mx = await env.DB.prepare(
      'SELECT MAX(CAST(id AS INTEGER)) AS m FROM sgw_users'
    ).first();
    const id = String((mx && Number(mx.m) ? Number(mx.m) : 0) + 1);

    await env.DB.prepare(
      'INSERT INTO sgw_users(id, name, email, role, department, position, annual_leave, total_leave, carryover, join_date, status, is_part_time) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'
    )
      .bind(
        id,
        name,
        email,
        admin && body.role != null ? String(body.role) : 'user',
        body.department == null ? '' : String(body.department),
        body.position == null ? '' : String(body.position),
        body.annualLeave == null ? 0 : Number(body.annualLeave) || 0,
        body.totalLeave == null ? 15 : Number(body.totalLeave) || 0,
        body.carryover == null ? 0 : Number(body.carryover) || 0,
        body.joinDate == null ? '' : String(body.joinDate),
        body.status == null ? 'active' : String(body.status),
        coerce('is_part_time', body.isPartTime)
      )
      .run();

    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
