/* POST /sso/complete — OAuth callback 완료 후 내부 호출
 *
 * Naver/Google callback에서 인증 성공 시 호출하여
 * sso_state 쿠키를 읽고 외부 redirect_uri로 토큰 전달
 *
 * 토큰 전달 방식: redirect_uri에 short-lived "code" 파라미터로 전달
 *   외부 프로젝트는 /sso/exchange?code=... 로 실제 토큰 교환
 *   (Authorization Code Flow 흉내 — XSS/referrer 누출 방지)
 */

import { issueAccessToken, issueRefreshToken } from '../_lib/refresh.js';
import { writeAudit } from '../_lib/audit.js';
import { verifyClientSecret } from '../_lib/sso-clients-db.js';

function getCookie(req, name) {
  const m = (req.headers.get('cookie') || '')
    .match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? m[1] : null;
}

const b64dec = (s) => {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return atob(s + '='.repeat(pad));
};

/**
 * SSO 완료 처리 — provider 콜백에서 호출
 * @returns { redirect: string }  외부 프로젝트로 보낼 URL
 */
export async function completeSsoFlow(env, request, user) {
  const ssoStateRaw = getCookie(request, 'sso_state');
  if (!ssoStateRaw) return null;  // SSO 모드 아님 → 일반 로그인

  let ssoState;
  try { ssoState = JSON.parse(b64dec(ssoStateRaw)); }
  catch { return null; }

  const { clientId, redirectUri, userState, nonce, ts } = ssoState;
  if (Date.now() - ts > 600_000) return null;  // 10분 초과 → 무효

  // SSO 코드 발급 (1회용, 60초 유효)
  const ssoCode = crypto.randomUUID();
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = request.headers.get('user-agent') || '';

  if (env.SESSION_KV) {
    await env.SESSION_KV.put(
      `sso-code:${ssoCode}`,
      JSON.stringify({
        clientId, sub: user.sub, name: user.name, email: user.email,
        provider: user.provider, role: user.role, permissions: user.permissions,
        ip, ua, nonce, createdAt: Date.now(),
      }),
      { expirationTtl: 60 }
    );
  } else {
    return null;  // KV 미설정
  }

  await writeAudit(env, {
    event: 'sso.code.issued', severity: 'INFO',
    sub: user.sub, project: clientId, ip, ua,
  });

  const url = new URL(redirectUri);
  url.searchParams.set('code', ssoCode);
  if (userState) url.searchParams.set('state', userState);

  return { redirect: url.toString(), clientId };
}

/* POST /sso/exchange — 외부 프로젝트가 code → token 교환
 *
 * 외부 프로젝트 백엔드(Cloudflare Pages Function)가 호출:
 *   POST /sso/exchange
 *     { code: "...", client_id: "sedms", client_secret: "..." }
 *
 *   → { access_token, refresh_token, expires_in, user }
 */
export async function onRequestPost({ request, env }) {
  if (!env.SESSION_KV) {
    return new Response(JSON.stringify({ ok: false, error: 'kv_not_configured' }),
      { status: 500, headers: { 'content-type': 'application/json' }});
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response('{}', { status: 400 }); }

  const { code, client_id, client_secret } = body;
  if (!code || !client_id || !client_secret) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_params' }),
      { status: 400, headers: { 'content-type': 'application/json' }});
  }

  // 클라이언트 시크릿 검증 (D1 sso_clients 테이블 기반)
  const ok = await verifyClientSecret(env, client_id, client_secret);
  if (!ok) {
    await writeAudit(env, {
      event: 'sso.exchange.invalid_client', severity: 'CRITICAL',
      project: client_id, ip: request.headers.get('cf-connecting-ip'),
    });
    return new Response(JSON.stringify({ ok: false, error: 'invalid_client' }),
      { status: 401, headers: { 'content-type': 'application/json' }});
  }

  // 코드 1회 사용 + 즉시 삭제
  const raw = await env.SESSION_KV.get(`sso-code:${code}`);
  if (!raw) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_or_expired_code' }),
      { status: 400, headers: { 'content-type': 'application/json' }});
  }
  await env.SESSION_KV.delete(`sso-code:${code}`);

  const codeData = JSON.parse(raw);
  if (codeData.clientId !== client_id) {
    await writeAudit(env, {
      event: 'sso.exchange.client_mismatch', severity: 'CRITICAL',
      sub: codeData.sub, project: client_id,
    });
    return new Response(JSON.stringify({ ok: false, error: 'client_mismatch' }),
      { status: 400, headers: { 'content-type': 'application/json' }});
  }

  // Access + Refresh 발급
  const access = await issueAccessToken(env, {
    sub: codeData.sub,
    provider: codeData.provider,
    name: codeData.name,
    email: codeData.email,
    role: codeData.role || 'viewer',
    permissions: codeData.permissions || [],
    aud: client_id,
  });

  const { refreshToken } = await issueRefreshToken(env, {
    sub: codeData.sub,
    ip: codeData.ip, ua: codeData.ua,
  });

  await writeAudit(env, {
    event: 'sso.token.issued', severity: 'INFO',
    sub: codeData.sub, project: client_id,
    ip: request.headers.get('cf-connecting-ip'),
  });

  return new Response(JSON.stringify({
    ok: true,
    access_token: access,
    refresh_token: refreshToken,
    expires_in: parseInt(env.JWT_ACCESS_TTL_SEC || '900'),
    token_type: 'Bearer',
    user: {
      sub: codeData.sub,
      name: codeData.name,
      email: codeData.email,
      provider: codeData.provider,
      role: codeData.role,
      permissions: codeData.permissions,
    },
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
