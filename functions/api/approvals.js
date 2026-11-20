// SGW 전자결재(approvals) — Cloudflare D1 backed cross-browser approvals.
// Table: approvals(id, doc_type, title, requester_id, requester_name,
//                  approver_id, approver_name, status, content, attachment,
//                  steps_json, created_at, updated_at)
// GET  /api/approvals?userId=2            -> { approvals: [...] } (본인 상신/결재분)
// GET  /api/approvals                     -> { approvals: [...] } (전체)
// POST /api/approvals                     상신 (body = Approval)
// POST /api/approvals?action=decide&id=...&status=approved|rejected

import { isManager } from '../_lib/sgw-roles.js';
import { LIMITS, over } from '../_lib/validate.js';
import { ownsRow } from '../_lib/row-own.js';

// 결재 상태 허용값 — 임의 문자열 주입 차단.
const STATUSES = new Set(['draft', 'pending', 'approved', 'rejected', 'canceled']);
// 상신 시 저장할 상태. 비매니저는 draft/pending 만(자기 결재 자가승인 차단).
const SELF_SETTABLE = new Set(['draft', 'pending']);
export function approvalStatus(raw, mgr) {
  const s = raw == null ? '' : String(raw);
  if (mgr) return STATUSES.has(s) ? s : 'pending';
  return SELF_SETTABLE.has(s) ? s : 'pending';
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const rowToApproval = (r) => {
  const a = {
    id: String(r.id),
    requesterId: r.requester_id == null ? '' : String(r.requester_id),
    requesterName: r.requester_name == null ? '' : String(r.requester_name),
    approverId: r.approver_id == null ? '' : String(r.approver_id),
    approverName: r.approver_name == null ? '' : String(r.approver_name),
    title: r.title == null ? '' : String(r.title),
    content: r.content == null ? '' : String(r.content),
    status: r.status == null ? 'draft' : String(r.status),
    createdAt: Number(r.created_at) || 0,
    updatedAt: Number(r.updated_at) || 0,
  };
  if (r.attachment) a.attachment = String(r.attachment);
  if (r.doc_type) a.docType = String(r.doc_type);
  if (r.steps_json) a.stepsJson = String(r.steps_json);
  if (r.amount != null && r.amount !== '') a.amount = Number(r.amount);
  if (r.attachment_name) a.attachmentName = String(r.attachment_name);
  if (r.attachment_data) a.attachmentData = String(r.attachment_data);
  return a;
};

export async function onRequestGet({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ approvals: [] }, 500);
    const user = data && data.user;
    // 매니저/관리자는 전체(userId 미지정 시), 일반 사용자는 본인 상신/결재분만(sub 강제).
    const userId = isManager(user)
      ? new URL(request.url).searchParams.get('userId')
      : (user && user.sub ? String(user.sub) : '__none__');

    let res;
    if (userId) {
      res = await env.DB.prepare(
        'SELECT * FROM approvals WHERE requester_id = ? OR approver_id = ? ORDER BY updated_at DESC'
      )
        .bind(String(userId), String(userId))
        .all();
    } else {
      res = await env.DB.prepare(
        'SELECT * FROM approvals ORDER BY updated_at DESC'
      ).all();
    }

    const approvals = (res.results || []).map(rowToApproval);
    return json({ approvals });
  } catch (e) {
    return json({ approvals: [], error: 'db_error' }, 500);
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

    // 승인/반려 (지정 결재자 본인 또는 매니저만)
    if (action === 'decide') {
      const id = url.searchParams.get('id');
      const status = url.searchParams.get('status');
      if (!id || !status) return json({ ok: false }, 400);
      if (!STATUSES.has(String(status))) return json({ ok: false, error: 'invalid_status' }, 400);
      if (!mgr) {
        const r = await env.DB.prepare('SELECT approver_id FROM approvals WHERE id = ?')
          .bind(String(id)).first();
        if (!r || String(r.approver_id) !== uid) return json({ ok: false, error: 'forbidden' }, 403);
      }
      await env.DB.prepare(
        'UPDATE approvals SET status = ?, updated_at = ? WHERE id = ?'
      )
        .bind(String(status), Date.now(), String(id))
        .run();
      return json({ ok: true });
    }

    // 삭제 (상신자 본인 또는 매니저)
    if (action === 'delete') {
      const id = url.searchParams.get('id');
      if (!id) return json({ ok: false }, 400);
      if (!mgr) {
        const r = await env.DB.prepare('SELECT requester_id FROM approvals WHERE id = ?')
          .bind(String(id)).first();
        if (!r || String(r.requester_id) !== uid) return json({ ok: false, error: 'forbidden' }, 403);
      }
      await env.DB.prepare('DELETE FROM approvals WHERE id = ?')
        .bind(String(id))
        .run();
      return json({ ok: true });
    }

    // 상신 INSERT
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
    if (over(body.attachmentData, LIMITS.fileB64) || over(body.attachment, LIMITS.fileB64)) {
      return json({ ok: false, error: 'file_too_large' }, 400);
    }

    const id =
      body.id != null && body.id !== '' ? String(body.id) : `apv_${Date.now()}`;
    // ★ 남의 결재 문서 덮어쓰기 차단(클라 지정 id + INSERT OR REPLACE).
    if (!mgr && !(await ownsRow(env, 'approvals', ['requester_id'], id, uid))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
    const createdAt = Number(body.createdAt) || Date.now();
    const updatedAt = Number(body.updatedAt) || createdAt;

    // amount는 INTEGER 컬럼 — 숫자만 추출(콤마·"원" 등 제거) 후 저장.
    let amount = null;
    if (body.amount != null && body.amount !== '') {
      const digits = String(body.amount).replace(/[^0-9]/g, '');
      amount = digits === '' ? null : Number(digits);
    }

    await env.DB.prepare(
      'INSERT OR REPLACE INTO approvals(id, doc_type, title, requester_id, requester_name, approver_id, approver_name, status, content, attachment, steps_json, amount, attachment_name, attachment_data, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    )
      .bind(
        id,
        body.docType == null ? 'general' : String(body.docType),
        body.title == null ? '' : String(body.title),
        // 상신자는 토큰 신원(sub)으로 강제 — 타인 명의 상신 차단.
        uid || (body.requesterId == null ? '' : String(body.requesterId)),
        (user && user.name) ? String(user.name) : (body.requesterName == null ? '' : String(body.requesterName)),
        body.approverId == null ? '' : String(body.approverId),
        body.approverName == null ? '' : String(body.approverName),
        // ★ 상신자가 스스로 'approved' 를 넣어 자기 결재를 통과시키는 것을 차단.
        //   비매니저는 draft/pending 만 지정 가능(그 외/미지정 → pending).
        //   승인·반려는 오직 action=decide(지정 결재자·매니저) 경로로만.
        approvalStatus(body.status, mgr),
        body.content == null ? '' : String(body.content),
        body.attachment == null ? null : String(body.attachment),
        body.stepsJson == null ? null : String(body.stepsJson),
        amount,
        body.attachmentName == null ? null : String(body.attachmentName),
        body.attachmentData == null ? null : String(body.attachmentData),
        createdAt,
        updatedAt
      )
      .run();

    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false }, 500);
  }
}
