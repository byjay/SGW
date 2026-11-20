// CF Pages 전역 미들웨어 — 오직 /api/* 만 인증 게이트. 정적자산·SPA·/auth/google/* 는 통과.
// 화이트리스트(무인증): /api/auth/login. 그 외 /api/* 는 토큰(쿠키 at / auth_sess / Bearer) 필수.
// ★ 경로 가드: path가 /api/ 로 시작하지 않으면 즉시 next() → index.html·main.dart.js 절대 안 막힘.
import { readAuth } from './_lib/rbac.js';
import { isActiveAccount } from './_lib/session.js';

// /api/nas/download 은 자체 HMAC 서명토큰(t)으로 검증하므로 Bearer 없이 통과(스트림 다운로드용).
// /api/auth/lookup       : 이름→후보계정 조회. 세션을 발급하지 않는다(계정 선택기일 뿐).
// /api/auth/google/login : 구글 ID 토큰 자체가 신원 증명이므로 기존 세션이 필요 없다.
//   ※ /api/auth/google/link 는 화이트리스트가 아니다 — 연결은 반드시 로그인 상태에서만.
const PUBLIC_API = new Set([
  '/api/auth/login',
  '/api/auth/lookup',
  '/api/auth/google/login',
  '/api/health',
  '/api/nas/download',
]);

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const path = new URL(request.url).pathname;

  // 정적 자산·SPA·기타 비-API 경로는 전부 통과(앱 로딩 보장).
  if (!path.startsWith('/api/')) return next();

  // CORS preflight는 통과(확장 등 크로스오리진).
  if (request.method === 'OPTIONS') return next();

  // 무인증 허용 라우트.
  if (PUBLIC_API.has(path)) return next();

  // 그 외 /api/* 는 인증 필수.
  const user = await readAuth(request, env).catch(() => null);
  // sub(신원) 없는 토큰은 거부한다. 핸들러들이 uid = user.sub 로 소유권을 스코프하는데,
  // sub 가 비면 uid='' 가 되어 소유자 컬럼이 빈 레거시 행과 매칭될 수 있다(권한 우회).
  if (!user || !user.sub) {
    return new Response(JSON.stringify({ error: 'auth_required' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  // ★ 계정 상태 재확인(토큰 발급 이후의 승인 취소·정지·거절을 즉시 반영).
  //   토큰 안의 클레임만 믿으면 pending/rejected 로 바뀐 계정이 만료 전까지 계속 통과한다.
  //   sgw_users 에 행이 있는 계정에만 적용(소셜 sub 'google:xxx' 등 다른 신원 체계는 기존대로).
  const st = await accountStatus(env, user.sub);
  if (st && !isActiveAccount({ status: st })) {
    return new Response(JSON.stringify({ error: st === 'pending' ? 'approval_pending' : 'account_disabled' }), {
      status: 403,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  ctx.data.user = user;
  return next();
}

// sgw_users.status 조회(행 없으면 null → 기존 동작 유지).
async function accountStatus(env, sub) {
  if (!env || !env.DB) return null;
  try {
    const r = await env.DB.prepare('SELECT status FROM sgw_users WHERE id = ?').bind(String(sub)).first();
    if (!r) return null;
    return String(r.status || '').toLowerCase() || 'unknown';
  } catch {
    return null; // DB 장애로 전 API를 막지는 않는다(인증 자체는 이미 통과한 상태).
  }
}
