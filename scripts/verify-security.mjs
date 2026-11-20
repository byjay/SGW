// verify-security.mjs — SGW 백엔드 보안 회귀 테스트 (프레임워크 0, node >=18 webcrypto).
//   실행: node scripts/verify-security.mjs      (성공 시 "ALL PASS — N assertions", exit 0)
//
// 각 케이스는 한 쌍이다: **공격 시나리오 = 차단(401/403/400)** + **정상 경로 = 여전히 동작(200)**.
// 보안 수정이 되돌아가면(가드 제거/조건 반전) 여기서 즉시 깨진다.
// D1은 인메모리 목으로 대체한다(우리 코드가 실제로 쓰는 SQL 문법만 해석).
import assert from 'node:assert';

// 리포 상대경로 — 어디서 실행해도 동작(node scripts/verify-security.mjs).
const BASE = new URL('../functions/', import.meta.url).href;
const imp = (p) => import(BASE + p);

// ── 미니 D1 목 (SQLite 대신 인메모리 테이블 + 우리가 쓰는 문법만 해석) ──
function makeDB(tables) {
  const rows = (t) => (tables[t] = tables[t] || []);
  const parse = (sql) => sql.replace(/\s+/g, ' ').trim();
  return {
    prepare(sql) {
      const s = parse(sql);
      let binds = [];
      const stmt = {
        bind(...b) { binds = b; return stmt; },
        async first() {
          // 집계 1건: SELECT MAX(CAST(id AS INTEGER)) AS m FROM t  (id 채번용)
          const mx = /^SELECT MAX\(CAST\(id AS INTEGER\)\) AS m FROM (\w+)$/i.exec(s);
          if (mx) {
            const nums = rows(mx[1]).map((r) => Number(r.id) || 0);
            return { m: nums.length ? Math.max(...nums) : 0 };
          }
          // 정렬 1건: SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1 (감사 체인)
          const ob = /^SELECT (.+?) FROM (\w+) ORDER BY/i.exec(s);
          if (ob && !/ WHERE /i.test(s)) {
            const arr = rows(ob[2]);
            return arr.length ? arr[arr.length - 1] : null;
          }
          const m = /^SELECT (.+?) FROM (\w+) WHERE (.+)$/i.exec(s);
          if (!m) return null;
          const [, , table, where] = m;
          // `col = ?` / `lower(col) = ?` / `col <> ?` 만 해석(우리 코드가 쓰는 문법 전부).
          const conds = where.split(/ AND /i).map((w, i) => {
            const [lhs, op] = /<>/.test(w) ? [w.split('<>')[0], '<>'] : [w.split('=')[0], '='];
            const lo = /lower\(\s*(\w+)\s*\)/i.exec(lhs);
            return { col: lo ? lo[1] : lhs.trim(), lower: !!lo, op, val: binds[i] };
          });
          const norm = (v, lower) => (lower ? String(v).toLowerCase() : String(v));
          const r = rows(table).find((row) =>
            conds.every((c) =>
              c.op === '<>'
                ? norm(row[c.col], c.lower) !== norm(c.val, c.lower)
                : norm(row[c.col], c.lower) === norm(c.val, c.lower)
            )
          );
          return r || null;
        },
        async all() {
          const m = /FROM (\w+)/i.exec(s);
          return { results: rows(m[1]).slice() };
        },
        async run() {
          if (/^INSERT OR REPLACE INTO (\w+)/i.test(s)) {
            const table = /^INSERT OR REPLACE INTO (\w+)/i.exec(s)[1];
            const cols = /\(([^)]+)\)/.exec(s)[1].split(',').map((c) => c.trim());
            const rec = {};
            cols.forEach((c, i) => (rec[c] = binds[i]));
            const arr = rows(table);
            const i = arr.findIndex((r) => String(r.id) === String(rec.id));
            if (i >= 0) arr[i] = rec; else arr.push(rec);
          } else if (/^INSERT INTO (\w+)/i.test(s)) {
            const table = /^INSERT INTO (\w+)/i.exec(s)[1];
            const cols = /\(([^)]+)\)\s*VALUES/i.exec(s)[1].split(',').map((c) => c.trim());
            const rec = {};
            cols.forEach((c, i) => (rec[c] = binds[i]));
            rows(table).push(rec);
          } else if (/^UPDATE (\w+) SET/i.test(s)) {
            const table = /^UPDATE (\w+) SET/i.exec(s)[1];
            const setPart = /SET (.+) WHERE/i.exec(s)[1];
            // `col = ?` 는 바인드를 순서대로 소비, `col = 'lit'` 는 리터럴 사용.
            let bi = 0;
            const sets = setPart.split(',').map((x) => {
              const [lhs, rhs] = x.split('=');
              const col = lhs.trim();
              const raw = (rhs || '').trim();
              return raw === '?'
                ? { col, val: binds[bi++] }
                : { col, val: raw.replace(/^'(.*)'$/, '$1') };
            });
            // WHERE <col> = ?  /  WHERE lower(<col>) = ?  (남은 바인드의 마지막이 키)
            const wm = /WHERE (?:lower\(\s*(\w+)\s*\)|(\w+)) *=/i.exec(s);
            const keyCol = wm ? (wm[1] || wm[2]) : 'id';
            const lower = !!(wm && wm[1]);
            const key = binds[binds.length - 1];
            const norm = (v) => (lower ? String(v).toLowerCase() : String(v));
            const r = rows(table).find((x) => norm(x[keyCol]) === norm(key));
            if (r) sets.forEach(({ col, val }) => (r[col] = val));
          } else if (/^DELETE FROM (\w+)/i.test(s)) {
            const table = /^DELETE FROM (\w+)/i.exec(s)[1];
            tables[table] = rows(table).filter((r) => String(r.id) !== String(binds[0]));
          }
          return { meta: {} };
        },
      };
      return stmt;
    },
  };
}

const req = (url, body, method = 'POST') =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

let pass = 0;
const ok = (name, cond) => {
  assert.ok(cond, 'FAIL: ' + name);
  pass++;
  console.log('  ok  ' + name);
};

