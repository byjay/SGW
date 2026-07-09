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
