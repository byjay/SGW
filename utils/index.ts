import { APP_CONFIG } from '../constants/appConfig';

/**
 * 로컬 스토리지 관리 유틸리티
 */
export const storageUtils = {
  get: <T>(key: string): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`[StorageUtils] Error getting ${key}:`, error);
      return null;
    }
  },

  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`[StorageUtils] Error setting ${key}:`, error);
    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[StorageUtils] Error removing ${key}:`, error);
    }
  },

  getTimestamp: (key: string): number => {
    return parseInt(localStorage.getItem(key) || '0', 10);
  },

  setTimestamp: (key: string, timestamp: number): void => {
    localStorage.setItem(key, timestamp.toString());
  },
};

/**
 * 날짜 관련 유틸리티
 */
export const dateUtils = {
  formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions): string => {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleDateString('ko-KR', options);
  },

  formatDateTime: (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('ko-KR');
  },

  formatTime: (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  },

  formatRelativeTime: (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;

    if (diff < minute) return '방금';
    if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
    if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
    return `${Math.floor(diff / day)}일 전`;
  },

  isToday: (timestamp: number): boolean => {
    const now = new Date();
    const date = new Date(timestamp);
    return now.toDateString() === date.toDateString();
  },
};

/**
 * 문자열 관련 유틸리티
 */
export const stringUtils = {
  truncate: (str: string, maxLength: number): string => {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
  },

  isEmpty: (str: string | null | undefined): boolean => {
    return !str || str.trim().length === 0;
  },

  capitalize: (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
};

/**
 * 유효성 검사 유틸리티
 */
export const validationUtils = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  password: (password: string): { isValid: boolean; error?: string } => {
    if (stringUtils.isEmpty(password)) {
      return { isValid: false, error: '비밀번호를 입력해주세요.' };
    }
    if (password.length < APP_CONFIG.SECURITY.MIN_PASSWORD_LENGTH) {
      return {
        isValid: false,
        error: `비밀번호는 ${APP_CONFIG.SECURITY.MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
      };
    }
    return { isValid: true };
  },

  required: (value: any, fieldName: string): { isValid: boolean; error?: string } => {
    if (value === null || value === undefined || (typeof value === 'string' && stringUtils.isEmpty(value))) {
      return { isValid: false, error: `${fieldName}을(를) 입력해주세요.` };
    }
    return { isValid: true };
  },
};

/**
 * 디바이스 정보 유틸리티
 */
export const deviceUtils = {
  isMobile: (): boolean => {
    return window.innerWidth < 768;
  },

  isTablet: (): boolean => {
    return window.innerWidth >= 768 && window.innerWidth < 1024;
  },

  isDesktop: (): boolean => {
    return window.innerWidth >= 1024;
  },

  getDeviceInfo: () => {
    return {
      isMobile: deviceUtils.isMobile(),
      isTablet: deviceUtils.isTablet(),
      isDesktop: deviceUtils.isDesktop(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    };
  },
};

/**
 * 에러 처리 유틸리티
 */
export const errorUtils = {
  log: (context: string, error: any, additionalInfo?: Record<string, any>): void => {
    console.error(`[${context}] Error:`, error, additionalInfo ? '\nAdditional Info:' : '', additionalInfo);
  },

  handleError: (error: unknown, context: string): string => {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    errorUtils.log(context, error);
    return errorMessage;
  },

  getUserFriendlyMessage: (error: any, defaultMessage: string = '오류가 발생했습니다.'): string => {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    return defaultMessage;
  },
};

/**
 * 디바운스 유틸리티
 */
export const debounceUtils = {
  create: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void => {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },
};

/**
 * 쓰로틀 유틸리티
 */
export const throttleUtils = {
  create: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void => {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
};
