/* google-provision.js — 구글 로그인 시 sgw_users 자동 연동·자동 등재(JIT 프로비저닝).
 *
 * 신뢰 근거: 회사 Workspace 도메인(@seastargo.com)은 **회사가 발급·회수를 통제**한다.
 *   그 도메인의 email_verified 된 구글 계정이라면 "우리 직원"이라는 사실 자체는 구글이 보증한다.
 *   → 이름 수기 입력·수동 link 버튼 없이 명단 등재까지 자동으로 처리해도 안전하다.
 *   단, **권한은 자동으로 주지 않는다**(항상 최하위 role). 승격은 관리자 화면에서만.
 *
 * ★ 도메인 게이트를 통과한 뒤에만 호출할 것(호출측 책임). 이 함수는 도메인을 재검사하지 않는다.
 *
 * ponytail: Google Directory API 일괄 동기화는 도메인 전체 위임(domain-wide delegation)
 *   설정이 필요해 운영자 물리작업이 생긴다. 직원이 어차피 로그인해야 쓰는 시스템이므로
 *   JIT(첫 로그인 시 등재)로 충분하다. 향후 일괄 동기화가 필요하면 이 파일의
 *   linkExistingUser / createUserFromGoogle 을 그대로 재사용하면 된다.
 */
import { writeAudit } from './audit.js';
import { ASSIGNABLE_ROLES } from './sgw-roles.js';

// 신규 자동 등재 계정의 기본 역할 = 최하위(sgw_users role ∈ admin|manager|user).
export const DEFAULT_PROVISION_ROLE = 'user';

const today = () => new Date().toISOString().slice(0, 10);

/** 이메일 로컬파트(이름 폴백용). */
function localPart(email) {
  const at = String(email || '').indexOf('@');
  return at > 0 ? String(email).slice(0, at) : String(email || '');
}

/** 이미 연동된 계정 조회(멱등성의 핵심 — 2회째 로그인은 여기서 끝난다). */
export async function findByGoogleSub(env, gSub) {
  return env.DB.prepare(
    'SELECT id, name, email, role, department, position, status, google_sub FROM sgw_users WHERE google_sub = ?'
  ).bind(gSub).first();
}

/** 이메일이 일치하는 기존 명단 행에 구글 계정을 자동 연결. */
async function linkExistingUser(env, row, { gSub, gEmail, gName, ip }) {
  if (row.google_sub && String(row.google_sub) !== String(gSub)) {
    // 같은 사내 계정에 다른 구글 계정을 덧씌우는 경로 = 계정 탈취 시도.
    return { ok: false, status: 409, error: 'already_linked_other' };
  }
  // 사내 명단이 정본 — 이름이 이미 있으면 구글 프로필 이름으로 덮어쓰지 않는다.
  const name = String(row.name || '').trim() || String(gName || '').trim() || localPart(gEmail);
  await env.DB.prepare(
    'UPDATE sgw_users SET google_sub = ?, google_email = ?, google_linked_at = ?, name = ? WHERE id = ?'
  ).bind(gSub, gEmail, Date.now(), name, String(row.id)).run();

  await writeAudit(env, {
    event: 'auth.google.link.auto', severity: 'INFO', sub: String(row.id), ip,
    meta: { email: gEmail, provider: 'google' },
  });
  return { ok: true, row: { ...row, name, google_sub: gSub, google_email: gEmail } };
}

/** 신규 행 생성. status/role/부서는 호출측(가입 경로 A/B/C)이 결정한다. */
async function createUserFromGoogle(env, { gSub, gEmail, gName, ip }, opts = {}) {
  const status = opts.status === 'pending' ? 'pending' : 'active';
  // ★ 관리자 권한 자동 부여 금지 — 초대(B)로 지정된 역할이라도 화이트리스트를 통과한 값만 온다.
  const role = ASSIGNABLE_ROLES.has(String(opts.role || '')) ? String(opts.role) : DEFAULT_PROVISION_ROLE;
  const mx = await env.DB.prepare('SELECT MAX(CAST(id AS INTEGER)) AS m FROM sgw_users').first();
  const id = String((mx && Number(mx.m) ? Number(mx.m) : 0) + 1);
  const name = String(gName || '').trim() || localPart(gEmail);
  const row = {
    id, name, email: gEmail, role,
    department: String(opts.department || ''), position: String(opts.position || ''),
    annual_leave: 0, total_leave: 15, carryover: 0,
    join_date: today(), status, is_part_time: 0,
    google_sub: gSub, google_email: gEmail, google_linked_at: Date.now(),
  };
  await env.DB.prepare(
    'INSERT INTO sgw_users(id, name, email, role, department, position, annual_leave, total_leave, carryover, join_date, status, is_part_time, google_sub, google_email, google_linked_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(
    row.id, row.name, row.email, row.role, row.department, row.position,
    row.annual_leave, row.total_leave, row.carryover, row.join_date,
    row.status, row.is_part_time, row.google_sub, row.google_email, row.google_linked_at
  ).run();

  await writeAudit(env, {
    event: 'auth.google.provision', severity: 'INFO', sub: id, ip,
    meta: { email: gEmail, name: row.name, role: row.role, status, path: opts.path || 'domain', provider: 'google' },
  });
  return { ok: true, row, created: true };
}