// ─────────────────────────────────────────────────────────────
// 1. chat: 방 탈취(IDOR) + 타 방 메시지 주입
// ─────────────────────────────────────────────────────────────
{
  const chat = await imp('api/chat.js');
  const tables = {
    chat_rooms: [{ id: 'room_1', participants: JSON.stringify(['1', '2']), last_message: 'hi' }],
    chat_messages: [{ id: 'msg_1', room_id: 'room_1', sender_id: '1', content: 'secret' }],
  };
  const env = { DB: makeDB(tables) };
  const attacker = { user: { sub: '99', name: 'evil' } };
  const member = { user: { sub: '1', name: 'alice' } };

  // 공격 A: 기존 방 참여자 명단 교체로 대화 탈취
  let r = await chat.onRequestPost({
    request: req('https://x/api/chat?action=room', { id: 'room_1', participants: ['99', '2'] }),
    env, data: attacker,
  });
  ok('chat room takeover blocked (403)', r.status === 403);
  ok('chat room participants unchanged',
    tables.chat_rooms[0].participants === JSON.stringify(['1', '2']));

  // 공격 B: 참여하지 않은 방에 메시지 주입
  r = await chat.onRequestPost({
    request: req('https://x/api/chat', { roomId: 'room_1', content: 'fake' }),
    env, data: attacker,
  });
  ok('chat message injection blocked (403)', r.status === 403);

  // 공격 C: 남의 메시지 행 덮어쓰기
  r = await chat.onRequestPost({
    request: req('https://x/api/chat', { id: 'msg_1', roomId: 'room_1', content: 'tampered' }),
    env, data: { user: { sub: '2' } },
  });
  ok('chat message overwrite blocked (403)', r.status === 403);
  ok('chat message content intact', tables.chat_messages[0].content === 'secret');

  // 정상: 참여자가 자기 방에 메시지 전송
  r = await chat.onRequestPost({
    request: req('https://x/api/chat', { roomId: 'room_1', content: 'hello' }),
    env, data: member,
  });
  ok('chat normal send works (200)', r.status === 200);

  // 정상: 신규 방 생성(본인 포함)
  r = await chat.onRequestPost({
    request: req('https://x/api/chat?action=room', { id: 'room_new', participants: ['1', '3'] }),
    env, data: member,
  });
  ok('chat new room create works (200)', r.status === 200);

  // 정상: 기존 방 참여자가 마지막 메시지 갱신
  r = await chat.onRequestPost({
    request: req('https://x/api/chat?action=room', { id: 'room_1', participants: ['1', '2'], lastMessage: 'x' }),
    env, data: member,
  });
  ok('chat existing room update by member works (200)', r.status === 200);
}

// ─────────────────────────────────────────────────────────────
// 2. messages / mail / memos / minutes / attendance / leave / approvals 행 덮어쓰기
// ─────────────────────────────────────────────────────────────
{
  const msgs = await imp('api/messages.js');
  const tables = { messages: [{ id: 'msg_1', sender_id: '1', receiver_id: '2', content: 'private' }] };
  const env = { DB: makeDB(tables) };
  let r = await msgs.onRequestPost({
    request: req('https://x/api/messages', { id: 'msg_1', receiverId: '9', content: 'hijack' }),
    env, data: { user: { sub: '99' } },
  });
  ok('messages row overwrite blocked (403)', r.status === 403);
  ok('messages content intact', tables.messages[0].content === 'private');

  r = await msgs.onRequestPost({
    request: req('https://x/api/messages', { receiverId: '2', content: 'hello' }),
    env, data: { user: { sub: '1', name: 'a' } },
  });
  ok('messages normal send works (200)', r.status === 200);
}

{
  const mail = await imp('api/mail.js');
  const tables = { internal_mail: [{ id: 'mail_1', sender_id: '1', recipient_id: '2', body: 'confidential' }] };
  const env = { DB: makeDB(tables) };
  let r = await mail.onRequestPost({
    request: req('https://x/api/mail', { id: 'mail_1', recipientId: '9', body: 'x' }),
    env, data: { user: { sub: '99' } },
  });
  ok('mail row overwrite blocked (403)', r.status === 403);
  ok('mail body intact', tables.internal_mail[0].body === 'confidential');

  r = await mail.onRequestPost({
    request: req('https://x/api/mail', { recipientId: '2', subject: 's', body: 'b' }),
    env, data: { user: { sub: '1' } },
  });
  ok('mail normal send works (200)', r.status === 200);
}

{
  const memos = await imp('api/memos.js');
  const tables = { memos: [{ id: 'memo_1', user_id: '1', content: 'mine' }] };
  const env = { DB: makeDB(tables) };
  let r = await memos.onRequestPost({
    request: req('https://x/api/memos', { id: 'memo_1', content: 'stolen' }),
    env, data: { user: { sub: '99' } },
  });
  ok('memo steal blocked (403)', r.status === 403);
  ok('memo owner intact', tables.memos[0].user_id === '1' && tables.memos[0].content === 'mine');

  r = await memos.onRequestPost({
    request: req('https://x/api/memos', { id: 'memo_1', content: 'updated' }),
    env, data: { user: { sub: '1' } },
  });
  ok('memo own update works (200)', r.status === 200);
}

{
  const minutes = await imp('api/minutes.js');
  const tables = { minutes: [{ id: 'minutes_1', author_id: '1', content: 'orig' }] };
  const env = { DB: makeDB(tables) };
  let r = await minutes.onRequestPost({
    request: req('https://x/api/minutes', { id: 'minutes_1', content: 'replaced' }),
    env, data: { user: { sub: '99', role: 'user' } },
  });
  ok('minutes overwrite blocked (403)', r.status === 403);

  r = await minutes.onRequestPost({
    request: req('https://x/api/minutes', { id: 'minutes_1', content: 'edited' }),
    env, data: { user: { sub: '1', role: 'user' } },
  });
  ok('minutes own edit works (200)', r.status === 200);

  r = await minutes.onRequestPost({
    request: req('https://x/api/minutes', { id: 'minutes_1', content: 'mgr' }),
    env, data: { user: { sub: '77', role: 'manager' } },
  });
  ok('minutes manager edit works (200)', r.status === 200);
}

{
  const att = await imp('api/attendance.js');
  const tables = { attendance: [{ id: 'att_1', user_id: '1', type: 'clock_in', timestamp: 1000 }] };
  const env = { DB: makeDB(tables) };
  let r = await att.onRequestPost({
    request: req('https://x/api/attendance', { id: 'att_1', type: 'clock_out' }),
    env, data: { user: { sub: '99' } },
  });
  ok('attendance overwrite blocked (403)', r.status === 403);

  const before = Date.now();
  r = await att.onRequestPost({
    request: req('https://x/api/attendance', { type: 'clock_in', timestamp: 1 }),
    env, data: { user: { sub: '99' } },
  });
  const j = await r.json();
  ok('attendance normal clock-in works (200)', r.status === 200);
  ok('attendance timestamp forced to server clock', j.timestamp >= before);
}

