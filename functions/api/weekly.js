// SGW 주간보고 — D1 backed. 주차×프로젝트×담당(discipline) 단위 협업 보고.
// Tables: weekly_reports(week_id,project_id,...) / weekly_entries(week_id,project_id,section,discipline,...)
// GET  /api/weekly?week=&project=          -> { report:{...}|null, entries:[...] }
// GET  /api/weekly?action=current&project= -> 이번주 ISO week_id 계산 + report INSERT OR IGNORE + (수요일이면 공지 멱등 생성) -> { report, entries }
// POST /api/weekly?action=entry            body {week,project,section,discipline,lines:[],remark} -> weekly_entries UPSERT(담당 소유권)
// POST /api/weekly?action=meta             body {week,project,title,periodFrom,periodTo,approveApplied,approveDone,approveNote} -> weekly_reports UPSERT

import { isManager } from '../_lib/sgw-roles.js';
import { LIMITS, over } from '../_lib/validate.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const SECTIONS = new Set(['this', 'next']);
const DISCIPLINES = new Set(['piping', 'steel', 'cabin', 'machinery', 'electric']);
const LINE_MAX = 2000; // 각 라인 길이 상한
const LINES_MAX = 30; // 라인 개수 상한
const REMARK_MAX = 2000; // 비고 상한

// ── KST(UTC+9) 기준 벽시계 Date (한국 회사 기준 주차·요일 계산) ──
const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000);

