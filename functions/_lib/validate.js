// 공용 입력 검증 — 쓰기 API 길이/형식 상한 (XSS·남용 방어).
// ponytail: 콘텐츠는 그대로 저장(Flutter canvas라 DOM XSS 낮음)하되 길이/형식으로 방어.
//           과도한 sanitize로 정상 텍스트를 깨지 않는다.

export const LIMITS = {
  content: 10000, // content / message 본문
  title: 300,
  name: 100,
  reason: 10000,
  email: 200,
  location: 300,
  fileB64: 7 * 1024 * 1024, // base64 ~7MB ≈ 원본 5MB 파일
};

export const VALID_ROLES = new Set(['admin', 'manager', 'user']);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 문자열 길이 상한 초과 여부(문자열이 아닌 값은 통과).
export function over(v, max) {
  return typeof v === 'string' && v.length > max;
}

// [값, 최대] 쌍 중 하나라도 초과면 true.
export function anyOver(pairs) {
  return pairs.some(([v, max]) => over(v, max));
}

export function isValidEmail(v) {
  return typeof v === 'string' && v.length <= LIMITS.email && EMAIL_RE.test(v);
}

export function isValidRole(v) {
  return VALID_ROLES.has(String(v));
}

// 셀프체크(프레임워크 없이): 핵심 불변식이 깨지면 로드 시 throw.
// (Cloudflare Workers 런타임에서 import 시 1회 실행)
if (
  over('a'.repeat(LIMITS.content + 1), LIMITS.content) !== true ||
  over('short', LIMITS.content) !== false ||
  isValidEmail('x@y.z') !== true ||
  isValidEmail('nope') !== false ||
  isValidRole('user') !== true ||
  isValidRole('root') !== false
) {
  throw new Error('validate.js self-check failed');
}
