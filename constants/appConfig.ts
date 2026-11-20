// 애플리케이션 설정 상수
export const APP_CONFIG = {
  // 메일 관련 설정
  MAIL: {
    URL: 'https://m193.mailplug.com/member/login',
    AUTO_LOGIN_TIMEOUT: 5000,
    MAX_RETRY_COUNT: 3,
  },
  
  // 애플리케이션 루프 설정
  LOOP: {
    INTERVAL: 3000, // 3초
  },
  
  // 스토리지 키 상수
  STORAGE_KEYS: {
    CURRENT_USER_ID: 'current_user_id',
    LAST_SEEN_NOTICE_PREFIX: 'last_seen_notice_',
    LAST_SEEN_LEAVE_PREFIX: 'last_seen_leave_',
    LAST_SEEN_MESSAGE_PREFIX: 'last_seen_msg_',
    LAST_SEEN_APPROVAL_PREFIX: 'last_seen_approval_',
  },
  
  // 로깅 접두사
  LOG_PREFIX: {
    MAIL_VIEW: '[MailView]',
    APP: '[App]',
  },
  
  // 보안 관련 설정
  SECURITY: {
    MIN_PASSWORD_LENGTH: 4,
    MAX_INITIAL_PASSWORD_RETRY: 3,
  },
  
  // 오피스 위치 (출퇴근)
  OFFICE: {
    LOCATION: {
      lat: 37.5665,
      lng: 126.9780,
    },
    RADIUS_METERS: 500,
  },
  
  // 외부 링크
  EXTERNAL: {
    DMS_URL: 'https://sedms.app',
  },
} as const;

export type AppConfig = typeof APP_CONFIG;

// ─────────────────────────────────────────────────────────────
// 접속 환경 감지 (데스크탑 웹 / 모바일 웹 / 확장앱 임베드) — 3분류
// 기존에 흩어져 있던 isMobile(window.innerWidth<768) 판정을 이 유틸로 일원화한다.
// ─────────────────────────────────────────────────────────────
export type AppEnv = 'desktop' | 'mobile' | 'ext-embed';

// Tailwind 'md' 브레이크포인트와 동일(768px 미만 = 모바일 폭)
export const MOBILE_MAX_WIDTH = 768;

// 확장앱 사이드패널 iframe 내부인가?
//  ① src 쿼리에 ?embed=ext 가 붙어 있으면(확장이 명시적으로 붙임) 확정
//  ② iframe 내부(window.self !== window.top)이면서 좁은 폭이면 확장 임베드로 간주
function isExtEmbedContext(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('embed') === 'ext') return true;
  } catch { /* 쿼리 파싱 실패 무시 */ }
  try {
    if (window.self !== window.top && window.innerWidth < MOBILE_MAX_WIDTH) return true;
  } catch {
    // cross-origin 접근 예외 = iframe 내부. 좁으면 임베드로 간주.
    if (window.innerWidth < MOBILE_MAX_WIDTH) return true;
  }
  return false;
}

// 현재 접속 환경을 3분류로 반환.
export function detectAppEnv(): AppEnv {
  if (typeof window === 'undefined') return 'desktop';
  if (isExtEmbedContext()) return 'ext-embed';
  return window.innerWidth < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop';
}

// 모바일 레이아웃(하단네비 + MobileHome)을 강제해야 하는 환경인가?
// 데스크탑(넓은 폭·비임베드)만 사이드바 레이아웃, 그 외(모바일·확장임베드)는 모바일 레이아웃.
export function shouldUseMobileLayout(env: AppEnv = detectAppEnv()): boolean {
  return env !== 'desktop';
}

// 셀프체크(assert): 유틸 분기 불변식 — jsdom/노드에서 window 목으로 검증 가능.
// ponytail: 프레임워크 없이 순수 함수 규칙만 확인.
if (typeof window !== 'undefined' && (window as any).__SGW_ENV_SELFTEST__) {
  console.assert(shouldUseMobileLayout('mobile') === true, 'mobile → mobile layout');
  console.assert(shouldUseMobileLayout('ext-embed') === true, 'ext-embed → mobile layout');
  console.assert(shouldUseMobileLayout('desktop') === false, 'desktop → sidebar layout');
}
