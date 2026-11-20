// POST /api/auth/lookup  {name}
//   → 그 이름으로 **구글 연동이 완료된** 계정 후보만 반환(동명이인 선택용).
//
// ★ 이 엔드포인트는 인증이 아니다. 세션/토큰을 절대 발급하지 않는다.
//   이름은 "계정 선택기"일 뿐이고, 실제 신원 증명은 다음 단계의 구글 ID 토큰 검증
//   (POST /api/auth/google/login)이 전담한다.
//
// 계정 열거 최소화:
//   * 반환 필드는 화면 구분에 필요한 최소치 + 마스킹된 구글 이메일뿐(전체 이메일·전화·역할 노출 금지).
//   * 매칭 0건이어도 200 + 빈 배열(404/에러로 존재 여부를 알려주지 않는다).
//   * IP당 분당 20회 rate limit.
import { json } from '../../_lib/social-auth.js';
import { checkRateLimit } from '../../_lib/rate-limit.js';
import { LIMITS } from '../../_lib/validate.js';
import { isActiveAccount } from '../../_lib/session.js';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** designsir@seastargo.com → de***@seastargo.com (앞 2자만 노출) */
export function maskEmail(email) {
  const s = String(email || '');
  const at = s.lastIndexOf('@');
  if (at < 1) return '';
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const head = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${head}***@${domain}`;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, { status: 500, headers: NO_STORE });

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await checkRateLimit(env, `lookup:${ip}`, { limit: 20, windowSec: 60 });
    if (!rl.ok) {
      return json({ ok: false, error: 'rate_limited' }, {
        status: 429,
        headers: { ...NO_STORE, 'Retry-After': String(Math.max(1, rl.resetAt - Math.floor(Date.now() / 1000))) },
      });
    }

    let body;
    try { body = await request.json(); } catch { body = null; }
    const name = (body && body.name != null ? String(body.name) : '').trim();
    if (!name || name.length > LIMITS.name) {
      return json({ ok: false, error: 'bad_name' }, { status: 400, headers: NO_STORE });
    }

    const res = await env.DB.prepare(
      'SELECT id, name, department, position, google_email, google_sub, status FROM sgw_users WHERE name = ?'
    ).bind(name).all();

    const candidates = (res.results || [])
      // ponytail: SQL WHERE 와 중복이지만 의도된 방어선 —
      //   미연동 계정이 이 응답으로 새는 경로를 코드 레벨에서도 봉쇄한다(쿼리 실수 내성).
      .filter((r) => String(r.name || '') === name && r.google_sub && r.google_email && isActiveAccount(r))
      .map((r) => ({
        id: String(r.id),
        name: r.name || '',
        department: r.department || '',
        position: r.position || '',
        googleEmailMasked: maskEmail(r.google_email),
      }));

    return json({ ok: true, candidates }, { headers: NO_STORE });
  } catch {
    return json({ ok: false, error: 'lookup_failed' }, { status: 500, headers: NO_STORE });
  }
}

// 셀프체크: 마스킹이 로컬파트를 흘리면 로드 시 throw.
if (
  maskEmail('designsir@seastargo.com') !== 'de***@seastargo.com' ||
  maskEmail('ab@x.com') !== 'a***@x.com' ||
  maskEmail('nope') !== ''
) {
  throw new Error('lookup.js maskEmail self-check failed');
}
