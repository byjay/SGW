// POST /api/nas/audit 셀프체크 — D1 모킹으로 ACL 판정 + 감사기록 경로를 실증.
import assert from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { onRequestPost } = await import(
  pathToFileURL(resolve(ROOT, 'functions/api/nas/audit.js')).href
);

const AUDITS = [];
function makeEnv(aclRows, userRow) {
  return {
    DB: {
      prepare(sql) {
        const st = {
          bind() { return st; },
          async first() {
            if (/FROM sgw_users/.test(sql)) return userRow;
            if (/FROM audit_log/.test(sql)) return { hash: 'a'.repeat(64) };
            return null;
          },
          async all() { return { results: /FROM nas_acl/.test(sql) ? aclRows : [] }; },
          async run() {
            if (/INSERT INTO audit_log/.test(sql)) AUDITS.push(st.__binds);
            return { meta: { last_row_id: AUDITS.length } };
          },
        };
        const origBind = st.bind;
        st.bind = (...a) => { st.__binds = a; return st; };
        void origBind;
        return st;
      },
    },
  };
}
function req(body) {
  return new Request('https://x/api/nas/audit', {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.0.0.1' },
    body: JSON.stringify(body),
  });
}
const USER = { sub: 'u1', role: 'user' };
const urow = { department: '설계', role: 'user', is_part_time: 0 };

let pass = 0;
const ok = (l, c) => { assert.ok(c, 'FAIL: ' + l); pass++; console.log('  PASS ' + l); };

// 1. ACL RW → 쓰기 허용 + 기록
{
  const env = makeEnv([{ subject_type: 'role', subject: 'engineer', level: 'RW' }], urow);
  const r = await onRequestPost({ request: req({ action: 'write', folderKey: 'proj_active', path: 'a/b.xlsx', name: 'b.xlsx', size: 12 }), env, data: { user: USER } });
  const j = await r.json();
  ok('RW → 200 allowed', r.status === 200 && j.allowed === true && j.level === 'RW' && j.mapped === true);
  ok('감사기록 1건', AUDITS.length === 1 && AUDITS[0][1] === 'nas.local.write');
  ok('resource = 표준경로', AUDITS[0].includes('/01_프로젝트/진행중/a/b.xlsx'));
}
// 2. ACL RO → 쓰기 차단
{
  const env = makeEnv([{ subject_type: 'role', subject: 'engineer', level: 'RO' }], urow);
  const r = await onRequestPost({ request: req({ action: 'write', folderKey: 'proj_active', path: 'a/b.xlsx' }), env, data: { user: USER } });
  const j = await r.json();
  ok('RO에서 write → 403 denied', r.status === 403 && j.allowed === false && j.error === 'forbidden');
  ok('거부도 감사기록', AUDITS.some((a) => a.includes('denied')));
}
// 3. ACL RO → 읽기 허용
{
  const env = makeEnv([{ subject_type: 'role', subject: 'engineer', level: 'RO' }], urow);
  const r = await onRequestPost({ request: req({ action: 'read', folderKey: 'proj_active', path: 'a/b.xlsx' }), env, data: { user: USER } });
  ok('RO에서 read → 200', r.status === 200 && (await r.json()).allowed === true);
}
// 4. ACL 없음 → HIDDEN 기본 차단
{
  const env = makeEnv([], urow);
  const r = await onRequestPost({ request: req({ action: 'read', folderKey: 'deploy', path: 'x' }), env, data: { user: USER } });
  const j = await r.json();
  ok('ACL 미등록 → 403 HIDDEN', r.status === 403 && j.level === 'HIDDEN');
}
// 5. folderKey 없음(임의 로컬 폴더) → 차단 않고 unmapped 기록
{
  const env = makeEnv([], urow);
  const before = AUDITS.length;
  const r = await onRequestPost({ request: req({ action: 'write', path: 'my/local.txt' }), env, data: { user: USER } });
  const j = await r.json();
  ok('unmapped → 허용+WARN 기록', r.status === 200 && j.allowed === true && j.level === 'UNMAPPED' && j.mapped === false);
  ok('unmapped 감사기록 추가', AUDITS.length === before + 1 && AUDITS[AUDITS.length - 1].includes('ok:unmapped'));
}
// 6. 입력 검증
{
  const env = makeEnv([], urow);
  const bad = await onRequestPost({ request: req({ action: 'rm -rf', path: 'x' }), env, data: { user: USER } });
  ok('허용 외 action → 400', bad.status === 400 && (await bad.json()).error === 'bad_action');
  const esc = await onRequestPost({ request: req({ action: 'write', folderKey: 'proj_active', path: '../../etc/passwd' }), env, data: { user: USER } });
  ok('경로탈출 → 400 bad_path', esc.status === 400 && (await esc.json()).error === 'bad_path');
  const abs = await onRequestPost({ request: req({ action: 'write', folderKey: 'proj_active', path: '/etc/passwd' }), env, data: { user: USER } });
  ok('절대경로 → 400 bad_path', abs.status === 400);
  const long = await onRequestPost({ request: req({ action: 'write', folderKey: 'proj_active', path: 'a', message: 'x'.repeat(10001) }), env, data: { user: USER } });
  ok('과대 입력 → 400 too_long', long.status === 400 && (await long.json()).error === 'too_long');
  const nojson = await onRequestPost({ request: new Request('https://x/api/nas/audit', { method: 'POST', body: 'not json' }), env, data: { user: USER } });
  ok('비 JSON → 400', nojson.status === 400);
}
console.log(`\n== ${pass}/${pass} PASS ==`);