{
  const leave = await imp('api/leave.js');
  const tables = { leave_requests: [{ id: 'leave_1', user_id: '1', status: 'pending', days: 1 }] };
  const env = { DB: makeDB(tables) };

  // 공격: 본인 신청분 update 로 자가승인
  let r = await leave.onRequestPost({
    request: req('https://x/api/leave?action=update&id=leave_1', { status: 'approved' }),
    env, data: { user: { sub: '1', role: 'user' } },
  });
  ok('leave self-approve via update ignored (200 no-op)', r.status === 200);
  ok('leave status still pending', tables.leave_requests[0].status === 'pending');

  // 매니저는 승인 가능
  r = await leave.onRequestPost({
    request: req('https://x/api/leave?action=update&id=leave_1', { status: 'approved' }),
    env, data: { user: { sub: '5', role: 'manager' } },
  });
  ok('leave manager approve works', tables.leave_requests[0].status === 'approved');

  // 상태 화이트리스트
  r = await leave.onRequestPost({
    request: req('https://x/api/leave?action=approve&id=leave_1&status=WHATEVER', {}),
    env, data: { user: { sub: '5', role: 'manager' } },
  });
  ok('leave invalid status rejected (400)', r.status === 400);

  // 남의 연차 행 덮어쓰기
  r = await leave.onRequestPost({
    request: req('https://x/api/leave', { id: 'leave_1', days: 99 }),
    env, data: { user: { sub: '99', role: 'user' } },
  });
  ok('leave row overwrite blocked (403)', r.status === 403);

  // 정상 신청
  r = await leave.onRequestPost({
    request: req('https://x/api/leave', { type: 'annual', days: 1 }),
    env, data: { user: { sub: '99', role: 'user', name: 'z' } },
  });
  ok('leave normal request works (200)', r.status === 200);
}

{
  const apv = await imp('api/approvals.js');
  const tables = { approvals: [{ id: 'apv_1', requester_id: '1', approver_id: '5', status: 'pending' }] };
  const env = { DB: makeDB(tables) };

  // 공격: 상신하면서 스스로 approved
  let r = await apv.onRequestPost({
    request: req('https://x/api/approvals', { id: 'apv_new', title: 't', status: 'approved', approverId: '5' }),
    env, data: { user: { sub: '9', role: 'user' } },
  });
  ok('approval self-approve on submit downgraded (200)', r.status === 200);
  const created = tables.approvals.find((a) => a.id === 'apv_new');
  ok('approval status forced to pending', created.status === 'pending');

  // 공격: 남의 결재문서 덮어쓰기
  r = await apv.onRequestPost({
    request: req('https://x/api/approvals', { id: 'apv_1', title: 'hijack' }),
    env, data: { user: { sub: '9', role: 'user' } },
  });
  ok('approval row overwrite blocked (403)', r.status === 403);

  // 공격: 지정 결재자가 아닌데 decide
  r = await apv.onRequestPost({
    request: req('https://x/api/approvals?action=decide&id=apv_1&status=approved', {}),
    env, data: { user: { sub: '9', role: 'user' } },
  });
  ok('approval decide by non-approver blocked (403)', r.status === 403);

  // 상태 화이트리스트
  r = await apv.onRequestPost({
    request: req('https://x/api/approvals?action=decide&id=apv_1&status=hax', {}),
    env, data: { user: { sub: '5', role: 'user' } },
  });
  ok('approval invalid decide status rejected (400)', r.status === 400);

  // 정상: 지정 결재자가 승인
  r = await apv.onRequestPost({
    request: req('https://x/api/approvals?action=decide&id=apv_1&status=approved', {}),
    env, data: { user: { sub: '5', role: 'user' } },
  });
  ok('approval decide by approver works', tables.approvals[0].status === 'approved');
}

// ─────────────────────────────────────────────────────────────
// 3. board: 공지 발행 권한
// ─────────────────────────────────────────────────────────────
{
  const board = await imp('api/board.js');
  const tables = { posts: [], post_comments: [] };
  const env = { DB: makeDB(tables) };
  await board.onRequestPost({
    request: req('https://x/api/board', { id: 'p1', type: 'notice', title: 'fake notice' }),
    env, data: { user: { sub: '9', role: 'user' } },
  });
  ok('board notice by normal user downgraded', tables.posts.find((p) => p.id === 'p1').type === 'normal');
  await board.onRequestPost({
    request: req('https://x/api/board', { id: 'p2', type: 'notice', title: 'real notice' }),
    env, data: { user: { sub: '5', role: 'admin' } },
  });
  ok('board notice by admin kept', tables.posts.find((p) => p.id === 'p2').type === 'notice');
}

// ─────────────────────────────────────────────────────────────
// 4. NAS 다운로드 서명 토큰: 위조·만료·경로 변경·모호성
// ─────────────────────────────────────────────────────────────
{
  const { signPathToken, verifyPathToken, TOKEN_TTL } = await imp('_lib/nas-dl-token.js');
  const S = 'super-secret';
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL;
  const p = '/02_공유/report.xlsx';
  const t = await signPathToken(S, p, exp);

  ok('dl token valid path passes', (await verifyPathToken(S, p, exp, t)) === true);
  ok('dl token other path fails', (await verifyPathToken(S, '/09_관리자/secret.xlsx', exp, t)) === false);
  ok('dl token expired fails', (await verifyPathToken(S, p, now - 1, t)) === false);
  ok('dl token forged fails', (await verifyPathToken(S, p, exp, 'A'.repeat(t.length))) === false);
  ok('dl token wrong secret fails', (await verifyPathToken('other', p, exp, t)) === false);
  // 모호성: path 에 ':' 가 있어도 (path,exp) 쌍이 뒤바뀌어 통과하면 안 된다.
  const a = await signPathToken(S, '/02_공유/a:123', 456);
  ok('dl token no delimiter confusion', (await verifyPathToken(S, '/02_공유/a', 123, a)) === false);
}

// ─────────────────────────────────────────────────────────────
// 5. NAS 경로/ACL fail-closed
// ─────────────────────────────────────────────────────────────
{
  const { resolvePath } = await imp('_lib/nas-map.js');
  ok('nas path traversal rejected', resolvePath('/02_공유/../09_관리자').ok === false);
  ok('nas relative path rejected', resolvePath('02_공유').ok === false);
  ok('nas outside whitelist rejected', resolvePath('/etc/passwd').ok === false);
  ok('nas backslash traversal rejected', resolvePath('\\02_공유\\..\\09_관리자').ok === false);

  const { accessFor, guardPath } = await imp('_lib/nas-acl.js');
  const env = { DB: makeDB({ nas_acl: [], sgw_users: [{ id: '1', department: 'x', role: 'user', is_part_time: 0 }] }) };
  ok('nas ACL default HIDDEN (fail-closed)',
    (await accessFor(env, { sub: '1', dept: 'x', nrole: 'engineer' }, 'proj_active')) === 'HIDDEN');
  const g = await guardPath(env, { sub: '1' }, '/02_공유/x.txt', 'read');
  ok('nas guardPath denies unmapped folder', g.ok === false && g.status === 403);
}

