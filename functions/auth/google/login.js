/* GET /auth/google/login — Google OAuth 인증 시작
 * 필수 env: GOOGLE_CLIENT_ID
 * 선택 env: GOOGLE_REDIRECT_URI
 *
 * 연동(link) 모드: ?link=1&email=<empEmail>&name=<empName>
 *   → 직원 식별정보를 state에 실어 콜백에서 google_links 매핑 저장에 사용.
 *   기존 로그인 흐름(파라미터 없을 때)은 그대로 유지.
 */

const b64url = (str) =>
  btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

export async function onRequestGet({ request, env }) {
  const reqUrl = new URL(request.url);
  const origin = reqUrl.origin;

  // ── 연동(link) 모드 감지 ──
  const isLink   = reqUrl.searchParams.get('link') === '1';
  const empEmail = reqUrl.searchParams.get('email') || '';
  const empName  = reqUrl.searchParams.get('name')  || '';

  // state = CSRF nonce + (link 모드면) 직원 식별정보를 담은 base64url(JSON).
  //   콜백은 이 state를 oauth_state 쿠키와 대조(CSRF)하므로 둘을 동일 값으로 둔다.
  let state;
  if (isLink && empEmail) {
    state = b64url(JSON.stringify({
      m: 'link',
      e: empEmail,
      n: empName,
      r: crypto.randomUUID(),
    }));
  } else {
    state = crypto.randomUUID();
  }

  const params = new URLSearchParams({
    client_id     : env.GOOGLE_CLIENT_ID,
    redirect_uri  : env.GOOGLE_REDIRECT_URI || `${origin}/auth/google/callback`,
    response_type : 'code',
    scope         : 'openid email profile',
    access_type   : 'offline',
    state,
  });
  const headers = new Headers({
    location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  });
  headers.append('set-cookie',
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`
  );
  return new Response(null, { status: 302, headers });
}
