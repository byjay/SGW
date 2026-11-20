/* google-idtoken.js — Google ID 토큰(RS256 JWT) 서버 검증. 의존성 0(Web Crypto만).
 *
 * 왜 필요한가: SGW의 "이름 기반 간편 로그인"에서 **이름은 계정 선택기일 뿐**이고,
 * 실제 신원 증명은 전적으로 이 파일의 검증 결과가 담당한다. 여기가 뚫리면 전부 뚫린다.
 *
 * 검증 항목(하나라도 실패 → 거부, fail-closed):
 *   1) 형식/alg  : header.alg === 'RS256' (alg:none·HS256 혼동공격 차단)
 *   2) 서명      : Google JWKS(https://www.googleapis.com/oauth2/v3/certs)의 kid 공개키로 RSA 검증
 *   3) iss       : accounts.google.com | https://accounts.google.com
 *   4) aud       : env.GOOGLE_CLIENT_ID 와 정확히 일치 (미설정이면 검증 자체를 거부)
 *   5) exp/iat   : 만료·미래발급(스큐 5분) 거부
 *   6) sub/email : sub 필수, email 필수 + email_verified 참
 *
 * 반환: { ok:true, payload } | { ok:false, error:'<코드>' }
 * (에러 코드는 호출측이 사용자에게 그대로 노출하지 말 것 — 계정 열거 힌트가 될 수 있다)
 */

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const VALID_ISS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CLOCK_SKEW_SEC = 300;

// ponytail: 모듈 스코프 1시간 캐시. isolate 재활용 시에만 유효한 best-effort 캐시라
//           만료/kid 미스 시 강제 리프레시 1회로 보완한다(키 로테이션 대응).
let jwksCache = { keys: null, expMs: 0 };

const b64urlToBytes = (s) => {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const bin = atob((s + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const b64urlToJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function fetchKeys(force) {
  const now = Date.now();
  if (!force && jwksCache.keys && jwksCache.expMs > now) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res || !res.ok) throw new Error('jwks_fetch_failed');
  const data = await res.json();
  const keys = Array.isArray(data && data.keys) ? data.keys : [];
  jwksCache = { keys, expMs: now + 3600_000 };
  return keys;
}

async function findKey(kid) {
  let keys = await fetchKeys(false);
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    // 키 로테이션 직후 캐시 미스 → 1회만 강제 리프레시.
    keys = await fetchKeys(true);
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) return null;
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

/** @returns {Promise<{ok:true,payload:object}|{ok:false,error:string}>} */
export async function verifyGoogleIdToken(idToken, env) {
  try {
    // aud 를 대조할 client_id 가 없으면 "어느 앱의 토큰이든" 통과시키게 된다 → 검증 거부.
    const clientId = env && env.GOOGLE_CLIENT_ID;
    if (!clientId) return { ok: false, error: 'server_misconfigured' };
    if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 8192) {
      return { ok: false, error: 'bad_token' };
    }

    const parts = idToken.split('.');
    if (parts.length !== 3) return { ok: false, error: 'bad_token' };
    const [h, b, s] = parts;

    let header, payload;
    try {
      header = b64urlToJson(h);
      payload = b64urlToJson(b);
    } catch { return { ok: false, error: 'bad_token' }; }

    if (!header || header.alg !== 'RS256' || !header.kid) return { ok: false, error: 'bad_alg' };

    const key = await findKey(header.kid);
    if (!key) return { ok: false, error: 'unknown_key' };

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(s),
      new TextEncoder().encode(`${h}.${b}`)
    );
    if (!valid) return { ok: false, error: 'bad_signature' };

    if (!VALID_ISS.has(String(payload.iss))) return { ok: false, error: 'bad_iss' };
    if (String(payload.aud) !== String(clientId)) return { ok: false, error: 'bad_aud' };

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || Number(payload.exp) + CLOCK_SKEW_SEC < now) return { ok: false, error: 'expired' };
    if (payload.iat && Number(payload.iat) - CLOCK_SKEW_SEC > now) return { ok: false, error: 'bad_iat' };

    if (!payload.sub) return { ok: false, error: 'no_sub' };
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email) return { ok: false, error: 'no_email' };
    // 구글이 소유를 확인하지 않은 이메일은 신원으로 쓰지 않는다.
    if (payload.email_verified !== true && String(payload.email_verified) !== 'true') {
      return { ok: false, error: 'email_unverified' };
    }

    return { ok: true, payload: { ...payload, email } };
  } catch {
    return { ok: false, error: 'verify_failed' };
  }
}

/** 회사 도메인 강제. env.ALLOWED_EMAIL_DOMAIN (구 GOOGLE_ALLOWED_DOMAIN) 우선, 기본 seastargo.com.
 *  회사가 발급·통제하는 Workspace 계정만 신뢰한다 = 자동 등재(JIT)의 유일한 신뢰 근거. */
export function isAllowedDomain(email, env) {
  const allowed = String(
    (env && (env.ALLOWED_EMAIL_DOMAIN || env.GOOGLE_ALLOWED_DOMAIN)) || 'seastargo.com'
  ).toLowerCase();
  const at = String(email || '').toLowerCase().lastIndexOf('@');
  if (at < 0) return false;
  return String(email).toLowerCase().slice(at + 1) === allowed;
}

// 셀프체크(프레임워크 0): 도메인 가드 불변식이 깨지면 로드 시 throw.
if (
  isAllowedDomain('a@seastargo.com', {}) !== true ||
  isAllowedDomain('a@evil.com', {}) !== false ||
  isAllowedDomain('a@seastargo.com.evil.com', {}) !== false ||
  isAllowedDomain('noat', {}) !== false
) {
  throw new Error('google-idtoken.js self-check failed');
}