// ─────────────────────────────────────────────────────────────
// 6. 비밀번호 해시 / JWT 검증
// ─────────────────────────────────────────────────────────────
{
  const { hashPassword, verifyPassword } = await imp('_lib/password.js');
  const h = await hashPassword('correct horse');
  ok('password verify ok', (await verifyPassword('correct horse', h)) === true);
  ok('password verify wrong fails', (await verifyPassword('wrong', h)) === false);
  ok('password malformed stored fails', (await verifyPassword('x', 'garbage')) === false);
  // D1 시드 해시(초기 비번 '1')와 상호운용 확인
  const seed = 'pbkdf2$100000$LiNTpQ2qnbLTSUUeBgl2iA==$CrY6poCCtxb1JUfl4FO0aMO8rA47SqC1hmnRLnwHRGE=';
  ok('password seed hash interop', (await verifyPassword('1', seed)) === true);

  const { jwtSign, jwtVerify, requireAuth } = await imp('_lib/social-auth.js');
  const tok = await jwtSign({ sub: '1', role: 'admin' }, 'secret1');
  ok('jwt verify ok', (await jwtVerify(tok, 'secret1')).sub === '1');
  ok('jwt wrong secret fails', (await jwtVerify(tok, 'secret2')) === null);
  // alg=none / 서명 제거 공격
  const [h1, p1] = tok.split('.');
  ok('jwt stripped signature fails', (await jwtVerify(`${h1}.${p1}.`, 'secret1')) === null);
  const noneHdr = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  ok('jwt alg=none fails', (await jwtVerify(`${noneHdr}.${p1}.`, 'secret1')) === null);
  // 만료
  const expired = await jwtSign({ sub: '1' }, 'secret1', -10);
  ok('jwt expired fails', (await jwtVerify(expired, 'secret1')) === null);
  // fail-closed: JWT_SECRET 미설정
  const fakeReq = new Request('https://x/', { headers: { cookie: `auth_sess=${tok}` } });
  ok('requireAuth fail-closed without JWT_SECRET', (await requireAuth(fakeReq, {})) === null);
  ok('requireAuth works with JWT_SECRET',
    (await requireAuth(fakeReq, { JWT_SECRET: 'secret1' })).sub === '1');
}

// ─────────────────────────────────────────────────────────────
// 7. rbac.readAuth — RS256 우선, HS256 폴백, 시크릿 없으면 null
// ─────────────────────────────────────────────────────────────
{
  const { readAuth } = await imp('_lib/rbac.js');
  const { jwtSign } = await imp('_lib/social-auth.js');
  const tok = await jwtSign({ sub: '7', role: 'user' }, 'S');
  const bearer = new Request('https://x/', { headers: { authorization: `Bearer ${tok}` } });
  ok('readAuth null without any secret', (await readAuth(bearer, {})) === null);
  ok('readAuth HS256 ok', (await readAuth(bearer, { JWT_SECRET: 'S' })).sub === '7');
  ok('readAuth rejects tampered token',
    (await readAuth(new Request('https://x/', { headers: { authorization: 'Bearer a.b.c' } }), { JWT_SECRET: 'S' })) === null);
}

// ─────────────────────────────────────────────────────────────
// 8. _middleware 게이트
// ─────────────────────────────────────────────────────────────
{
  const mw = await imp('_middleware.js');
  const call = async (path, env = {}, headers = {}) => {
    let nexted = false;
    const res = await mw.onRequest({
      request: new Request('https://x' + path, { headers }),
      env,
      data: {},
      next: async () => { nexted = true; return new Response('ok'); },
    });
    return { nexted, status: res.status };
  };
  ok('middleware blocks /api/board without token', (await call('/api/board')).status === 401);
  ok('middleware blocks /api/nas/list without token', (await call('/api/nas/list')).status === 401);
  ok('middleware blocks /api/ai without token', (await call('/api/ai')).status === 401);
  ok('middleware blocks /api/sedms-sso without token', (await call('/api/sedms-sso')).status === 401);
  ok('middleware allows /api/auth/login', (await call('/api/auth/login')).nexted === true);
  ok('middleware allows /api/health', (await call('/api/health')).nexted === true);
  ok('middleware allows /api/nas/download (self-verifying token)', (await call('/api/nas/download')).nexted === true);
  ok('middleware passes static assets', (await call('/index.html')).nexted === true);
  const { jwtSign } = await imp('_lib/social-auth.js');
  const tok = await jwtSign({ sub: '1' }, 'S');
  ok('middleware allows valid bearer',
    (await call('/api/board', { JWT_SECRET: 'S' }, { authorization: `Bearer ${tok}` })).nexted === true);
}

// ─────────────────────────────────────────────────────────────
// 9. sedms-sso — 검증 신원 없으면 401(위조 차단)
// ─────────────────────────────────────────────────────────────
{
  const sso = await imp('api/sedms-sso.js');
  const r = await sso.onRequestGet({
    request: new Request('https://x/api/sedms-sso?format=json&email=ceo@seastargo.com&name=CEO'),
    env: { SGW_SSO_SECRET: 'k' },
  });
  ok('sedms-sso identity spoof via query blocked (401)', r.status === 401);
}

// ─────────────────────────────────────────────────────────────
// 10. logout — 두 세션 쿠키 모두 제거
// ─────────────────────────────────────────────────────────────
{
  const lo = await imp('auth/logout.js');
  const r = await lo.onRequestGet({ env: {} });
  const cookies = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')];
  const joined = cookies.join(' | ');
  ok('logout clears auth_sess', /auth_sess=; .*Max-Age=0/.test(joined));
  ok('logout clears at', /(^|\| )at=; .*Max-Age=0/.test(joined) || /\bat=;/.test(joined));
}

// ─────────────────────────────────────────────────────────────
// 11. middleware: sub 없는 토큰 거부
// ─────────────────────────────────────────────────────────────
{
  const mw = await imp('_middleware.js');
  const { jwtSign } = await imp('_lib/social-auth.js');
  const noSub = await jwtSign({ role: 'admin' }, 'S');
  const res = await mw.onRequest({
    request: new Request('https://x/api/board', { headers: { authorization: `Bearer ${noSub}` } }),
    env: { JWT_SECRET: 'S' }, data: {}, next: async () => new Response('ok'),
  });
  ok('middleware rejects token without sub (401)', res.status === 401);
}