// ISO 8601 주차 id 'YYYY-Www' (목요일 기준). 입력 d는 KST 벽시계를 담은 Date(UTC getter 사용).
function isoWeekId(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // 해당 주의 목요일로 이동
  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const fmtDate = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

// 주의 월요일/일요일(KST 기준) — period 기본값.
function weekRange(d) {
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (mon.getUTCDay() + 6) % 7;
  mon.setUTCDate(mon.getUTCDate() - dayNum);
  const sun = new Date(mon);
  sun.setUTCDate(sun.getUTCDate() + 6);
  return { from: fmtDate(mon), to: fmtDate(sun) };
}

const rowToReport = (r) =>
  r
    ? {
        weekId: String(r.week_id),
        projectId: String(r.project_id),
        title: r.title == null ? '' : String(r.title),
        periodFrom: r.period_from == null ? '' : String(r.period_from),
        periodTo: r.period_to == null ? '' : String(r.period_to),
        approveApplied: Number(r.approve_applied) === 1,
        approveDone: Number(r.approve_done) === 1,
        approveNote: r.approve_note == null ? '' : String(r.approve_note),
        createdAt: Number(r.created_at) || 0,
        updatedAt: Number(r.updated_at) || 0,
      }
    : null;

function rowToEntry(r) {
  let lines = [];
  try {
    const parsed = JSON.parse(r.lines_json || '[]');
    if (Array.isArray(parsed)) lines = parsed;
  } catch {
    lines = [];
  }
  return {
    weekId: String(r.week_id),
    projectId: String(r.project_id),
    section: String(r.section),
    discipline: String(r.discipline),
    authorId: r.author_id == null ? '' : String(r.author_id),
    authorName: r.author_name == null ? '' : String(r.author_name),
    lines,
    remark: r.remark == null ? '' : String(r.remark),
    updatedAt: Number(r.updated_at) || 0,
  };
}

async function loadReport(env, week, project) {
  const rep = await env.DB.prepare(
    'SELECT * FROM weekly_reports WHERE week_id = ? AND project_id = ?'
  )
    .bind(week, project)
    .first();
  const ent = await env.DB.prepare(
    'SELECT * FROM weekly_entries WHERE week_id = ? AND project_id = ?'
  )
    .bind(week, project)
    .all();
  return {
    report: rowToReport(rep),
    entries: (ent.results || []).map(rowToEntry),
  };
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env || !env.DB) return json({ report: null, entries: [] }, 500);
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const project = (url.searchParams.get('project') || '').trim();

    // 이번주 보고 자동 생성 + 반환.
    if (action === 'current') {
      if (!project) return json({ error: 'project required' }, 400);
      const now = kstNow();
      const week = isoWeekId(now);
      const { from, to } = weekRange(now);
      const ts = Date.now();

      // weekly_reports 멱등 생성.
      await env.DB.prepare(
        'INSERT OR IGNORE INTO weekly_reports(week_id, project_id, title, period_from, period_to, approve_applied, approve_done, approve_note, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)'
      )
        .bind(week, project, '', from, to, 0, 0, '', ts, ts)
        .run();

      // 수요일(KST)이면 작성요청 공지 멱등 생성 → 기존 신규공지 팝업이 자동으로 뜸.
      if (now.getUTCDay() === 3) {
        const noticeId = `weekly_notice_${week}`;
        await env.DB.prepare(
          'INSERT OR IGNORE INTO posts(id, type, author_id, author_name, title, content, timestamp, likes, category) VALUES(?,?,?,?,?,?,?,?,?)'
        )
          .bind(
            noticeId,
            'notice',
            'system',
            '시스템 관리자',
            `[주간보고] ${week} 작성 요청`,
            `이번 주(${from} ~ ${to}) 주간보고 작성 기간입니다. 담당 항목(금주 실적/차주 계획)을 작성해 주세요.`,
            ts,
            0,
            ''
          )
          .run();
      }

      return json(await loadReport(env, week, project));
    }

    // 특정 주차·프로젝트 조회.
    const week = (url.searchParams.get('week') || '').trim();
    if (!week || !project) return json({ error: 'week and project required' }, 400);
    return json(await loadReport(env, week, project));
  } catch (e) {
    return json({ report: null, entries: [], error: 'db_error' }, 500);
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

    let body;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    if (!body) return json({ ok: false, error: 'body required' }, 400);

    const week = body.week == null ? '' : String(body.week).trim();
    const project = body.project == null ? '' : String(body.project).trim();
    if (!week || !project) return json({ ok: false, error: 'week and project required' }, 400);

    // 담당 항목 저장 (담당 단위 UPSERT — 서로 안 덮음).
    if (action === 'entry') {
      const section = String(body.section || '');
      const discipline = String(body.discipline || '');
      if (!SECTIONS.has(section)) return json({ ok: false, error: 'invalid_section' }, 400);
      if (!DISCIPLINES.has(discipline)) return json({ ok: false, error: 'invalid_discipline' }, 400);

      // lines 검증: 배열·개수·각 길이 상한.
      const rawLines = Array.isArray(body.lines) ? body.lines : [];
      if (rawLines.length > LINES_MAX) return json({ ok: false, error: 'too_many_lines' }, 400);
      const lines = [];
      for (const ln of rawLines) {
        const s = ln == null ? '' : String(ln);
        if (s.length > LINE_MAX) return json({ ok: false, error: 'line_too_long' }, 400);
        lines.push(s);
      }
      const remark = body.remark == null ? '' : String(body.remark);
      if (remark.length > REMARK_MAX) return json({ ok: false, error: 'remark_too_long' }, 400);

      // 소유권: 기존 행의 author_id가 있고 본인(sub)이 아니며 비매니저면 403(자기 담당만).
      const existing = await env.DB.prepare(
        'SELECT author_id FROM weekly_entries WHERE week_id = ? AND project_id = ? AND section = ? AND discipline = ?'
      )
        .bind(week, project, section, discipline)
        .first();
      if (existing && existing.author_id && String(existing.author_id) !== uid && !mgr) {
        return json({ ok: false, error: 'forbidden' }, 403);
      }

      const ts = Date.now();
      await env.DB.prepare(
        'INSERT OR REPLACE INTO weekly_entries(week_id, project_id, section, discipline, author_id, author_name, lines_json, remark, updated_at) VALUES(?,?,?,?,?,?,?,?,?)'
      )
        .bind(
          week,
          project,
          section,
          discipline,
          // 작성자는 토큰 신원(sub)으로 강제 — 타인 명의 저장 차단.
          uid,
          uname,
          JSON.stringify(lines),
          remark,
          ts
        )
        .run();
      return json({ ok: true });
    }

    // 보고 메타(제목·기간·결재) UPSERT. approve 플래그는 매니저만.
    // ponytail(감사 화이트리스트): weekly_reports 는 **주차×프로젝트 공용 헤더**라 소유자가 없다
    //   → 인증된 구성원 누구나 제목/기간/비고를 편집할 수 있는 것이 의도된 협업 동작이다.
    //   보호가 필요한 값(approve_applied/approve_done)만 매니저로 제한하고, created_at 등
    //   나머지는 기존값을 보존한다. 소유권 가드 부재는 결함이 아님(재감사 시 오탐 금지).
    if (action === 'meta') {
      if (over(body.title, LIMITS.title) || over(body.approveNote, LIMITS.content)) {
        return json({ ok: false, error: 'too_long' }, 400);
      }
      const ts = Date.now();
      const cur = await env.DB.prepare(
        'SELECT * FROM weekly_reports WHERE week_id = ? AND project_id = ?'
      )
        .bind(week, project)
        .first();

      const title = body.title == null ? (cur ? cur.title : '') : String(body.title);
      const periodFrom = body.periodFrom == null ? (cur ? cur.period_from : '') : String(body.periodFrom);
      const periodTo = body.periodTo == null ? (cur ? cur.period_to : '') : String(body.periodTo);
      const approveNote = body.approveNote == null ? (cur ? cur.approve_note : '') : String(body.approveNote);
      // approve 플래그 변경은 매니저만. 비매니저는 기존값 유지.
      const applied = mgr && body.approveApplied !== undefined
        ? (body.approveApplied ? 1 : 0)
        : (cur ? Number(cur.approve_applied) || 0 : 0);
      const done = mgr && body.approveDone !== undefined
        ? (body.approveDone ? 1 : 0)
        : (cur ? Number(cur.approve_done) || 0 : 0);
      const createdAt = cur ? Number(cur.created_at) || ts : ts;

      await env.DB.prepare(
        'INSERT OR REPLACE INTO weekly_reports(week_id, project_id, title, period_from, period_to, approve_applied, approve_done, approve_note, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)'
      )
        .bind(week, project, title, periodFrom, periodTo, applied, done, approveNote, createdAt, ts)
        .run();
      return json({ ok: true });
    }

    return json({ ok: false, error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
