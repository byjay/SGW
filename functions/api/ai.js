// SGW AI 프록시 — OpenAI 호환 chat/completions 중계 (다중 키 로테이션 + 폴백).
// 키는 Cloudflare Pages 시크릿에만 존재. Flutter/브라우저 클라이언트에는 절대 안 들어감.
//
// POST /api/ai
//   body: OpenAI 호환 { messages:[...], model?, temperature?, ... }
//   -> 업스트림 ${AI_BASE_URL}/chat/completions 에 Authorization: Bearer <키> 로 중계.
//   -> 응답 JSON 그대로 반환.
//
// env (키는 아래 중 아무거나 — 여러 개 있으면 전부 합쳐 로테이션):
//   AI_API_KEYS         (선택) — 콤마/공백/줄바꿈 구분 다중 키
//   AI_API_KEY_1/2/3... (선택) — 번호별 개별 키 (1~9 스캔)
//   AI_API_KEY          (선택) — 기존 단일 키 (하위호환)
//   하나도 없으면 503 {error:'AI 미설정'} (크래시 금지, 자연스러운 비활성)
//   AI_BASE_URL (선택)  — 기본 https://api.cerebras.ai/v1
//   AI_MODEL    (선택)  — 기본 zai-glm-4.7 (body.model 미지정 시 적용)
//
// 로테이션: 요청마다 시작 키를 순환(라운드로빈). 401/403/429/5xx 또는 연결실패면
//           다음 키로 재시도 (최대 키 개수만큼). 한 키가 한도 초과돼도 서비스 지속.
// 보안: 키는 응답/로그에 절대 노출 안 함. 업스트림 오류는 상태코드+본문만 전달.

import { checkRateLimit } from '../_lib/rate-limit.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const DEFAULT_BASE_URL = 'https://api.cerebras.ai/v1';
const DEFAULT_MODEL = 'zai-glm-4.7';

// ponytail: 워커 인스턴스별 인메모리 카운터. 전역 균등 분배는 아니지만
// 인스턴스 내 라운드로빈 + 실패 폴백만으로 키 소진 회피에는 충분.
// 업그레이드 경로: 정확한 전역 분배가 필요하면 KV/DO 카운터로 교체.
let rrCursor = 0;

/** env에서 사용 가능한 키 목록 수집 (중복 제거, 순서 유지). */
export function collectKeys(env) {
  const out = [];
  const push = (v) => {
    if (typeof v !== 'string') return;
    for (const k of v.split(/[\s,]+/)) {
      const t = k.trim();
      if (t && !out.includes(t)) out.push(t);
    }
  };
  if (!env) return out;
  push(env.AI_API_KEYS);
  for (let i = 1; i <= 9; i++) push(env[`AI_API_KEY_${i}`]);
  push(env.AI_API_KEY);
  return out;
}

/** 다음 키로 폴백해야 하는 상태코드인가 (인증/한도/업스트림 장애). */
const shouldFallover = (status) =>
  status === 401 || status === 403 || status === 429 || status >= 500;

/**
 * 키를 라운드로빈으로 돌며 업스트림 호출. 폴백 대상 실패면 다음 키로 재시도.
 * 성공(또는 폴백 대상 아닌 오류: 400 등)이면 그 응답을 즉시 반환.
 * 전부 실패하면 마지막 응답(없으면 null) 반환.
 */
export async function callWithRotation(keys, url, payload, fetchImpl = fetch) {
  const start = rrCursor++ % keys.length;
  let last = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[(start + i) % keys.length];
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: payload,
      });
    } catch {
      continue; // 연결 실패 → 다음 키
    }
    if (!shouldFallover(res.status)) return res;
    last = res;
  }
  return last;
}

// 남용방지 상한 (ponytail: 단순 크기 가드. 정교한 rate-limit는 필요 시 업그레이드)
const MAX_BODY_BYTES = 128 * 1024; // 128KB
const MAX_MESSAGES = 100;
const MAX_CONTENT_CHARS = 60000; // 전체 messages content 합계 상한

export async function onRequestPost({ request, env, data }) {
  try {
    // 남용 방지: 사용자(sub)당 분당 호출 상한. 유출된 세션 하나로 상위 AI 크레딧을
    // 통째로 소진시키는 것을 막는다. (RATE_KV 미바인딩 시 no-op — 기존 동작 불변)
    const who = (data && data.user && data.user.sub) ||
      request.headers.get('cf-connecting-ip') || 'unknown';
    const rl = await checkRateLimit(env, `ai:${who}`, { limit: 30, windowSec: 60 })
      .catch(() => ({ ok: true }));
    if (!rl.ok) {
      return json({ error: '요청이 너무 잦습니다. 잠시 후 다시 시도하세요.' }, 429);
    }

    // 키 미설정 → 503 (마스터가 CF 시크릿 넣기 전까지 자연스러운 비활성)
    const keys = collectKeys(env);
    if (keys.length === 0) {
      return json(
        { error: 'AI 미설정', hint: 'CF Pages 시크릿 AI_API_KEYS 설정 필요' },
        503
      );
    }

    const raw = await request.text();
    if (raw && raw.length > MAX_BODY_BYTES) {
      return json({ error: '요청이 너무 큽니다' }, 413);
    }

    let body;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json({ error: '잘못된 JSON' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: '잘못된 요청 본문' }, 400);
    }

    // messages 검증 (남용방지)
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length > MAX_MESSAGES) {
      return json({ error: '메시지가 너무 많습니다' }, 400);
    }
    let totalChars = 0;
    for (const m of messages) {
      if (m && typeof m.content === 'string') totalChars += m.content.length;
    }
    if (totalChars > MAX_CONTENT_CHARS) {
      return json({ error: '입력이 너무 깁니다' }, 400);
    }

    const baseUrl = (env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const model = body.model || env.AI_MODEL || DEFAULT_MODEL;

    const payload = JSON.stringify({ ...body, model });

    // 키 로테이션 + 실패 폴백 (키는 노출하지 않음)
    const upstream = await callWithRotation(
      keys,
      `${baseUrl}/chat/completions`,
      payload
    );
    if (!upstream) {
      return json({ error: 'AI 업스트림 연결 실패' }, 502);
    }

    // 응답 JSON 그대로 반환 (상태코드 유지)
    const text = await upstream.text();
    const contentType =
      upstream.headers.get('Content-Type') || 'application/json';
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return json({ error: 'AI 프록시 오류' }, 500);
  }
}
