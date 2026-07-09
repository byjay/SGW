/* GET /auth/google/callback?code=...&state=...
 * SSO 모드 + RS256/HS256 자동 분기 (naver/callback.js와 동일 구조)
 */

import { jwtSign, setAuthCookie } from '../../_lib/social-auth.js';
import {
  issueAccessToken, issueRefreshToken,
  setAccessCookie, setRefreshCookie,
} from '../../_lib/refresh.js';
import { completeSsoFlow } from '../../sso/complete.js';
import { writeAudit } from '../../_lib/audit.js';
import { findUserBySub, createUser, touchLastLogin } from '../../_lib/social-users-db.js';

export async function onRequestGet({ request, env }) {
  const url    = new URL(request.url);
  const code   = url.searchParams.get('code');
  const state  = url.searchParams.get('state');
  const origin = url.origin;

  const cookieState = (request.headers.get('cookie') || '')
    .match(/oauth_state=([^;]+)/)?.[1];
  if (!code || !state || state !== cookieState) {
    await writeAudit(env, { event: 'auth.csrf.fail', severity: 'WARN',
      ip: request.headers.get('cf-connecting-ip'), meta: { provider: 'google' }});
    return Response.redirect(`${origin}/?auth_error=invalid_state`, 302);
  }

  // ── 연동(link) 모드 감지 — state가 base64url(JSON {m:'link',...}) 이면 링크 플로우 ──
  //   회귀 금지: 파싱 실패/일반 UUID state는 linkPayload=null → 기존 로그인 흐름 그대로.
  let linkPayload = null;
  try {
    const json = decodeURIComponent(escape(
      atob(state.replace(/-/g, '+').replace(/_/g, '/'))
    ));
    const parsed = JSON.parse(json);
    if (parsed && parsed.m === 'link' && parsed.e) linkPayload = parsed;
  } catch { /* 일반 UUID state → 링크 모드 아님 */ }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI || `${origin}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      await writeAudit(env, { event: 'auth.token.fail', severity: 'ERROR',
        meta: { provider: 'google', err: tokenData.error }});
      return Response.redirect(`${origin}/?auth_error=token_fail`, 302);
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const u = await userRes.json();
    if (!u.id) return Response.redirect(`${origin}/?auth_error=profile_fail`, 302);

    // ── 연동(link) 모드: 구글계정 ↔ 씨스타 직원 매핑을 공유 D1(google_links)에 저장 ──
    //   로그인 세션을 발급하지 않고, 매핑만 upsert 후 앱으로 성공 리다이렉트.
    if (linkPayload) {
      const clearState = new Headers();
      clearState.append('set-cookie', 'oauth_state=; Path=/; Max-Age=0');
      const gEmail = u.email || '';
      if (!env.DB) {
        clearState.set('location', `${origin}/?linked=0&err=no_db`);
        return new Response(null, { status: 302, headers: clearState });
      }
      if (!gEmail) {
        clearState.set('location', `${origin}/?linked=0&err=no_google_email`);
        return new Response(null, { status: 302, headers: clearState });
      }
      try {
        await env.DB.prepare(
          `INSERT INTO google_links(google_email, emp_email, emp_name, linked_at)
           VALUES(?,?,?,?)
           ON CONFLICT(google_email) DO UPDATE SET
             emp_email = excluded.emp_email,
             emp_name  = excluded.emp_name,
             linked_at = excluded.linked_at`
        ).bind(gEmail, linkPayload.e, linkPayload.n || '', Date.now()).run();
      } catch (dbErr) {
        console.error('[google/callback link]', dbErr.message);
        await writeAudit(env, { event: 'auth.link.fail', severity: 'ERROR',
          meta: { provider: 'google', err: dbErr.message }});
        clearState.set('location', `${origin}/?linked=0&err=db_write`);
        return new Response(null, { status: 302, headers: clearState });
      }
      await writeAudit(env, { event: 'auth.link.success', severity: 'INFO',
        ip: request.headers.get('cf-connecting-ip'),
        meta: { provider: 'google', emp_email: linkPayload.e, google_email: gEmail }});
      clearState.set('location', `${origin}/?linked=1&g=${encodeURIComponent(gEmail)}`);
      return new Response(null, { status: 302, headers: clearState });
    }

    const sub = `google:${u.id}`;

    let dbUser = null;
    if (env.DB) {
      dbUser = await findUserBySub(env, sub);
      if (!dbUser) {
        await createUser(env, {
          sub, provider: 'google',
          name: u.name, email: u.email, profile_image: u.picture,
        });
        dbUser = await findUserBySub(env, sub);
      }
      await touchLastLogin(env, sub);
    }

    if (dbUser?.status === 'pending') {
      return Response.redirect(`${origin}${env.PENDING_URL || '/pending'}`, 302);
    }
    if (dbUser?.status === 'rejected') {
      return Response.redirect(`${origin}/?auth_error=rejected`, 302);
    }

    const userClaims = {
      sub,
      provider: 'google',
      name: u.name,
      email: u.email,
      picture: u.picture,
      role: dbUser?.role || 'viewer',
      permissions: dbUser?.permissions ? JSON.parse(dbUser.permissions) : [],
    };

    // SSO 모드
    const sso = await completeSsoFlow(env, request, userClaims);
    if (sso) {
      await writeAudit(env, { event: 'auth.login.success', severity: 'INFO',
        sub, project: sso.clientId, ip: request.headers.get('cf-connecting-ip'),
        meta: { provider: 'google', mode: 'sso' }});
      const headers = new Headers({ location: sso.redirect });
      headers.append('set-cookie', 'oauth_state=; Path=/; Max-Age=0');
      headers.append('set-cookie', 'sso_state=; Path=/; Max-Age=0');
      return new Response(null, { status: 302, headers });
    }

    // 기본 모드
    const headers = new Headers({ location: env.AUTH_SUCCESS_URL || '/' });

    if (env.JWT_PRIVATE_KEY_PEM) {
      const access = await issueAccessToken(env, userClaims);
      const { refreshToken } = env.SESSION_KV
        ? await issueRefreshToken(env, { sub, ip: request.headers.get('cf-connecting-ip'),
            ua: request.headers.get('user-agent') })
        : { refreshToken: null };
      headers.append('set-cookie', setAccessCookie(access, env.ACCESS_COOKIE || 'at', env.COOKIE_DOMAIN));
      if (refreshToken)
        headers.append('set-cookie', setRefreshCookie(refreshToken, env.REFRESH_COOKIE || 'rt', env.COOKIE_DOMAIN));
    } else {
      const ttl = Number(env.JWT_TTL_SEC || 604800);
      const jwt = await jwtSign(userClaims, env.JWT_SECRET || 'CHANGE_ME', ttl);
      headers.append('set-cookie', setAuthCookie(jwt, env.AUTH_COOKIE || 'auth_sess', ttl));
    }

    headers.append('set-cookie', 'oauth_state=; Path=/; Max-Age=0');

    await writeAudit(env, { event: 'auth.login.success', severity: 'INFO',
      sub, ip: request.headers.get('cf-connecting-ip'),
      meta: { provider: 'google', mode: env.JWT_PRIVATE_KEY_PEM ? 'rs256' : 'hs256' }});

    return new Response(null, { status: 302, headers });

  } catch (e) {
    console.error('[google/callback]', e.message);
    await writeAudit(env, { event: 'auth.server_error', severity: 'ERROR',
      meta: { provider: 'google', err: e.message }});
    return Response.redirect(`${origin}/?auth_error=server_error`, 302);
  }
}