// ─────────────────────────────────────────────────────────────
// 12. change-password: 현재 비번 재확인(초기 비번은 면제)
// ─────────────────────────────────────────────────────────────
{
  const cp = await imp('api/auth/change-password.js');
  const { hashPassword } = await imp('_lib/password.js');
  const initialHash = 'pbkdf2$100000$LiNTpQ2qnbLTSUUeBgl2iA==$CrY6poCCtxb1JUfl4FO0aMO8rA47SqC1hmnRLnwHRGE=';
  const realHash = await hashPassword('OldPassw0rd');

  const mk = (hash) => ({
    JWT_SECRET: 'S',
    DB: makeDB({ sgw_users: [{ id: '1', password_hash: hash }] }),
  });

  // 초기 비번 계정: currentPassword 없이도 변경 가능(강제변경 UX 유지)
  let r = await cp.onRequestPost({
    request: req('https://x/api/auth/change-password', { newPassword: 'Brandnew123' }),
    env: mk(initialHash), data: { user: { sub: '1' } },
  });
  ok('change-password initial-flow works without current (200)', r.status === 200);

  // 실제 비번 계정: currentPassword 없으면 거부(세션 탈취 → 계정 영구탈취 차단)
  r = await cp.onRequestPost({
    request: req('https://x/api/auth/change-password', { newPassword: 'Attacker123' }),
    env: mk(realHash), data: { user: { sub: '1' } },
  });
  ok('change-password without current blocked (403)', r.status === 403);

  // 잘못된 현재 비번
  r = await cp.onRequestPost({
    request: req('https://x/api/auth/change-password', { newPassword: 'Attacker123', currentPassword: 'nope' }),
    env: mk(realHash), data: { user: { sub: '1' } },
  });
  ok('change-password with wrong current blocked (403)', r.status === 403);

  // 정상
  const env2 = mk(realHash);
  r = await cp.onRequestPost({
    request: req('https://x/api/auth/change-password', { newPassword: 'Brandnew123', currentPassword: 'OldPassw0rd' }),
    env: env2, data: { user: { sub: '1' } },
  });
  ok('change-password with correct current works (200)', r.status === 200);

  // 약한 비번
  r = await cp.onRequestPost({
    request: req('https://x/api/auth/change-password', { newPassword: 'short', currentPassword: 'OldPassw0rd' }),
    env: mk(realHash), data: { user: { sub: '1' } },
  });
  ok('change-password rejects weak password (400)', r.status === 400);
}

// ─────────────────────────────────────────────────────────────
// 13. employees: 권한 + 이메일 중복
// ─────────────────────────────────────────────────────────────
{
  const emp = await imp('api/employees.js');
  const seed = () => makeDB({
    sgw_users: [
      { id: '1', name: 'admin', email: 'admin@seastargo.com', role: 'admin' },
      { id: '2', name: 'user', email: 'user@seastargo.com', role: 'user' },
    ],
  });

  // 일반 사용자는 명부 쓰기 불가
  let r = await emp.onRequestPost({
    request: req('https://x/api/employees?action=delete&id=1', {}),
    env: { DB: seed() }, data: { user: { sub: '2', role: 'user' } },
  });
  ok('employees write by normal user blocked (403)', r.status === 403);

  // 매니저는 role 변경 불가(권한 상승 차단) — 요청은 통과하되 role 컬럼은 안 바뀌어야 한다.
  const tbl = { sgw_users: [{ id: '2', name: 'user', email: 'user@seastargo.com', role: 'user' }] };
  r = await emp.onRequestPost({
    request: req('https://x/api/employees?action=update&id=2', { role: 'admin', position: '차장' }),
    env: { DB: makeDB(tbl) }, data: { user: { sub: '9', role: 'manager' } },
  });
  ok('employees role escalation by manager blocked', r.status === 200 && tbl.sgw_users[0].role === 'user');
  ok('employees non-role field still updated by manager', tbl.sgw_users[0].position === '차장');

  // admin 은 role 변경 가능 + 허용값 검증
  const tbl2 = { sgw_users: [{ id: '2', role: 'user' }] };
  r = await emp.onRequestPost({
    request: req('https://x/api/employees?action=update&id=2', { role: 'root' }),
    env: { DB: makeDB(tbl2) }, data: { user: { sub: '1', role: 'admin' } },
  });
  ok('employees invalid role rejected (400)', r.status === 400 && tbl2.sgw_users[0].role === 'user');

  // 이메일 중복 차단
  r = await emp.onRequestPost({
    request: req('https://x/api/employees?action=update&id=2', { email: 'admin@seastargo.com' }),
    env: { DB: seed() }, data: { user: { sub: '9', role: 'manager' } },
  });
  ok('employees duplicate email blocked (409)', r.status === 409);

  // 정상 수정
  r = await emp.onRequestPost({
    request: req('https://x/api/employees?action=update&id=2', { department: '배관' }),
    env: { DB: seed() }, data: { user: { sub: '9', role: 'manager' } },
  });
  ok('employees normal update works (200)', r.status === 200);

  // GET 응답에 password_hash 없음
  const g = await emp.onRequestGet({ env: { DB: seed() } });
  const gj = await g.json();
  ok('employees GET never exposes password_hash',
    gj.employees.every((e) => !('password_hash' in e) && !('passwordHash' in e)));
}

// ─────────────────────────────────────────────────────────────
// 14. AI 프록시: 키 미노출 + 남용 상한
// ─────────────────────────────────────────────────────────────
{
  const ai = await imp('api/ai.js');
  // 키 미설정 → 503, 응답에 힌트만(키 없음)
  let r = await ai.onRequestPost({
    request: req('https://x/api/ai', { messages: [{ role: 'user', content: 'hi' }] }),
    env: {}, data: { user: { sub: '1' } },
  });
  ok('ai without keys returns 503', r.status === 503);
  let body = await r.text();
  ok('ai 503 body leaks no key material', !/sk-|csk-|Bearer /.test(body));

  // 과대 입력 차단
  r = await ai.onRequestPost({
    request: req('https://x/api/ai', { messages: Array.from({ length: 200 }, () => ({ role: 'user', content: 'x' })) }),
    env: { AI_API_KEYS: 'k1' }, data: { user: { sub: '1' } },
  });
  ok('ai too many messages rejected (400)', r.status === 400);

  // 키 로테이션 시 Authorization 헤더로만 키 전달(응답 본문엔 절대 없음)
  const { callWithRotation } = ai;
  let seenAuth = null;
  const fakeFetch = async (url, init) => {
    seenAuth = init.headers.Authorization;
    return new Response('{"ok":true}', { status: 200 });
  };
  const up = await callWithRotation(['secret-key-1'], 'https://up/chat/completions', '{}', fakeFetch);
  ok('ai key sent only via Authorization header', seenAuth === 'Bearer secret-key-1');
  ok('ai upstream body has no key', !(await up.text()).includes('secret-key-1'));
}

