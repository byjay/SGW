/* Seastar GW — chrome.storage.local Promise 래퍼 */
export const storage = {
  get: (k) => new Promise((r) => chrome.storage.local.get([k], (v) => r(v[k]))),
  getMany: (keys) => new Promise((r) => chrome.storage.local.get(keys, r)),
  set: (k, v) => new Promise((r) => { const o = {}; o[k] = v; chrome.storage.local.set(o, r); }),
  remove: (k) => new Promise((r) => chrome.storage.local.remove(k, r)),
  clear: () => new Promise((r) => chrome.storage.local.clear(r))
};

export const KEYS = {
  EMP_NUM: 'swgs_emp_num',
  EMP_NAME: 'swgs_emp_name',
  USER_EMAIL: 'swgs_user_email',
  AUTH_TOKEN: 'swgs_auth_token',
  AUTH_AT: 'swgs_auth_at',
  LAST_NOTICE: 'swgs_last_notice',
  LAST_LEAVE: 'swgs_last_leave',
  LAST_MESSAGE: 'swgs_last_message',
  LAST_APPROVAL: 'swgs_last_approval',
  POLL_INTERVAL_MIN: 'swgs_poll_interval_min',
  NOTIFICATIONS_ENABLED: 'swgs_notifications_enabled',
  GW_HOST: 'swgs_gw_host',
  SEDMS_HOST: 'swgs_sedms_host',
  // ── 그룹웨어 localStorage 스냅샷 (연차/결재 실데이터) ──
  SNAP_AT: 'swgs_snap_at',
  SNAP_UID: 'swgs_snap_uid',
  SNAP_ME: 'swgs_snap_me',
  SNAP_LEAVE: 'swgs_snap_leave',
  SNAP_APPROVALS: 'swgs_snap_approvals'
};

export const DEFAULTS = {
  poll_interval_min: 1,         // 1분마다 활동 폴링
  notifications_enabled: true,
  gw_host: 'https://sgw.seastar.work',                  // 정식 도메인 (메인 그룹웨어 URL)
  admin_host: 'https://sgw-admin.pages.dev',            // 직원 관리 시스템 (사원 로그인 API 호출용)
  sedms_host: 'https://sedms.app'                 // ★ SEDMS 실제 URL (그룹웨어 appConfig.EXTERNAL.DMS_URL 기준)
};
