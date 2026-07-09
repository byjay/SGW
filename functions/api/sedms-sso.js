/* GET /api/sedms-sso — SGW 로그인 직원을 SEDMS(sedms.app)로 재로그인 없이 진입시킨다.
 *
 * 흐름:
 *   1. 서버 검증된 신원(readAuth: 구글 OAuth가 심은 at/auth_sess 쿠키)을 우선 취득.
 *   2. 없으면(현 SGW 웹앱은 localStorage mock 로그인 → 서버가 신원 검증 불가)
 *      쿼리스트링으로 넘어온 email/name/emp_id를 최소 방어 하에 사용.
 *   3. SEDMS_G sgwSso.ts 규격대로 HMAC 서명 → https://sedms.app/sso/sgw?... 로 302.
 *
 * ⚠️ SGW_SSO_SECRET 은 절대 클라이언트에 노출되지 않는다(이 서버 함수 내부에서만 사용).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ponytail: 트러스트 바운더리 한계 (숨기지 않음)
 *   현재 SGW 웹앱 로그인은 localStorage 기반 mock 이라 서버가 "누가 로그인했는지"를
 *   독립적으로 검증할 수 없다. 서버 세션 쿠키(readAuth)가 없는 상태에서 클라이언트가
 *   주장하는 email/name 을 그대로 서명하면, 임의 사용자가 타인(관리자 등) 신원을
 *   위조해 SEDMS 세션을 획득할 수 있다.
 *   → 최소 방어: email 도메인을 사내(@seastargo.com)로 강제 + exp 120초로 단축.
 *   → 완전 해결(업그레이드 경로): SGW 로그인을 sgw-admin JWT 서버 로그인으로 전환하면
 *     readAuth 가 항상 검증된 신원을 돌려주므로 클라이언트 주장 값은 폐기 가능.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readAuth } from '../_lib/rbac.js';
import { buildSedmsSsoUrl } from '../_lib/sgw-sso.js';

// 사내 이메일 도메인(트러스트 바운더리 최소 방어 — mock 로그인 상태에서만 의미).
const ALLOWED_EMAIL_DOMAIN = '@seastargo.com';
const SEDMS_BASE = 'https://sedms.app';

function htmlError(status, message) {
  return new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>SEDMS 진입 오류</title>` +
    `<style>body{background:#0D1117;color:#E6EDF3;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;` +
    `display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}` +
    `.box{max-width:420px;padding:32px;text-align:center}` +
    `h1{font-size:18px;color:#F85149;margin:0 0 12px}p{color:#9CA3AF;line-height:1.6;font-size:14px}</style>` +
    `</head><body><div class="box"><h1>SEDMS 진입 오류</h1><p>${message}</p></div></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
}

export async function onRequestGet({ request, env }) {
  // 시크릿 미설정 → 크래시 대신 명확한 안내.
  const secret = env.SGW_SSO_SECRET;
  if (!secret) {
    return htmlError(
      503,
      'SEDMS 연동이 아직 설정되지 않았습니다. (SGW_SSO_SECRET 미설정) 관리자에게 문의하세요.',
    );
  }

  const url = new URL(request.url);
  // JSON 응답을 원하면 ?format=json (프론트에서 fetch 후 window.open 하고 싶을 때).
  const wantJson = url.searchParams.get('format') === 'json';

  // ── 1. 서버 검증된 신원 우선 ──────────────────────────────────────────────
  let identity = null;
  const authUser = await readAuth(request, env).catch(() => null);
  if (authUser) {
    // 검증된 신원(구글 OAuth 등). 클라이언트 주장 값보다 항상 우선.
    identity = {
      employee_id: authUser.sub || authUser.employeeId || authUser.email || 'unknown',
      name: authUser.name || authUser.email || 'SGW User',
      email: authUser.email || null,
      dept: authUser.department || authUser.dept || null,
      sgw_role: authUser.role || null,
    };
  } else {
    // ── 2. mock 로그인 폴백 (서버 검증 신원 없음) ───────────────────────────
    //   클라이언트가 준 값 사용 + 사내 도메인 강제(최소 방어).
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();
    const name = (url.searchParams.get('name') || '').trim();
    const empId = (url.searchParams.get('emp_id') || '').trim();
    const role = (url.searchParams.get('role') || '').trim();
    const dept = (url.searchParams.get('dept') || '').trim();

    if (!email || !name) {
      return wantJson
        ? Response.json({ ok: false, error: 'missing_identity' }, { status: 400 })
        : htmlError(400, '로그인 정보가 없습니다. SGW에 로그인 후 다시 시도하세요.');
    }
    if (!email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      return wantJson
        ? Response.json({ ok: false, error: 'domain_not_allowed' }, { status: 403 })
        : htmlError(403, `사내 이메일(${ALLOWED_EMAIL_DOMAIN}) 계정만 SEDMS에 진입할 수 있습니다.`);
    }
    identity = {
      employee_id: empId || email,
      name,
      email,
      dept: dept || null,
      sgw_role: role || null,
    };
  }

  // ── 3. 서명 URL 생성 ─────────────────────────────────────────────────────
  const ssoUrl = await buildSedmsSsoUrl(identity, secret, {
    sedmsBase: SEDMS_BASE,
    ttlSec: 120, // 짧게(위조 위험 최소화)
  });

  if (wantJson) {
    return Response.json({ ok: true, url: ssoUrl }, { headers: { 'cache-control': 'no-store' } });
  }
  return new Response(null, {
    status: 302,
    headers: { location: ssoUrl, 'cache-control': 'no-store' },
  });
}