// ─────────────────────────────────────────────────────────────
// 15. 입력 검증 상한(본문·첨부)
// ─────────────────────────────────────────────────────────────
{
  const { LIMITS } = await imp('_lib/validate.js');
  const msgs = await imp('api/messages.js');
  const env = { DB: makeDB({ messages: [] }) };
  let r = await msgs.onRequestPost({
    request: req('https://x/api/messages', { receiverId: '2', content: 'x'.repeat(LIMITS.content + 1) }),
    env, data: { user: { sub: '1' } },
  });
  ok('oversized content rejected (400)', r.status === 400);
  r = await msgs.onRequestPost({
    request: req('https://x/api/messages', { receiverId: '2', fileData: 'x'.repeat(LIMITS.fileB64 + 1) }),
    env, data: { user: { sub: '1' } },
  });
  ok('oversized attachment rejected (400)', r.status === 400);
}

// ─────────────────────────────────────────────────────────────
// 16. login: 계정 열거 방지(존재/미존재 응답·비용 동일) + 정상 로그인
// ─────────────────────────────────────────────────────────────
{
  const login = await imp('api/auth/login.js');
  const { hashPassword } = await imp('_lib/password.js');
  const hash = await hashPassword('RealPassw0rd');
  const env = {
    JWT_SECRET: 'S',
    DB: makeDB({ sgw_users: [{ id: '1', name: 'a', email: 'a@seastargo.com', role: 'user', password_hash: hash }] }),
  };
  const call = (email, password) =>
    login.onRequestPost({ request: req('https://x/api/auth/login', { email, password }), env });

  const t0 = Date.now();
  let r = await call('nobody@seastargo.com', 'x');
  const missingMs = Date.now() - t0;
  const missingBody = await r.json();
  ok('login unknown account 401', r.status === 401);

  const t1 = Date.now();
  r = await call('a@seastargo.com', 'wrong');
  const wrongMs = Date.now() - t1;
  const wrongBody = await r.json();
  ok('login wrong password 401', r.status === 401);
  ok('login same error for unknown vs wrong password', missingBody.error === wrongBody.error);
  // 미존재 계정도 PBKDF2 비용을 치르므로 응답시간이 즉답(≈0)이 아니어야 한다.
  ok(`login no timing oracle (missing ${missingMs}ms vs wrong ${wrongMs}ms)`,
    missingMs >= wrongMs * 0.4);

  r = await call('a@seastargo.com', 'RealPassw0rd');
  const good = await r.json();
  ok('login success 200', r.status === 200 && good.ok === true);
  ok('login sets HttpOnly+Secure+SameSite cookie',
    /HttpOnly/.test(r.headers.get('set-cookie')) &&
    /Secure/.test(r.headers.get('set-cookie')) &&
    /SameSite=Lax/.test(r.headers.get('set-cookie')));
  ok('login response is no-store', r.headers.get('cache-control') === 'no-store');
  ok('login never returns password_hash', !JSON.stringify(good).includes('pbkdf2$'));
}

