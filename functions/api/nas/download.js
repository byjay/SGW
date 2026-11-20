// GET /api/nas/download?path=&exp=&t= — 서명 토큰 자체검증 후 파일 스트림(무Bearer, 미들웨어 PUBLIC).
// 접근권한은 downloadlink 발급 시점에 이미 검증됨(t = HMAC(JWT_SECRET, path:exp)).
import { isConfigured, download } from '../../_lib/nas-client.js';
import { resolvePath } from '../../_lib/nas-map.js';
import { verifyPathToken } from '../../_lib/nas-dl-token.js';

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ request, env }) {
  if (!isConfigured(env)) return json({ error: 'NAS 미설정' }, 503);
  if (!env.JWT_SECRET) return json({ error: 'no_secret' }, 500);
  const u = new URL(request.url);
  const rawPath = u.searchParams.get('path') || '';
  const exp = Number(u.searchParams.get('exp') || 0);
  const t = u.searchParams.get('t') || '';

  const rp = resolvePath(rawPath);
  if (!rp.ok) return json({ error: rp.error }, 400);
  if (!(await verifyPathToken(env.JWT_SECRET, rp.path, exp, t))) {
    return json({ error: 'bad_or_expired_token' }, 403);
  }
  try {
    const res = await download(env, rp.path);
    const headers = new Headers();
    for (const h of ['content-type', 'content-disposition', 'content-length']) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    // 사내 파일 본문이 공용 캐시(CDN/프록시)에 남지 않게 한다 — 토큰 만료 후 재노출 방지.
    headers.set('Cache-Control', 'private, no-store');
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    return json({ error: 'nas_error', message: String((e && e.message) || e) }, 502);
  }
}
