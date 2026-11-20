// POST /api/nas/audit — 로컬(브라우저 직결) 모드의 파일 작업에 ACL 판정 + 감사로그를 붙인다.
//
// 왜 필요한가: 하이브리드의 로컬 절반(window.sgwNasLocal)은 브라우저가 NAS를 직접 읽고 쓰므로
// 서버를 거치지 않는다 → 기존 /api/nas/* 의 guardPath·writeAudit 가 전혀 적용되지 않는다.
// 이 엔드포인트가 그 공백을 메운다. 로직은 신규 작성 0 — guardPath + writeAudit 재사용.
//
// ⚠ 한계(정직한 명시): 클라이언트가 자진 신고하는 구조라 **권고적(advisory)** 이다.
//    실제 강제는 NAS 공유 권한(SMB/DSM 계정)이 담당한다. 이 로그는 "누가 무엇을 했다고
//    앱이 보고했는가"의 기록이며, 서버 경유 로그(nas.upload 등)와 event 접두어로 구분된다.
//
// 요청 body (JSON):
//   { action:'read'|'write'|'delete'|'list'|'pick',   // 필수
//     folderKey?:'proj_active'|...,                   // 표준 폴더키(있으면 ACL 판정)
//     path?:'하위/경로/파일.xlsx',                     // folderKey 기준 상대경로
//     name?:string, size?:number,
//     result?:'ok'|'fail',                            // 사후보고일 때(기본 'ok')
//     message?:string }
// 응답: 200 { ok:true, allowed:true, level, mapped }  — 진행해도 됨
//       403 { ok:false, allowed:false, error:'forbidden', level } — 클라이언트는 중단해야 함
//
// 사용 순서: 쓰기/삭제는 **작업 전 preflight**(allowed 확인 후 실행), 읽기/목록은 사후 기록도 무방.
import { FOLDER_ROOTS } from '../../_lib/nas-map.js';
import { guardPath } from '../../_lib/nas-acl.js';
import { writeAudit } from '../../_lib/audit.js';
import { LIMITS, over } from '../../_lib/validate.js';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

const ACTIONS = new Set(['read', 'write', 'delete', 'list', 'pick']);
const WRITE_ACTIONS = new Set(['write', 'delete']);

// 클라 상대경로 위생: 역슬래시 정규화, '..'·절대경로 차단.
function safeRel(p) {
  const raw = String(p || '').replace(/\\/g, '/');
  if (!raw) return '';
  if (raw.startsWith('/') || /^[a-zA-Z]:\//.test(raw)) return null;
  const segs = raw.split('/').filter((s) => s && s !== '.');
  if (segs.some((s) => s === '..')) return null;
  return segs.join('/');
}

export async function onRequestPost({ request, env, data }) {
  const user = data && data.user;
  let body;
  try { body = await request.json(); } catch { body = null; }
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad_json' }, 400);

  const action = String(body.action || '');
  if (!ACTIONS.has(action)) return json({ ok: false, error: 'bad_action' }, 400);
  if (over(body.message, LIMITS.content) || over(body.path, LIMITS.reason) || over(body.name, LIMITS.title)) {
    return json({ ok: false, error: 'too_long' }, 400);
  }

  const rel = safeRel(body.path);
  if (rel === null) return json({ ok: false, error: 'bad_path' }, 400);

  const folderKey = body.folderKey ? String(body.folderKey) : '';
  const root = folderKey ? FOLDER_ROOTS[folderKey] : null;
  const ip = request.headers.get('cf-connecting-ip');
  const ua = request.headers.get('user-agent');
  const result = body.result === 'fail' ? 'fail' : 'ok';
  const base = {
    event: `nas.local.${action}`,
    action,
    ip, ua,
    resource: (root ? root : '(unmapped)') + (rel ? '/' + rel : ''),
  };

  // 표준 폴더에 매핑되지 않은 로컬 폴더(사용자가 임의 폴더를 고른 경우):
  // 서버가 막을 수단이 없다 → 차단하지 않고 'unmapped' 로 남겨 추적만 한다.
  if (!root) {
    await writeAudit(env, {
      ...base, severity: 'WARN', sub: (user && (user.sub || user.id)) || null,
      result: `${result}:unmapped`, mode: 'local', name: body.name || null, size: body.size || null,
      message: body.message || null,
    }).catch(() => {});
    return json({ ok: true, allowed: true, level: 'UNMAPPED', mapped: false });
  }

  const need = WRITE_ACTIONS.has(action) ? 'write' : 'read';
  const g = await guardPath(env, user, rel ? `${root}/${rel}` : root, need);
  if (!g.ok) {
    await writeAudit(env, {
      ...base, severity: 'WARN', sub: (user && (user.sub || user.id)) || null,
      result: 'denied', mode: 'local', folder_key: folderKey, level: g.level || null,
      name: body.name || null,
    }).catch(() => {});
    return json({ ok: false, allowed: false, error: g.error, level: g.level }, g.status);
  }

  await writeAudit(env, {
    ...base, sub: g.uctx.sub, result, mode: 'local',
    folder_key: g.folderKey, level: g.level,
    name: body.name || null, size: typeof body.size === 'number' ? body.size : null,
    message: body.message || null,
  }).catch(() => {});

  return json({ ok: true, allowed: true, level: g.level, mapped: true });
}