// ─────────────────────────────────────────────────────────────
// 17. 구글 연동 + 이름 기반 간편 로그인 (가입 경로 A 자동 / B 초대 / C 승인)
//     ★ 핵심 불변식: **이름은 절대 인증 수단이 아니다.** 세션은 오직 검증된 구글 ID 토큰으로만.
// ─────────────────────────────────────────────────────────────
{
  const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  const KID = 'test-kid-1';

  // Google 대신 우리가 서명하는 RS256 키쌍 + JWKS 스텁.
  const kp = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']
  );
  const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('googleapis.com/oauth2/v3/certs')) {
      return new Response(JSON.stringify({ keys: [{ ...pubJwk, kid: KID, alg: 'RS256', use: 'sig' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error('unexpected fetch: ' + url);
  };

  const b64u = (bytes) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encStr = (s) => new TextEncoder().encode(s);

  async function idToken(claims = {}, opts = {}) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: opts.alg || 'RS256', typ: 'JWT', kid: opts.kid || KID };
    const payload = {
      iss: 'https://accounts.google.com', aud: CLIENT_ID,
      sub: '100000000000000000001', email: 'new@seastargo.com', email_verified: true,
      name: '신규직원', iat: now, exp: now + 3600, ...claims,
    };
    const h = b64u(encStr(JSON.stringify(header)));
    const b = b64u(encStr(JSON.stringify(payload)));
    const sig = opts.tamper
      ? b64u(encStr('not-a-signature-not-a-signature-x'))
      : b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, encStr(`${h}.${b}`)));
    return `${h}.${b}.${sig}`;
  }

  const gLogin = await imp('api/auth/google/login.js');
  const gLink = await imp('api/auth/google/link.js');
  const lookup = await imp('api/auth/lookup.js');
  const invites = await imp('api/admin/invites.js');
  const approve = await imp('api/admin/approve.js');
  const reject = await imp('api/admin/reject.js');
  const mw = await imp('_middleware.js');

  const seed = () => ({
    sgw_users: [
      // 연동 완료된 직원(동명이인 A)
      { id: '1', name: '김봉정', email: 'designsir@seastargo.com', role: 'admin', department: '전장', position: '부장',
        status: 'active', google_sub: 'g-sub-1', google_email: 'designsir@seastargo.com', google_linked_at: 1 },
      // 같은 이름, 구글 미연동 → lookup 에 절대 노출되면 안 됨
      { id: '2', name: '김봉정', email: 'other@seastargo.com', role: 'user', department: '배관', position: '사원',
        status: 'active' },
      // 이메일만 있고 미연동 — 첫 구글 로그인 시 자동 연결 대상(이름 보존 검증용)
      { id: '3', name: '이선우', email: 'lsw00@seastargo.com', role: 'manager', department: '배관', position: '부장',
        status: 'active' },
    ],
    sgw_invites: [],
    audit_log: [],
  });
  const envOf = (tables) => ({ DB: makeDB(tables), JWT_SECRET: 'S', GOOGLE_CLIENT_ID: CLIENT_ID });
  const callLogin = (env, body) =>
    gLogin.onRequestPost({ request: req('https://x/api/auth/google/login', body), env });

  // ① 이름만으로는 어떤 세션도 나오지 않는다(lookup 은 인증이 아니다).
  {
    const tables = seed();
    const env = envOf(tables);
    const r = await lookup.onRequestPost({ request: req('https://x/api/auth/lookup', { name: '김봉정' }), env });
    const j = await r.json();
    ok('lookup issues no session (no token/cookie)',
      r.status === 200 && !j.token && !r.headers.get('set-cookie'));
    // ⑥ 미연동 계정(id 2)은 후보에 없고, 전체 이메일도 새지 않는다.
    ok('lookup exposes only google-linked candidates',
      j.candidates.length === 1 && j.candidates[0].id === '1');
    ok('lookup masks google email, leaks no full email/role',
      j.candidates[0].googleEmailMasked === 'de***@seastargo.com' &&
      !JSON.stringify(j.candidates).includes('designsir@seastargo.com') &&
      !('role' in j.candidates[0]) && !('email' in j.candidates[0]));
    const empty = await lookup.onRequestPost({ request: req('https://x/api/auth/lookup', { name: '없는사람' }), env });
    ok('lookup unknown name → 200 empty (no existence oracle)',
      empty.status === 200 && (await empty.json()).candidates.length === 0);
    const long = await lookup.onRequestPost({ request: req('https://x/api/auth/lookup', { name: 'x'.repeat(500) }), env });
    ok('lookup oversized name rejected (400)', long.status === 400);
  }

  // ② 위조/변조 토큰 · aud 불일치 · 만료 → 세션 없음
  {
    const env = envOf(seed());
    let r = await callLogin(env, { idToken: await idToken({}, { tamper: true }) });
    ok('google login tampered signature blocked (401)', r.status === 401);
    r = await callLogin(env, { idToken: await idToken({ aud: 'attacker-client-id' }) });
    ok('google login wrong aud blocked (401)', r.status === 401);
    r = await callLogin(env, { idToken: await idToken({ exp: Math.floor(Date.now() / 1000) - 99999 }) });
    ok('google login expired token blocked (401)', r.status === 401);
    r = await callLogin(env, { idToken: await idToken({ iss: 'https://evil.example' }) });
    ok('google login wrong iss blocked (401)', r.status === 401);
  }

  // ⑦ email_verified=false → 거부
  {
    const env = envOf(seed());
    const r = await callLogin(env, { idToken: await idToken({ email_verified: false }) });
    ok('google login unverified email blocked (401)', r.status === 401);
  }

  // ③ 남의 userId 지정(동명이인 사칭) → 401
  {
    const tables = seed();
    const env = envOf(tables);
    const r = await callLogin(env, { idToken: await idToken({ sub: 'g-sub-1', email: 'designsir@seastargo.com' }), userId: '2' });
    ok('google login with other userId blocked (401)', r.status === 401);
    ok('google login mismatch sets no cookie', !r.headers.get('set-cookie'));
    // 정상: 자기 userId 지정 → 200 + 쿠키
    const good = await callLogin(env, { idToken: await idToken({ sub: 'g-sub-1', email: 'designsir@seastargo.com' }), userId: '1' });
    ok('google login with own userId works (200)', good.status === 200);
    ok('google login sets HttpOnly+Secure cookie + no-store',
      /HttpOnly/.test(good.headers.get('set-cookie')) &&
      /Secure/.test(good.headers.get('set-cookie')) &&
      good.headers.get('cache-control') === 'no-store');
  }

  // ⑨⑩⑪⑫ 자동 프로비저닝(경로 A): 최소권한 · 이름 보존 · 감사로그 · 멱등
  {
    const tables = seed();
    const env = envOf(tables);
    const t = await idToken({ sub: 'g-new-1', email: 'newbie@seastargo.com', name: '신입' });
    let r = await callLogin(env, { idToken: t });
    ok('domain user JIT-provisioned + logged in (200)', r.status === 200);
    const created = tables.sgw_users.find((u) => u.email === 'newbie@seastargo.com');
    ok('JIT account gets least privilege role', created && created.role === 'user');
    ok('JIT account is active + name auto-filled', created.status === 'active' && created.name === '신입');
    ok('JIT provision audited',
      tables.audit_log.some((a) => a.event === 'auth.google.provision'));
    // ⑫ 같은 구글 계정 재로그인 → 중복 행 없음
    const before = tables.sgw_users.length;
    r = await callLogin(env, { idToken: t });
    ok('repeat google login is idempotent (no duplicate row)',
      r.status === 200 && tables.sgw_users.length === before);

    // ⑩ 기존 명단의 이름은 구글 프로필 이름이 덮어쓰지 않는다.
    r = await callLogin(env, { idToken: await idToken({ sub: 'g-lsw', email: 'lsw00@seastargo.com', name: 'Google Name' }) });
    const lsw = tables.sgw_users.find((u) => u.id === '3');
    ok('existing roster name not overwritten by google profile',
      r.status === 200 && lsw.name === '이선우' && lsw.google_sub === 'g-lsw');
  }

  // ⑧⑬ 도메인 밖 + 초대 없음 → pending 생성 + 세션 절대 없음(403)
  {
    const tables = seed();
    const env = envOf(tables);
    const r = await callLogin(env, { idToken: await idToken({ sub: 'g-out', email: 'outsider@gmail.com', name: '외부인' }) });
    const j = await r.json();
    ok('outside-domain login blocked (403 approval_pending)', r.status === 403 && j.error === 'approval_pending');
    ok('outside-domain login issues no session', !r.headers.get('set-cookie') && !j.token);
    const p = tables.sgw_users.find((u) => u.email === 'outsider@gmail.com');
    ok('outside-domain user created as pending with least privilege',
      p && p.status === 'pending' && p.role === 'user');
    // ⑬ 재시도해도 계속 403
    const again = await callLogin(env, { idToken: await idToken({ sub: 'g-out', email: 'outsider@gmail.com' }) });
    ok('pending account still cannot get a session (403)', again.status === 403);
    // pending 은 lookup 후보에도 노출되지 않는다.
    const lk = await lookup.onRequestPost({ request: req('https://x/api/auth/lookup', { name: '외부인' }), env });
    ok('pending account not listed by lookup', (await lk.json()).candidates.length === 0);
  }

  // ⑭ pending 계정의 (구)토큰으로도 다른 API 통과 불가 — 미들웨어 status 재확인
  {
    const tables = seed();
    tables.sgw_users.push({ id: '9', name: '대기자', email: 'wait@x.com', role: 'user', status: 'pending' });
    const env = envOf(tables);
    const { jwtSign } = await imp('_lib/social-auth.js');
    const tok = await jwtSign({ sub: '9', role: 'user' }, 'S', 600);
    const call = (sub) => mw.onRequest({
      request: new Request('https://x/api/employees', { headers: { authorization: 'Bearer ' + sub } }),
      env, data: {}, next: async () => new Response('OK', { status: 200 }),
    });
    let r = await call(tok);
    ok('pending account token rejected by middleware (403)', r.status === 403);
    // rejected 도 동일 차단 / active 는 통과
    tables.sgw_users.find((u) => u.id === '9').status = 'rejected';
    r = await call(tok);
    ok('rejected account token rejected by middleware (403)', r.status === 403);
    const okTok = await jwtSign({ sub: '1', role: 'admin' }, 'S', 600);
    r = await call(okTok);
    ok('active account token still passes middleware (200)', r.status === 200);
  }

  // ⑮ rejected 계정 재로그인 차단
  {
    const tables = seed();
    tables.sgw_users.push({ id: '9', name: '거절자', email: 'no@seastargo.com', role: 'user', status: 'rejected',
      google_sub: 'g-rej', google_email: 'no@seastargo.com' });
    const env = envOf(tables);
    const r = await callLogin(env, { idToken: await idToken({ sub: 'g-rej', email: 'no@seastargo.com' }) });
    ok('rejected account cannot log in (403)', r.status === 403 && !r.headers.get('set-cookie'));
  }

  // ⑯ 사전 허용목록(경로 B): 도메인 밖이어도 지정 역할로 즉시 active
  {
    const tables = seed();
    tables.sgw_invites.push({ email: 'partner@vendor.com', role: 'manager', department: '협력', position: '대리', used_at: null });
    const env = envOf(tables);
    const r = await callLogin(env, { idToken: await idToken({ sub: 'g-partner', email: 'partner@vendor.com', name: '협력사' }) });
    ok('invited outside-domain user logs in (200)', r.status === 200);
    const u = tables.sgw_users.find((x) => x.email === 'partner@vendor.com');
    ok('invited user gets the invited role + active', u.role === 'manager' && u.status === 'active');
    ok('invite marked used', tables.sgw_invites[0].used_at != null);
  }

  // ④⑤ link: 남의 구글계정/이미 연결된 sub/도메인 밖 거부 + 정상 연결
  {
    const tables = seed();
    const env = envOf(tables);
    const link = (uid, tok) => gLink.onRequestPost({
      request: req('https://x/api/auth/google/link', { idToken: tok }), env, data: { user: { sub: uid } },
    });
    // 남의 구글 계정(다른 이메일)을 내 계정에 붙이려는 시도 → 403
    let r = await link('2', await idToken({ sub: 'g-other', email: 'designsir@seastargo.com' }));
    ok('link email mismatch blocked (403)', r.status === 403);
    // ④ 이메일은 본인 것이지만 이미 다른 직원이 쓰는 google_sub → 409
    r = await link('2', await idToken({ sub: 'g-sub-1', email: 'other@seastargo.com' }));
    ok('link with google_sub owned by another employee blocked (409)', r.status === 409);
    // ⑤ 도메인 밖 이메일 거부
    r = await link('2', await idToken({ sub: 'g-x', email: 'other@gmail.com' }));
    ok('link outside-domain email blocked (403)', r.status === 403);
    // 정상: 본인 이메일 + 미사용 sub → 200
    r = await link('2', await idToken({ sub: 'g-sub-2', email: 'other@seastargo.com' }));
    ok('link own google account works (200)', r.status === 200 && tables.sgw_users[1].google_sub === 'g-sub-2');
  }

  // ⑰⑱⑲ 관리자 API 권한 — 역할 화이트리스트 · 권한상승 · 일반사용자 차단
  {
    const tables = seed();
    tables.sgw_users.push({ id: '9', name: '신청자', email: 'req@x.com', role: 'user', status: 'pending' });
    const env = envOf(tables);
    const admin = { user: { sub: '1', role: 'admin' } };
    const manager = { user: { sub: '3', role: 'manager' } };
    const plain = { user: { sub: '2', role: 'user' } };

    // ⑰ 임의 역할 문자열
    let r = await invites.onRequestPost({
      request: req('https://x/api/admin/invites', { email: 'a@vendor.com', role: 'root' }), env, data: admin });
    ok('invite with arbitrary role rejected (400)', r.status === 400);
    // ⑱ 매니저가 admin 부여 시도
    r = await invites.onRequestPost({
      request: req('https://x/api/admin/invites', { email: 'a@vendor.com', role: 'admin' }), env, data: manager });
    ok('manager granting admin role blocked (403)', r.status === 403);
    // 정상: 매니저가 user 초대
    r = await invites.onRequestPost({
      request: req('https://x/api/admin/invites', { email: 'a@vendor.com', role: 'user' }), env, data: manager });
    ok('manager invites normal role (200)', r.status === 200);
    // ⑲ 일반 사용자
    r = await invites.onRequestPost({
      request: req('https://x/api/admin/invites', { email: 'b@vendor.com', role: 'user' }), env, data: plain });
    ok('plain user cannot create invites (403)', r.status === 403);
    r = await approve.onRequestPost({
      request: req('https://x/api/admin/approve', { userId: '9', role: 'user' }), env, data: plain });
    ok('plain user cannot approve (403)', r.status === 403);
    r = await reject.onRequestPost({
      request: req('https://x/api/admin/reject', { userId: '9' }), env, data: plain });
    ok('plain user cannot reject (403)', r.status === 403);
    // 매니저가 admin 으로 승인 시도 → 403
    r = await approve.onRequestPost({
      request: req('https://x/api/admin/approve', { userId: '9', role: 'admin' }), env, data: manager });
    ok('manager cannot approve someone as admin (403)', r.status === 403);
    // 정상 승인 → active + 지정 역할
    r = await approve.onRequestPost({
      request: req('https://x/api/admin/approve', { userId: '9', role: 'user' }), env, data: admin });
    const u9 = tables.sgw_users.find((u) => u.id === '9');
    ok('admin approve activates account with role (200)',
      r.status === 200 && u9.status === 'active' && u9.role === 'user');
    // 거절 → rejected
    r = await reject.onRequestPost({
      request: req('https://x/api/admin/reject', { userId: '9', reason: 'x' }), env, data: admin });
    ok('admin reject sets status rejected (200)', r.status === 200 && u9.status === 'rejected');
  }

  globalThis.fetch = realFetch;
}

console.log(`\nALL PASS — ${pass} assertions`);
