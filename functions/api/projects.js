// SGW 프로젝트 마스터 — D1 backed. 주간보고(weekly)용 프로젝트 목록.
// Table: projects(id, name, phase, active, sort)
// GET  /api/projects            -> { projects: [ {id,name,phase,active,sort}, ... ] } (active, sort순)
// POST /api/projects (admin만)  신규 추가 (body = {id,name,phase})

import { isAdmin } from '../_lib/sgw-roles.js';
import { LIMITS, over } from '../_lib/validate.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const rowToProject = (r) => ({
  id: String(r.id),
  name: r.name == null ? '' : String(r.name),
  phase: r.phase == null ? '' : String(r.phase),
  active: Number(r.active) === 1,
  sort: Number(r.sort) || 0,
});

// 인증 사용자 전원이 활성 프로젝트 목록을 읽을 수 있다(주간보고 선택용).
export async function onRequestGet({ env }) {
  try {
    if (!env || !env.DB) return json({ projects: [] }, 500);
    const res = await env.DB.prepare(
      'SELECT id, name, phase, active, sort FROM projects WHERE active = 1 ORDER BY sort ASC, id ASC'
    ).all();
    const projects = (res.results || []).map(rowToProject);
    return json({ projects });
  } catch (e) {
    return json({ projects: [], error: 'db_error' }, 500);
  }
}

// 신규 프로젝트 추가는 admin만.
export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false }, 500);
    const user = data && data.user;
    if (!isAdmin(user)) return json({ ok: false, error: 'forbidden' }, 403);

    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);

    const id = body.id == null ? '' : String(body.id).trim();
    const name = body.name == null ? '' : String(body.name).trim();
    if (!id) return json({ ok: false, error: 'id required' }, 400);
    if (!name) return json({ ok: false, error: 'name required' }, 400);
    if (over(id, LIMITS.name) || over(name, LIMITS.name) || over(body.phase, LIMITS.name)) {
      return json({ ok: false, error: 'too_long' }, 400);
    }

    const phase = body.phase == null || body.phase === '' ? '기본설계' : String(body.phase);
    const sort = Number(body.sort) || 0;
    await env.DB.prepare(
      'INSERT OR REPLACE INTO projects(id, name, phase, active, sort) VALUES(?,?,?,?,?)'
    )
      .bind(id, name, phase, 1, sort)
      .run();

    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