/** 사전 허용목록(초대) 조회 — 표가 없거나(마이그레이션 전) 소진됐으면 null. */
async function findInvite(env, gEmail) {
  const r = await env.DB.prepare(
    'SELECT email, role, department, position, used_at FROM sgw_invites WHERE lower(email) = ?'
  ).bind(String(gEmail).toLowerCase()).first().catch(() => null);
  return r || null;
}

/**
 * 구글 계정 → sgw_users 행 확보(연동/등재 자동).
 * 가입 경로: A 도메인 자동 / B 사전 허용(초대) / C 가입 신청(pending).
 * ★ 세션 발급 여부는 호출측이 row.status 로 최종 판정한다(여기서는 행만 확보).
 *
 * @param {{gSub:string,gEmail:string,gName?:string,ip?:string,domainAllowed:boolean}} p
 * @returns {Promise<{ok:true,row:object,created?:boolean,path?:string}|{ok:false,status:number,error:string}>}
 */
export async function resolveGoogleUser(env, { gSub, gEmail, gName, ip, domainAllowed }) {
  // 1) 이미 연동됨 → 그대로 사용(중복 행 생성 없음 = 멱등).
  const linked = await findByGoogleSub(env, gSub);
  if (linked) return { ok: true, row: linked, path: 'existing' };

  // 2) 사내 명단에 같은 이메일이 있으면 자동 연결.
  const byEmail = await env.DB.prepare(
    'SELECT id, name, email, role, department, position, status, google_sub FROM sgw_users WHERE lower(email) = ?'
  ).bind(String(gEmail).toLowerCase()).first();
  if (byEmail) {
    const r = await linkExistingUser(env, byEmail, { gSub, gEmail, gName, ip });
    return r.ok ? { ...r, path: 'link' } : r;
  }

  // 3-A) 회사 도메인 → 즉시 active + 최소 권한.
  if (domainAllowed) {
    return createUserFromGoogle(env, { gSub, gEmail, gName, ip },
      { status: 'active', role: DEFAULT_PROVISION_ROLE, path: 'domain' });
  }

  // 3-B) 관리자가 미리 허용한 이메일(초대) → 즉시 active + 지정 역할/부서.
  const invite = await findInvite(env, gEmail);
  if (invite && !invite.used_at) {
    const created = await createUserFromGoogle(env, { gSub, gEmail, gName, ip }, {
      status: 'active',
      role: invite.role || DEFAULT_PROVISION_ROLE,
      department: invite.department || '',
      position: invite.position || '',
      path: 'invite',
    });
    if (created.ok) {
      await env.DB.prepare('UPDATE sgw_invites SET used_at = ? WHERE lower(email) = ?')
        .bind(Date.now(), String(gEmail).toLowerCase()).run().catch(() => {});
    }
    return created.ok ? { ...created, path: 'invite' } : created;
  }

  // 3-C) 그 외 → 가입 신청(pending). 세션은 발급되지 않는다(호출측 403).
  return createUserFromGoogle(env, { gSub, gEmail, gName, ip },
    { status: 'pending', role: DEFAULT_PROVISION_ROLE, path: 'pending' });
}

// 셀프체크: 이름 폴백 규칙이 깨지면 로드 시 throw.
if (localPart('kohyk@seastargo.com') !== 'kohyk' || localPart('noat') !== 'noat') {
  throw new Error('google-provision.js self-check failed');
}
