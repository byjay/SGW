/* audit.js — Immutable Audit Log + Chain Hash 검증
 * 보안.html L6 / SECTION 6: 100% Audit Coverage + WORM + Chain Hash
 *
 * 모든 이벤트는 prev_hash + canonical 표현 → SHA-256 → hash 컬럼
 * 위변조 시 chain이 깨져 즉시 탐지 가능
 */

const SHA = async (s) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Canonical JSON — 키 정렬로 동일 데이터는 항상 동일 hash
function canonical(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
}

/**
 * 감사 이벤트 기록 (Chain Hash 자동 계산)
 * @param {object} env - { DB }
 * @param {object} evt - { event, severity, sub, project, ip, ua, resource, action, result, ... }
 * @returns {Promise<{id, hash}>}
 */
export async function writeAudit(env, evt) {
  if (!env.DB) {
    // DB 미연결 시 console.log fallback (로컬 dev)
    console.log('[AUDIT-NOPERSIST]', JSON.stringify(evt));
    return null;
  }

  const ts = Date.now();
  const {
    event, severity = 'INFO',
    sub = null, project = null,
    ip = null, ua = null,
    resource = null, action = null, result = null,
    ...meta
  } = evt;

  // 이전 hash 가져오기
  const prev = await env.DB.prepare(
    `SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1`
  ).first();
  const prev_hash = prev?.hash || '0'.repeat(64);

  const row = {
    ts, event, severity, sub, project, ip, ua,
    resource, action, result,
    meta: Object.keys(meta).length ? meta : null,
  };
  const hash = await SHA(prev_hash + canonical(row));
  const meta_json = row.meta ? JSON.stringify(row.meta) : null;

  const r = await env.DB.prepare(
    `INSERT INTO audit_log
     (ts, event, severity, sub, project, ip, ua, resource, action, result, meta_json, prev_hash, hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(ts, event, severity, sub, project, ip, ua, resource, action, result, meta_json, prev_hash, hash).run();

  return { id: r.meta?.last_row_id, hash };
}

/**
 * 체인 무결성 검증 — 모든 행 또는 범위
 * @returns {Promise<{valid:boolean, brokenAt?:number, total:number}>}
 */
export async function verifyAuditChain(env, { fromId = 0, toId = null } = {}) {
  let sql = `SELECT id, ts, event, severity, sub, project, ip, ua,
                    resource, action, result, meta_json, prev_hash, hash
             FROM audit_log WHERE id >= ?`;
  const binds = [fromId];
  if (toId !== null) { sql += ' AND id <= ?'; binds.push(toId); }
  sql += ' ORDER BY id ASC';

  const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
  if (!rows.length) return { valid: true, total: 0 };

  let prevHash = fromId === 0 ? '0'.repeat(64) :
    (await env.DB.prepare(`SELECT hash FROM audit_log WHERE id = ?`).bind(fromId - 1).first())?.hash;

  for (const r of rows) {
    if (r.id === 0) { prevHash = r.hash; continue; }
    if (r.prev_hash !== prevHash) return { valid: false, brokenAt: r.id, total: rows.length };

    const row = {
      ts: r.ts, event: r.event, severity: r.severity,
      sub: r.sub, project: r.project, ip: r.ip, ua: r.ua,
      resource: r.resource, action: r.action, result: r.result,
      meta: r.meta_json ? JSON.parse(r.meta_json) : null,
    };
    const expected = await SHA(r.prev_hash + canonical(row));
    if (expected !== r.hash) return { valid: false, brokenAt: r.id, total: rows.length };
    prevHash = r.hash;
  }
  return { valid: true, total: rows.length };
}

/**
 * 조회 헬퍼 (관리자 페이지용)
 */
export async function queryAudit(env, {
  sub, event, severity, project, fromTs, toTs,
  limit = 100, offset = 0,
} = {}) {
  const where = [];
  const binds = [];
  if (sub)       { where.push('sub = ?');       binds.push(sub); }
  if (event)     { where.push('event LIKE ?');  binds.push(event); }
  if (severity)  { where.push('severity = ?');  binds.push(severity); }
  if (project)   { where.push('project = ?');   binds.push(project); }
  if (fromTs)    { where.push('ts >= ?');       binds.push(fromTs); }
  if (toTs)      { where.push('ts <= ?');       binds.push(toTs); }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const sql = `SELECT * FROM audit_log${w} ORDER BY id DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);
  const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
  return rows.map(r => ({ ...r, meta: r.meta_json ? JSON.parse(r.meta_json) : null }));
}
