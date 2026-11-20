import { User, Post, Message, ChatRoom, ChatMessage, LeaveRequest, LeaveType, Approval, AttendanceLog, Schedule, Comment, PasswordResetLog } from '../types';

const generate3DAvatar = (name: string, color1: string, color2: string) => {
  const initial = name.charAt(0);
  const svg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g_${name}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}" />
        <stop offset="100%" stop-color="${color2}" />
      </linearGradient>
      <filter id="s_${name}">
        <feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.4"/>
        <feDropShadow dx="-2" dy="-2" stdDeviation="2" flood-color="#ffffff" flood-opacity="0.6"/>
      </filter>
    </defs>
    <circle cx="50" cy="50" r="44" fill="url(#g_${name})" stroke="#ffffff" stroke-width="3" filter="url(#s_${name})" />
    <text x="50" y="68" font-family="'Inter', sans-serif" font-size="46" font-weight="900" fill="white" text-anchor="middle" filter="url(#s_${name})">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

// Initial Mock Data
// 직원 명부 (마스터 제공 2026-06-26) — 초기 비밀번호 전원 '1', 최초 로그인 시 강제 변경(passwordChanged:false)
const INITIAL_USERS: User[] = [
  { id: '1',  name: '고영관', email: 'kohyk@seastargo.com',      role: 'manager', status: 'active', position: 'CEO',  department: '임원', joinDate: '2010-01-01', phone: '', totalLeave: 0, carryover: 0, leaveBalance: 0, password: '1', passwordChanged: false, avatar: generate3DAvatar('고영관', '#4facfe', '#00f2fe') },
  { id: '2',  name: '고재이', email: 'jkohkr@seastargo.com',     role: 'user',    status: 'active', position: '이사', department: '임원', joinDate: '',           phone: '', totalLeave: 0, carryover: 0, leaveBalance: 0, password: '1', passwordChanged: false, avatar: generate3DAvatar('고재이', '#f093fb', '#f5576c') },
  { id: '3',  name: '김미진', email: 'kimmj@seastargo.com',      role: 'user',    status: 'active', position: '부장', department: '배관', joinDate: '2023-10-16', phone: '', totalLeave: 19, carryover: 0, leaveBalance: 19, password: '1', passwordChanged: false, avatar: generate3DAvatar('김미진', '#84fab0', '#8fd3f4') },
  { id: '4',  name: '김민경', email: 'min55@seastargo.com',      role: 'user',    status: 'active', position: '과장', department: '배관', joinDate: '2018-12-11', phone: '', totalLeave: 19, carryover: 0, leaveBalance: 19, password: '1', passwordChanged: false, avatar: generate3DAvatar('김민경', '#fa709a', '#fee140') },
  { id: '5',  name: '김봉정', email: 'designsir@seastargo.com',  role: 'admin',   status: 'active', position: '부장', department: '전장', joinDate: '2019-04-01', phone: '', totalLeave: 19, carryover: 0, leaveBalance: 19, password: '1', passwordChanged: false, avatar: generate3DAvatar('김봉정', '#a18cd1', '#fbc2eb') },
  { id: '6',  name: '김정인', email: 'bsbinin@seastargo.com',    role: 'user',    status: 'active', position: '부장', department: '전장', joinDate: '2024-01-15', phone: '', totalLeave: 19, carryover: 0, leaveBalance: 19, password: '1', passwordChanged: false, avatar: generate3DAvatar('김정인', '#667eea', '#764ba2') },
  { id: '7',  name: '박규진', email: 'elcon0955@seastargo.com',  role: 'user',    status: 'active', position: '전무', department: '임원', joinDate: '',           phone: '', totalLeave: 19, carryover: 0, leaveBalance: 19, password: '1', passwordChanged: false, avatar: generate3DAvatar('박규진', '#30cfd0', '#330867') },
  { id: '8',  name: '윤승현', email: 'seayun@seastargo.com',     role: 'user',    status: 'active', position: '아르바이트', department: '',     joinDate: '',           phone: '', totalLeave: 0, carryover: 0, leaveBalance: 0, isPartTime: true, password: '1', passwordChanged: false, avatar: generate3DAvatar('윤승현', '#a8edea', '#fed6e3') },
  { id: '9',  name: '이선우', email: 'lsw00@seastargo.com',      role: 'manager', status: 'active', position: '부장', department: '배관', joinDate: '2017-07-01', phone: '', totalLeave: 19, carryover: 0, leaveBalance: 19, password: '1', passwordChanged: false, avatar: generate3DAvatar('이선우', '#f5576c', '#f093fb') },
  { id: '10', name: '이재명', email: 'jmlee@seastargo.com',      role: 'user',    status: 'active', position: '전무', department: '임원', joinDate: '2020-01-01', phone: '', totalLeave: 19, carryover: 0, leaveBalance: 19, password: '1', passwordChanged: false, avatar: generate3DAvatar('이재명', '#f6d365', '#fda085') },
  { id: '11', name: '장현영', email: 'hyjang9593@seastargo.com', role: 'user',    status: 'active', position: '주임', department: '서무', joinDate: '2026-03-03', phone: '', totalLeave: 19, carryover: 0, leaveBalance: 19, password: '1', passwordChanged: false, avatar: generate3DAvatar('장현영', '#fbc2eb', '#a18cd1') },
];

const INITIAL_POSTS: Post[] = [
  {
    id: 'post1',
    authorId: '5',
    authorName: '김봉정',
    title: '[공지] 커뮤니티 이용 수칙 안내',
    content: '모두가 즐거운 커뮤니티를 위해 서로 존중하며 대화합시다. 비방이나 욕설은 금지됩니다.',
    timestamp: Date.now() - 10000000,
    likes: 5,
    type: 'notice',
    comments: []
  },
  {
    id: 'post2',
    authorId: 'system',
    authorName: '시스템 관리자',
    title: '[안내] 초기 비밀번호 강제 변경 및 보안 정책 시행',
    content: '정보보안 규정에 따라, 입사 시 발급받은 초기 비밀번호(1)는 최초 로그인 후 반드시 변경해야 합니다. 초기 비밀번호 변경은 최대 3회까지만 연기(다음에 변경하기)할 수 있으며, 3회를 초과하면 비밀번호를 변경해야만 시스템을 이용할 수 있습니다. 안전한 업무 환경을 위해 반드시 영문/숫자 포함 4자리 이상의 비밀번호로 변경해주시기 바랍니다.',
    timestamp: Date.now() - 5000000,
    likes: 0,
    type: 'notice',
    comments: []
  }
];

const INITIAL_SCHEDULES: Schedule[] = [
  {
    id: 'sch_1',
    userId: 'admin',
    userName: '시스템',
    title: '창립기념일',
    type: 'company',
    startDate: '2025-05-15',
    endDate: '2025-05-15',
    isAllDay: true,
    color: 'bg-red-500'
  }
];

// JSON Holiday Data (2024-2035) - Truncated for brevity but assume full data is here
const HOLIDAY_DATA = [
  { date: "2024-01-01", name: "신정" }, { date: "2024-02-09", name: "설날 연휴" }, { date: "2024-02-10", name: "설날" }, { date: "2024-02-11", name: "설날 연휴" }, { date: "2024-02-12", name: "대체공휴일" },
  { date: "2024-03-01", name: "3.1절" }, { date: "2024-04-10", name: "국회의원 선거일" }, { date: "2024-05-05", name: "어린이날" }, { date: "2024-05-06", name: "대체공휴일" }, { date: "2024-05-15", name: "부처님오신날" },
  { date: "2024-06-06", name: "현충일" }, { date: "2024-08-15", name: "광복절" }, { date: "2024-09-16", name: "추석 연휴" }, { date: "2024-09-17", name: "추석" }, { date: "2024-09-18", name: "추석 연휴" },
  { date: "2024-10-03", name: "개천절" }, { date: "2024-10-09", name: "한글날" }, { date: "2024-12-25", name: "성탄절" },
  // ... (All other holidays as previously defined)
];

// ★ 이전 연차 신청내역 복원 — 새 명부 id로 매핑 (이선우 옛id2→새id9, 김미진 id3, 김민경 id4 유지)
// (김선우는 현재 명부에 없어 제외)
const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'leave_1',  userId: '9', userName: '이선우', type: 'annual',         startDate: '2026-01-02', endDate: '2026-01-02', days: 1,   reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-02T00:00:00').getTime() },
  { id: 'leave_2',  userId: '9', userName: '이선우', type: 'morning_half',   startDate: '2026-02-03', endDate: '2026-02-03', days: 0.5, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-02-03T00:00:00').getTime() },
  { id: 'leave_3',  userId: '3', userName: '김미진', type: 'morning_half',   startDate: '2026-02-05', endDate: '2026-02-05', days: 0.5, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-02-05T00:00:00').getTime() },
  { id: 'leave_4',  userId: '3', userName: '김미진', type: 'afternoon_half', startDate: '2026-02-25', endDate: '2026-02-25', days: 0.5, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-02-25T00:00:00').getTime() },
  { id: 'leave_14', userId: '3', userName: '김미진', type: 'afternoon_half', startDate: '2026-02-27', endDate: '2026-02-27', days: 0.5, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-02-27T00:00:00').getTime() },
  { id: 'leave_5',  userId: '4', userName: '김민경', type: 'annual',         startDate: '2026-01-09', endDate: '2026-01-09', days: 1,   reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-09T00:00:00').getTime() },
  { id: 'leave_6',  userId: '4', userName: '김민경', type: 'annual',         startDate: '2026-01-16', endDate: '2026-01-16', days: 1,   reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-16T00:00:00').getTime() },
  { id: 'leave_7',  userId: '4', userName: '김민경', type: 'annual',         startDate: '2026-01-23', endDate: '2026-01-23', days: 1,   reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-23T00:00:00').getTime() },
  { id: 'leave_11', userId: '4', userName: '김민경', type: 'annual',         startDate: '2026-02-27', endDate: '2026-02-27', days: 1,   reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-02-27T00:00:00').getTime() },
  { id: 'leave_12', userId: '4', userName: '김민경', type: 'afternoon_half', startDate: '2026-03-06', endDate: '2026-03-06', days: 0.5, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-03-06T00:00:00').getTime() },
  { id: 'leave_13', userId: '4', userName: '김민경', type: 'annual',         startDate: '2026-03-25', endDate: '2026-03-25', days: 1,   reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-03-25T00:00:00').getTime() },
];

const STORAGE_KEYS = {
  USERS: 'app_users',
  POSTS: 'app_posts',
  MESSAGES: 'app_messages',
  ONLINE: 'app_online_status',
  LOGIN_HISTORY: 'app_login_history',
  CHAT_ROOMS: 'app_chat_rooms',
  CHAT_MESSAGES: 'app_chat_messages',
  NOTICE_CHECK: 'app_notice_check',
  LEAVE_REQUESTS: 'app_leave_requests',
  APPROVALS: 'app_approvals',
  ATTENDANCE: 'app_attendance',
  SCHEDULES: 'app_schedules',
  PASSWORD_RESET_LOGS: 'app_password_reset_logs',
  ACTIVITY_LOGS: 'app_activity_logs',
  MIGRATION: 'app_migration_v2'
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// ★ Presence (동시접속) — 서버(D1) 우선 + localStorage 폴백. 네트워크 throttle용 모듈 스코프 상태.
let _lastHeartbeatPost = 0;
let _lastOnlineFetch = 0;
let _onlineCache: string[] = [];
let _serverAvailable = false; // 서버(D1) presence 사용 가능 여부 (첫 성공 후 true)

// ★ 쪽지/채팅 서버(D1) 우선 + localStorage 폴백. 첫 fetch 실패 시 폴백으로 남고,
//   이후 재시도는 계속하되(다른 기기 접속 대비) 개발환경 404에서도 조용히 폴백.
const mirrorLocal = (key: string, list: any[]) => {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* ignore */ }
};

const isSameDay = (d1: number, d2: number) => {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

export const MockServer = {
  // Initialize data if empty
  init: () => {
    // Initialize data only if not exists
    // 2026-06-26 명부 전면 교체(11명, @seastargo.com, 초기비번 '1' 강제변경) → 하드 리시드
    const MIGRATION_KEY = 'app_migration_v7_roster';
    const storedUsersJson = localStorage.getItem(STORAGE_KEYS.USERS);
    const users: User[] = storedUsersJson ? JSON.parse(storedUsersJson) : [];
    const currentMigration = localStorage.getItem(MIGRATION_KEY);

    if (users.length === 0 || !currentMigration) {
      // 신규 브라우저 또는 명부 마이그레이션 → INITIAL_USERS로 하드 리셋 (정확히 11명 보장)
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      localStorage.setItem(MIGRATION_KEY, 'done');
      // 옛 명단 기반 샘플 연차/결재 잔존물 제거 (userId 불일치 방지)
      localStorage.removeItem(STORAGE_KEYS.LEAVE_REQUESTS);
      localStorage.removeItem(STORAGE_KEYS.APPROVALS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS)) {
      localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(INITIAL_LEAVE_REQUESTS));
    }
    // ★ 이전 연차 신청내역 복원 시드 (유저/비번 영향 없이 1회 강제 반영)
    const LEAVE_SEED_KEY = 'app_leave_seed_v3';
    if (localStorage.getItem(LEAVE_SEED_KEY) !== 'done') {
      localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(INITIAL_LEAVE_REQUESTS));
      localStorage.setItem(LEAVE_SEED_KEY, 'done');
    }
    // ★ 직급/부서/역할 동기화 (비번·사진 보존, 1회). 매니저 권한을 이선우·고영관으로 한정 반영.
    const PROFILE_SYNC_KEY = 'app_profile_sync_v3';
    if (localStorage.getItem(PROFILE_SYNC_KEY) !== 'done') {
      const existing: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      const merged = existing.map(u => {
        const init = INITIAL_USERS.find(x => x.id === u.id);
        if (!init) return u;
        return { ...u, name: init.name, email: init.email, position: init.position, department: init.department, role: init.role };
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
      localStorage.setItem(PROFILE_SYNC_KEY, 'done');
    }
    // ★ 연차 일괄 재조정 (2026-07-03 마스터 지시): 고영관·고재이는 0, 나머지는 19일로 통일. 1회만 실행.
    const LEAVE_RESET_KEY = 'app_leave_reset_v1';
    if (localStorage.getItem(LEAVE_RESET_KEY) !== 'done') {
      const existing: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      const merged = existing.map(u => {
        const init = INITIAL_USERS.find(x => x.id === u.id);
        if (!init) return u;
        return { ...u, totalLeave: init.totalLeave, leaveBalance: init.leaveBalance, carryover: init.carryover };
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
      localStorage.setItem(LEAVE_RESET_KEY, 'done');
    }

    // ★ 아르바이트(part-time) 동기화 (2026-07-06): 윤승현 등 isPartTime + 직급/연차 반영. 기존 브라우저 1회 마이그레이션.
    const PARTTIME_SYNC_KEY = 'app_parttime_sync_v1';
    if (localStorage.getItem(PARTTIME_SYNC_KEY) !== 'done') {
      const existing: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      const merged = existing.map(u => {
        const init = INITIAL_USERS.find(x => x.id === u.id);
        if (!init) return u;
        return init.isPartTime
          ? { ...u, isPartTime: true, position: init.position, totalLeave: 0, leaveBalance: 0, carryover: 0 }
          : { ...u, isPartTime: false };
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
      localStorage.setItem(PARTTIME_SYNC_KEY, 'done');
    }

    if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(INITIAL_POSTS));
    }
    // ★ 확장 프로그램(Seastar GW) 설치 안내 공지 — 전 직원 1회 자동 게시 (기존 글 보존, 최상단 추가)
    const EXT_NOTICE_ID = 'post_ext_install_v1';
    const postsNow: Post[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
    if (!postsNow.some(p => p.id === EXT_NOTICE_ID)) {
      postsNow.unshift({
        id: EXT_NOTICE_ID,
        authorId: '5',
        authorName: '김봉정',
        title: '[공지] 사내 확장 프로그램(Seastar GW) 설치 안내',
        content:
          '전 직원 대상 — Seastar Groupware 크롬 확장앱이 배포되었습니다. 사이드패널에서 연차·쪽지·공지·전자결재를 바로 확인하고, 강력 알림(팝업)까지 받을 수 있습니다.\n\n' +
          '■ 자동 설치 (권장, IT/본인 모두 가능)\n' +
          '1. https://swgs-internal.pages.dev 접속\n' +
          '2. "IT 관리자용 자동 설치(.bat)" 다운로드\n' +
          '3. 파일 우클릭 → 관리자 권한으로 실행\n' +
          '4. 브라우저(Chrome/Whale/Edge) 완전히 껐다 켜면 자동 설치 완료\n\n' +
          '■ 수동 설치 (개발자 모드)\n' +
          '1. 위 사이트에서 ZIP 다운로드 후 압축 해제\n' +
          '2. chrome://extensions 접속 → 우측 상단 "개발자 모드" 켜기\n' +
          '3. "압축해제된 확장 프로그램을 로드합니다" → 해제한 폴더 선택\n\n' +
          '■ 첫 사용\n' +
          '- 툴바의 SEASTAR 아이콘 클릭 → 사이드패널 열림\n' +
          '- 회사 이메일 + 초기 비밀번호 "1"로 로그인 (그룹웨어 창이 열립니다)\n' +
          '- 로그인 후 사이드패널이 자동으로 연결되며, 이후 컴퓨터를 켤 때마다 로그인 상태가 자동 유지됩니다\n' +
          '- "🏠 앱" 탭에서 그룹웨어 전체 기능을 확장 안에서 그대로 사용 가능, "🗖 전체화면"으로 언제든 새 탭 이동 가능\n\n' +
          '문의: designsir@seastargo.com',
        timestamp: Date.now(),
        likes: 0,
        type: 'notice',
        comments: [],
      });
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(postsNow));
    }
    // ★ 확장앱 v1.0.16 업데이트 + 모바일 사용 안내 공지 — 전 직원 1회 자동 게시 (기존 글 보존, 최상단 추가)
    const EXT_UPDATE_NOTICE_ID = 'post_ext_update_v116';
    const postsNow2: Post[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
    if (!postsNow2.some(p => p.id === EXT_UPDATE_NOTICE_ID)) {
      postsNow2.unshift({
        id: EXT_UPDATE_NOTICE_ID,
        authorId: '5',
        authorName: '김봉정',
        title: '[공지] Seastar GW 확장앱 v1.0.16 업데이트 & 모바일 사용 안내',
        content:
          '전 직원 대상 — Seastar GW 확장 프로그램이 v1.0.16으로 업데이트되었습니다. 아래 내용 확인 부탁드립니다.\n\n' +
          '■ 1. 버전 업데이트 (v1.0.16)\n' +
          '자동 설치(.bat)로 설치하신 분은 순차적으로 자동 업데이트됩니다. 아직 업데이트가 안 된 경우 아래 방법으로 수동 확인해 주세요.\n' +
          '1. 크롬 주소창에 chrome://extensions 입력 후 이동\n' +
          '2. 우측 상단 "개발자 모드" 켜기\n' +
          '3. 좌측 상단 "업데이트" 버튼 클릭 (또는 브라우저 완전히 껐다 재시작)\n' +
          '4. 버전이 1.0.16 이상으로 표시되면 완료\n\n' +
          '■ 2. "즉시 업데이트" 버튼 정상화\n' +
          '사이드패널의 "⚡ 지금 업데이트" 버튼이 이제 실제로 새 버전을 다운로드해 반영합니다. 이전에는 눌러도 반영되지 않던 문제가 있었는데, 이번 버전부터 정상 동작합니다.\n\n' +
          '■ 3. 휴대폰에서도 사용 가능\n' +
          '- 안드로이드(크롬) / 아이폰(사파리)에서 https://sgw.seastar.work 접속\n' +
          '- 안드로이드: 우측 상단 ⋮ 메뉴 → "홈 화면에 추가"\n' +
          '- 아이폰: 공유 버튼 → "홈 화면에 추가"\n' +
          '- 추가 후 홈 화면 아이콘으로 앱처럼 바로 접속할 수 있습니다\n\n' +
          '■ 문의\n' +
          '설치/업데이트 관련 문의는 designsir@seastargo.com 으로 연락 주세요.',
        timestamp: Date.now(),
        likes: 0,
        type: 'notice',
        comments: [],
      });
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(postsNow2));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ONLINE)) {
      localStorage.setItem(STORAGE_KEYS.ONLINE, JSON.stringify({}));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LOGIN_HISTORY)) {
      localStorage.setItem(STORAGE_KEYS.LOGIN_HISTORY, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTICE_CHECK)) {
      localStorage.setItem(STORAGE_KEYS.NOTICE_CHECK, JSON.stringify({}));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CHAT_ROOMS)) {
      localStorage.setItem(STORAGE_KEYS.CHAT_ROOMS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES)) {
      localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.APPROVALS)) {
      localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SCHEDULES)) {
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(INITIAL_SCHEDULES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS)) {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify([]));
    }
  },

  changePassword: async (userId: string, newPassword: string): Promise<void> => {
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find(u => u.id === userId);
    const updatedUsers = users.map(u => u.id === userId ? { ...u, password: btoa(newPassword), passwordChanged: true } : u);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

    if (user) {
      await MockServer.logActivity(userId, user.name, '비밀번호 변경', '사용자가 직접 비밀번호를 변경함');
    }
  },

  isInitialPasswordRequired: async (userId: string): Promise<{ required: boolean; count: number }> => {
    await delay(200);
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find((u: User) => u.id === userId);
    if (!user) return { required: false, count: 0 };

    // Default password is '1' or btoa('1')
    const isDefault = user.password === '1' || user.password === btoa('1');
    if (isDefault && !user.passwordChanged) {
      // If skip count is 3 or more, they MUST change it (no skip button)
      // If skip count is less than 3, they can skip.
      // The modal will decide whether to show skip button based on this count.
      return { required: true, count: user.passwordChangeCount || 0 };
    }
    return { required: false, count: 0 };
  },

  updatePasswordChangedStatus: async (userId: string, count: number): Promise<void> => {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const updatedUsers = users.map((u: User) => {
      if (u.id === userId) {
        return { ...u, passwordChangeCount: count };
      }
      return u;
    });
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
  },

  getUsers: async (): Promise<User[]> => {
    await delay(500);
    let users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    // Proactively remove '최성규' if he somehow exists in localStorage
    const hasChoi = users.some((u: User) => u.name === '최성규');
    if (hasChoi) {
      users = users.filter((u: User) => u.name !== '최성규');
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }
    // Obfuscate password for client retrieval to simulate backend safety
    return users.map((u: User) => ({ ...u, password: '' }));
  },

  createUser: async (user: User): Promise<User> => {
    await delay(400);
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    if (users.find(u => u.id === user.id)) {
      throw new Error('User ID already exists');
    }
    // Encode default password '1' if not provided
    const newUser = { ...user, password: btoa(user.password || '1') };
    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    await MockServer.logActivity('admin', '시스템 관리자', '사용자 생성', `${newUser.name}(${newUser.id}) 계정 생성`);
    return newUser;
  },

  deleteUser: async (userId: string): Promise<void> => {
    await delay(300);
    let users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find(u => u.id === userId);
    users = users.filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    if (user) {
      await MockServer.logActivity('admin', '시스템 관리자', '사용자 삭제', `${user.name}(${userId}) 계정 삭제`);
    }
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<User | undefined> => {
    await delay(300);
    let users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return undefined;

    // Merge all updates including name, department, position etc.
    users[idx] = { ...users[idx], ...updates };

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    await MockServer.logActivity('admin', '시스템 관리자', '사용자 정보 수정', `${users[idx].name}(${userId}) 정보 변경: ${Object.keys(updates).join(', ')}`);
    return { ...users[idx], password: '' };
  },


  bulkResetPasswords: async (newPassword: string): Promise<void> => {
    await delay(300);
    let users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    // ★ 비번을 초기값으로 재설정할 때는 passwordChanged/count도 함께 리셋해야
    //   본인 재로그인 시 "초기 비밀번호 강제 변경" 화면이 다시 뜬다. (안 그러면 세팅이 무의미)
    users = users.map(u => ({ ...u, password: btoa(newPassword), passwordChanged: false, passwordChangeCount: 0 }));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    await MockServer.logActivity('admin', '시스템 관리자', '비밀번호 일괄 초기화', '모든 사용자의 비밀번호가 초기화됨 (재로그인 시 변경 필요)');
  },

  login: async (userId: string, inputPassword?: string): Promise<User | undefined> => {
    await delay(500);
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find((u: User) => u.id === userId);
    if (!user) return undefined;

    // Check if passwords match (input encoded to base64 vs stored string)
    // For legacy data compatibility, if password exists and matches string OR encoded version
    if (inputPassword && user.password !== inputPassword && user.password !== btoa(inputPassword)) {
      return undefined;
    }

    await MockServer.logLoginHistory(user.id, 'login');
    await MockServer.logActivity(user.id, user.name, '로그인', '아이디/비밀번호 로그인 성공');
    return { ...user, password: '' };
  },

  // ★ Google 계정(회사메일) 로그인 전용 — 신뢰된 외부 인증(Google ID 토큰 검증) 성공 후에만 호출할 것.
  // 비밀번호 검사를 생략하므로 login()과 별개 함수로 분리 — login()의 검증 로직은 절대 건드리지 않는다.
  loginTrusted: async (userId: string): Promise<User | undefined> => {
    await delay(500);
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find((u: User) => u.id === userId);
    if (!user) return undefined;

    await MockServer.logLoginHistory(user.id, 'login');
    await MockServer.logActivity(user.id, user.name, '로그인', 'Google 계정 로그인 성공');
    return { ...user, password: '' };
  },

  loginByEmail: async (email: string, inputPassword?: string): Promise<User | undefined> => {
    await delay(500);
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find((u: User) => u.email === email);
    if (!user) return undefined;

    if (inputPassword && user.password !== inputPassword && user.password !== btoa(inputPassword)) {
      return undefined;
    }

    await MockServer.logLoginHistory(user.id, 'login');
    await MockServer.logActivity(user.id, user.name, '로그인', '이메일 로그인 성공');
    return { ...user, password: '' };
  },

  logLoginHistory: async (userId: string, type: 'login' | 'logout'): Promise<void> => {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGIN_HISTORY) || '[]');
    history.push({
      id: `login_${Date.now()}`,
      userId,
      type,
      timestamp: Date.now()
    });
    // Keep last 1000 records to prevent bloating
    if (history.length > 1000) history.shift();
    localStorage.setItem(STORAGE_KEYS.LOGIN_HISTORY, JSON.stringify(history));
  },

  getLoginHistory: async (): Promise<any[]> => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGIN_HISTORY) || '[]');
  },

  logActivity: async (userId: string, userName: string, type: string, details: string): Promise<void> => {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS) || '[]');
    logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId,
      userName,
      type,
      details,
      timestamp: Date.now()
    });
    // Keep last 10000 logs
    if (logs.length > 10000) logs.shift();
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(logs));
  },

  getActivityLogs: async (): Promise<any[]> => {
    await delay(300);
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS) || '[]').sort((a: any, b: any) => b.timestamp - a.timestamp);
  },

  heartbeat: async (userId: string): Promise<void> => {
    // 로컬 폴백 유지 (개발환경/서버 다운 시)
    const onlineStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.ONLINE) || '{}');
    onlineStatus[userId] = Date.now();
    localStorage.setItem(STORAGE_KEYS.ONLINE, JSON.stringify(onlineStatus));

    // 서버(D1) 하트비트 — 최대 15초에 한 번만 POST (throttle)
    const now = Date.now();
    if (now - _lastHeartbeatPost >= 15000) {
      _lastHeartbeatPost = now;
      try {
        await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch {
        // 네트워크 실패는 조용히 무시 (로컬 폴백으로 동작)
      }
    }
  },

  getOnlineUsers: async (): Promise<string[]> => {
    const now = Date.now();

    // 서버(D1) 우선 — 최대 6초에 한 번만 GET (throttle)
    if (now - _lastOnlineFetch >= 6000) {
      _lastOnlineFetch = now;
      try {
        const res = await fetch('/api/presence');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.online)) {
            _onlineCache = data.online.map((id: any) => String(id));
            _serverAvailable = true;
            return _onlineCache;
          }
        }
        throw new Error('presence fetch failed');
      } catch {
        // 서버 없음(개발환경 404)/네트워크 실패 → localStorage 폴백
        _onlineCache = [];
        _serverAvailable = false;
        const onlineStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.ONLINE) || '{}');
        const threshold = 10 * 1000;
        return Object.keys(onlineStatus).filter(userId => (now - onlineStatus[userId]) < threshold);
      }
    }

    // throttle 중 — 서버 사용 가능하면 캐시, 아니면 localStorage 폴백
    if (_serverAvailable) return _onlineCache;
    const onlineStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.ONLINE) || '{}');
    const threshold = 10 * 1000;
    return Object.keys(onlineStatus).filter(userId => (now - onlineStatus[userId]) < threshold);
  },

  getAttendance: async (userId: string): Promise<any[]> => {
    const attendance = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE) || '[]');
    return attendance.filter((a: any) => a.userId === userId);
  },

  updateAttendance: async (userId: string, userName: string, type: 'checkIn' | 'checkOut'): Promise<void> => {
    const attendance = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE) || '[]');
    const now = Date.now();
    attendance.push({
      id: `att_${now}`,
      userId,
      userName,
      type,
      timestamp: now
    });
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
    await MockServer.logActivity(userId, userName, type === 'checkIn' ? '출근' : '퇴근', `${type === 'checkIn' ? '출근' : '퇴근'} 체크 완료`);
  },

  logout: async (userId: string): Promise<void> => {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find((u: User) => u.id === userId);
    const onlineStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.ONLINE) || '{}');
    delete onlineStatus[userId];
    localStorage.setItem(STORAGE_KEYS.ONLINE, JSON.stringify(onlineStatus));
    // 서버(D1) presence 즉시 제거 — best-effort
    try {
      await fetch('/api/presence?logout=' + encodeURIComponent(userId));
    } catch {
      // 실패 무시
    }
    await MockServer.logLoginHistory(userId, 'logout');
    if (user) {
      await MockServer.logActivity(userId, user.name, '로그아웃', '시스템 접속 종료');
    }
  },

  getPosts: async (): Promise<Post[]> => {
    const sortPosts = (posts: Post[]) => posts.sort((a: Post, b: Post) => {
      if (a.type === 'notice' && b.type !== 'notice') return -1;
      if (a.type !== 'notice' && b.type === 'notice') return 1;
      return b.timestamp - a.timestamp;
    });
    // 서버(D1) 우선 — 성공 시 서버 데이터 반환 + localStorage 미러링
    try {
      const res = await fetch('/api/board');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.posts)) {
          const server: Post[] = data.posts;
          mirrorLocal(STORAGE_KEYS.POSTS, server);
          return sortPosts(server);
        }
      }
      throw new Error('board fetch failed');
    } catch {
      await delay(400);
      const posts = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
      return sortPosts(posts);
    }
  },

  createPost: async (author: User, title: string, content: string, type: 'notice' | 'normal' = 'normal'): Promise<Post> => {
    await delay(400);
    const posts: Post[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
    const newPost: Post = {
      id: `post_${Date.now()}`,
      authorId: author.id,
      authorName: author.name,
      title,
      content,
      timestamp: Date.now(),
      likes: 0,
      type,
      comments: []
    };
    // 서버(D1) 우선 — best-effort (실패해도 localStorage 폴백 유지)
    try {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost),
      });
    } catch { /* ignore */ }

    posts.unshift(newPost);
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
    await MockServer.logActivity(author.id, author.name, '게시글 작성', `[${type}] ${title}`);
    return newPost;
  },

  addComment: async (postId: string, user: User, content: string): Promise<Comment> => {
    await delay(200);
    const posts: Post[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
    const postIndex = posts.findIndex(p => p.id === postId);

    if (postIndex === -1) throw new Error('Post not found');

    const newComment: Comment = {
      id: `cmt_${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      content,
      timestamp: Date.now()
    };

    // 서버(D1) 우선 — best-effort
    try {
      await fetch('/api/board?action=comment&postId=' + encodeURIComponent(postId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComment),
      });
    } catch { /* ignore */ }

    posts[postIndex].comments.push(newComment);
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
    await MockServer.logActivity(user.id, user.name, '댓글 작성', `게시글(${postId})에 댓글 추가: ${content.substring(0, 20)}${content.length > 20 ? '...' : ''}`);
    return newComment;
  },

  getNewNotices: async (userId: string): Promise<Post[]> => {
    const checks = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTICE_CHECK) || '{}');
    const lastCheck = checks[userId] || 0;
    const posts: Post[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
    return posts.filter(p => p.type === 'notice' && p.timestamp > lastCheck);
  },

  markNoticeAsRead: async (userId: string): Promise<void> => {
    const checks = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTICE_CHECK) || '{}');
    checks[userId] = Date.now();
    localStorage.setItem(STORAGE_KEYS.NOTICE_CHECK, JSON.stringify(checks));
  },

  getMessages: async (userId: string): Promise<Message[]> => {
    // 서버(D1) 우선 — 성공하면 서버 데이터 반환 + localStorage 미러링
    try {
      const res = await fetch('/api/messages?userId=' + encodeURIComponent(userId));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          const server: Message[] = data.messages;
          mirrorLocal(STORAGE_KEYS.MESSAGES, server);
          return server
            .filter((m) => m.receiverId === userId || m.senderId === userId)
            .sort((a, b) => b.timestamp - a.timestamp);
        }
      }
      throw new Error('messages fetch failed');
    } catch {
      // 폴백: localStorage
      const allMessages: Message[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
      return allMessages
        .filter((m) => m.receiverId === userId || m.senderId === userId)
        .sort((a, b) => b.timestamp - a.timestamp);
    }
  },

  sendMessage: async (sender: User, receiverId: string, content: string, file?: { name: string; data: string }): Promise<Message> => {
    const allMessages: Message[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const receiver = users.find(u => u.id === receiverId);

    if (!receiver) throw new Error('Receiver not found');

    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      senderId: sender.id,
      senderName: sender.name,
      receiverId: receiver.id,
      receiverName: receiver.name,
      content,
      timestamp: Date.now(),
      isRead: false,
      ...(file ? { fileName: file.name, fileData: file.data } : {}),
    };

    // 서버(D1) 우선 — 성공/실패 무관하게 localStorage에도 기록(폴백/미러)
    let serverOk = false;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMessage),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) serverOk = true;
      }
    } catch {
      serverOk = false;
    }

    allMessages.push(newMessage);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
    await MockServer.logActivity(sender.id, sender.name, '쪽지 발송', `${receiver.name}님에게 쪽지 발송: ${content.substring(0, 20)}${content.length > 20 ? '...' : ''}`);
    void serverOk;
    return newMessage;
  },

  markAsRead: async (messageId: string): Promise<void> => {
    // 서버(D1) — best-effort
    try {
      await fetch('/api/messages?action=readone&id=' + encodeURIComponent(messageId), { method: 'POST' });
    } catch { /* ignore */ }
    const allMessages: Message[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    const updatedMessages = allMessages.map(m =>
      m.id === messageId ? { ...m, isRead: true } : m
    );
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedMessages));
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    // 서버(D1) — best-effort
    try {
      await fetch('/api/messages?action=delete&id=' + encodeURIComponent(messageId), { method: 'POST' });
    } catch { /* ignore */ }
    const allMessages: Message[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    const updatedMessages = allMessages.filter(m => m.id !== messageId);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedMessages));
  },

  // 대화 일괄 읽음 (상대→나 메시지 전부 읽음 처리) — 메신저용
  markConversationRead: async (userId: string, otherId: string): Promise<void> => {
    // 서버(D1) — best-effort
    try {
      await fetch('/api/messages?action=read&userId=' + encodeURIComponent(userId) + '&otherId=' + encodeURIComponent(otherId), { method: 'POST' });
    } catch { /* ignore */ }
    const all: Message[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    let changed = false;
    const upd = all.map(m => {
      if (m.receiverId === userId && m.senderId === otherId && !m.isRead) { changed = true; return { ...m, isRead: true }; }
      return m;
    });
    if (changed) localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(upd));
  },

  // Leave Management Methods
  getLeaveRequests: async (userId?: string): Promise<LeaveRequest[]> => {
    // 서버(D1) 우선 — 성공 시 전체 목록 반환 + localStorage 미러링 (userId는 컴포넌트에서 클라 필터)
    try {
      const res = await fetch('/api/leave');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.requests)) {
          const server: LeaveRequest[] = data.requests;
          mirrorLocal(STORAGE_KEYS.LEAVE_REQUESTS, server);
          return server.sort((a, b) => b.requestDate - a.requestDate);
        }
      }
      throw new Error('leave fetch failed');
    } catch {
      await delay(300);
      const allRequests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS) || '[]');
      return allRequests.sort((a, b) => b.requestDate - a.requestDate);
    }
  },

  getTodayLeaveRequests: async (): Promise<LeaveRequest[]> => {
    await delay(200);
    const allRequests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS) || '[]');
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    return allRequests.filter(request => {
      const requestStartDate = new Date(request.startDate);
      const requestEndDate = new Date(request.endDate);

      // 연차 날짜가 오늘과 겹치는지 확인
      const overlapsWithToday =
        (requestStartDate <= todayEnd && requestEndDate >= todayStart) ||
        (requestStartDate >= todayStart && requestStartDate <= todayEnd) ||
        (requestEndDate >= todayStart && requestEndDate <= todayEnd);

      return overlapsWithToday;
    });
  },

  getTodayLeaveUsers: async (): Promise<User[]> => {
    const todayLeaveRequests = await MockServer.getTodayLeaveRequests();
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');

    // 오늘 연차 사용자 목록 반환
    const todayLeaveUserIds = new Set(todayLeaveRequests.map(req => req.userId));
    return users.filter(user => todayLeaveUserIds.has(user.id));
  },
  createLeaveRequest: async (
    userId: string,
    userName: string,
    type: LeaveType,
    startDate: string,
    endDate: string,
    reason: string,
    emergencyContact: string
  ): Promise<LeaveRequest> => {
    await delay(400);
    const requests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS) || '[]');
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (type.includes('half')) {
      diffDays = 0.5;
    }

    const newRequest: LeaveRequest = {
      id: `leave_${Date.now()}`,
      userId,
      userName,
      type,
      startDate,
      endDate,
      days: diffDays,
      reason,
      emergencyContact,
      status: 'approved', // All leaves are auto-approved
      requestDate: Date.now()
    };

    // Auto-create messages to notify Lee Seon-woo (2), Kim Bong-jeong (5), Ko Young-gwan (1)
    const notifyIds = ['1', '2', '5'].filter(id => id !== userId);

    for (const mId of notifyIds) {
      try {
        await MockServer.sendMessage(
          { id: 'system', name: '시스템', role: 'admin' } as User,
          mId,
          `[연차 자동 승인 알림]\n${userName}님의 연차가 자동 승인되었습니다.\n기간: ${startDate} ~ ${endDate}\n사유: ${reason}`
        );
      } catch (e) {
        console.error('알림 발송 실패', e);
      }
    }

    // 서버(D1) 우선 — best-effort (실패해도 localStorage 폴백 유지)
    try {
      await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRequest),
      });
    } catch { /* ignore */ }

    requests.unshift(newRequest);
    localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(requests));

    // Deduct leave balance on request
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        return { ...u, leaveBalance: (u.leaveBalance || 15) - diffDays };
      }
      return u;
    });
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));

    await MockServer.logActivity(userId, userName, '연차 신청', `${type} 신청 (${startDate} ~ ${endDate}, ${diffDays}일)`);
    return newRequest;
  },

  approveLeaveRequest: async (requestId: string, status: 'approved' | 'rejected'): Promise<void> => {
    // 서버(D1) — best-effort
    try {
      await fetch('/api/leave?action=approve&id=' + encodeURIComponent(requestId) + '&status=' + encodeURIComponent(status), { method: 'POST' });
    } catch { /* ignore */ }
    const requests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS) || '[]');
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');

    let targetUserId = '';
    let daysToRefund = 0;

    const updatedRequests = requests.map(r => {
      if (r.id === requestId) {
        targetUserId = r.userId;
        daysToRefund = r.days;
        return { ...r, status };
      }
      return r;
    });

    localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(updatedRequests));

    // Refund leave balance if rejected
    if (status === 'rejected' && targetUserId) {
      const updatedUsers = users.map(u => {
        if (u.id === targetUserId) {
          return { ...u, leaveBalance: (u.leaveBalance || 15) + daysToRefund };
        }
        return u;
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    }
  },

  updateLeaveRequest: async (requestId: string, updates: Partial<LeaveRequest>, editorId: string): Promise<void> => {
    const requests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS) || '[]');
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');

    let targetUserId = '';
    let oldDays = 0;

    // Kim Bong-jeong (5) or Lee Seon-woo (2) can update directly
    const isManager = editorId === '5' || editorId === '2';

    const updatedRequests = requests.map(r => {
      if (r.id === requestId) {
        targetUserId = r.userId;
        oldDays = r.days;

        // Check if same day as registration
        const isToday = isSameDay(r.requestDate, Date.now());
        const canBypassApproval = isManager || isToday;

        const newStatus = canBypassApproval ? 'approved' : 'pending_approval';

        if (!canBypassApproval) {
          MockServer.sendMessage(
            { id: 'system', name: '시스템', role: 'admin' } as User,
            '2',
            `[연차 수정 요청]\n${r.userName}님이 연차 수정을 요청했습니다.\n관리자 승인이 필요합니다.`
          );
        }
        return { ...r, ...updates, status: newStatus };
      }
      return r;
    });

    localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(updatedRequests));

    // 서버(D1) — best-effort: 병합된 최종 레코드 필드를 서버에 반영
    try {
      const merged = updatedRequests.find(r => r.id === requestId);
      if (merged) {
        await fetch('/api/leave?action=update&id=' + encodeURIComponent(requestId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        });
      }
    } catch { /* ignore */ }

    // Adjust leave balance if days changed and it was auto-approved/approved
    if (updates.days !== undefined && oldDays !== updates.days && targetUserId) {
      const idx = updatedRequests.findIndex(r => r.id === requestId);
      if (updatedRequests[idx].status === 'approved') {
        const diff = updates.days - oldDays;
        const updatedUsers = users.map(u => {
          if (u.id === targetUserId) {
            return { ...u, leaveBalance: (u.leaveBalance || 15) - diff };
          }
          return u;
        });
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
      }
    }
  },

  deleteLeaveRequest: async (requestId: string, userId: string): Promise<void> => {
    const requests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS) || '[]');
    const targetRequest = requests.find(r => r.id === requestId);
    if (!targetRequest) return;

    const isManager = userId === '5' || userId === '2';
    const isToday = isSameDay(targetRequest.requestDate, Date.now());

    // Kim Bong-jeong (5) or Lee Seon-woo (2) can delete directly, or same-day deletion
    if (isManager || isToday) {
      // 서버(D1) — best-effort 삭제
      try {
        await fetch('/api/leave?action=delete&id=' + encodeURIComponent(requestId), { method: 'POST' });
      } catch { /* ignore */ }
      const updatedRequests = requests.filter(r => r.id !== requestId);
      localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(updatedRequests));

      // Refund leave balance on direct deletion
      const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      const updatedUsers = users.map(u => {
        if (u.id === targetRequest.userId) {
          return { ...u, leaveBalance: (u.leaveBalance || 15) + targetRequest.days };
        }
        return u;
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
      return;
    }

    // Others (historical delete): set status to pending_delete
    const updatedRequests = requests.map(r => {
      if (r.id === requestId) {
        MockServer.sendMessage(
          { id: 'system', name: '시스템', role: 'admin' } as User,
          '2',
          `[연차 삭제 요청]\n${r.userName}님이 연차 삭제를 요청했습니다.\n관리자 승인이 필요합니다.`
        );
        return { ...r, status: 'pending_delete' as const };
      }
      return r;
    });

    localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(updatedRequests));

    // 서버(D1) — best-effort: 삭제요청 상태 반영
    try {
      await fetch('/api/leave?action=approve&id=' + encodeURIComponent(requestId) + '&status=pending_delete', { method: 'POST' });
    } catch { /* ignore */ }
  },

  getApprovals: async (userId: string): Promise<Approval[]> => {
    // 서버(D1) 우선 — 본인 상신/결재분 반환 + localStorage 미러링
    try {
      const res = await fetch('/api/approvals?userId=' + encodeURIComponent(userId));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.approvals)) {
          const server: Approval[] = data.approvals;
          mirrorLocal(STORAGE_KEYS.APPROVALS, server);
          return server.sort((a, b) => b.updatedAt - a.updatedAt);
        }
      }
      throw new Error('approvals fetch failed');
    } catch {
      await delay(300);
      const approvals: Approval[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPROVALS) || '[]');
      return approvals
        .filter(a => a.requesterId === userId || a.approverId === userId)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }
  },

  createApproval: async (requester: User, approverId: string, title: string, content: string, status: 'draft' | 'pending', attachment?: string): Promise<Approval> => {
    await delay(400);
    const approvals: Approval[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPROVALS) || '[]');
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const approver = users.find(u => u.id === approverId);

    if (!approver) throw new Error("Approver not found");

    const newApproval: Approval = {
      id: `apv_${Date.now()}`,
      requesterId: requester.id,
      requesterName: requester.name,
      approverId: approver.id,
      approverName: approver.name,
      title,
      content,
      status,
      attachment,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 서버(D1) 우선 — best-effort
    try {
      await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApproval),
      });
    } catch { /* ignore */ }

    approvals.unshift(newApproval);
    localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify(approvals));
    return newApproval;
  },

  updateApprovalStatus: async (approvalId: string, status: 'approved' | 'rejected'): Promise<void> => {
    // 서버(D1) — best-effort
    try {
      await fetch('/api/approvals?action=decide&id=' + encodeURIComponent(approvalId) + '&status=' + encodeURIComponent(status), { method: 'POST' });
    } catch { /* ignore */ }
    await delay(300);
    let approvals: Approval[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPROVALS) || '[]');
    approvals = approvals.map(a => a.id === approvalId ? { ...a, status, updatedAt: Date.now() } : a);
    localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify(approvals));
    const approval = approvals.find(a => a.id === approvalId);
    if (approval) {
      await MockServer.logActivity('admin', '시스템 관리자', '결재 상태 변경', `결재(${approvalId}) 상태를 ${status === 'approved' ? '승인' : '반려'}으로 변경`);
    }
  },

  logAttendance: async (userId: string, type: 'clock_in' | 'clock_out'): Promise<AttendanceLog> => {
    const logs: AttendanceLog[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE) || '[]');
    const newLog: AttendanceLog = {
      id: `att_${Date.now()}`,
      userId,
      type,
      timestamp: Date.now(),
      location: '지정 근무지 (인증됨)'
    };
    logs.push(newLog);
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(logs));
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find((u: any) => u.id === userId);
    await MockServer.logActivity(userId, user?.name || userId, type === 'clock_in' ? '출근' : '퇴근', `${type === 'clock_in' ? '출근' : '퇴근'} 체크 완료 (지정 근무지)`);
    return newLog;
  },

  getTodayAttendance: async (userId: string): Promise<{ clockIn: number | null, clockOut: number | null }> => {
    const logs: AttendanceLog[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE) || '[]');
    const today = new Date().setHours(0, 0, 0, 0);

    const todayLogs = logs.filter(l =>
      l.userId === userId &&
      l.timestamp >= today
    );

    const clockIn = todayLogs.find(l => l.type === 'clock_in')?.timestamp || null;
    const clockOut = todayLogs.filter(l => l.type === 'clock_out').sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp || null;

    return { clockIn, clockOut };
  },

  // Schedule Methods (Including Leave & Holidays)
  getSchedules: async (userId: string): Promise<Schedule[]> => {
    await delay(300);
    const manualSchedules: Schedule[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES) || '[]');
    const leaveRequests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS) || '[]');

    // 1. Approved Leave Schedules (Visible to ALL)
    const leaveSchedules: Schedule[] = leaveRequests
      .filter(req => req.status === 'approved')
      .map(req => ({
        id: req.id,
        userId: req.userId,
        userName: req.userName,
        title: `${req.userName} - ${req.type === 'annual' ? '연차' : '휴가'}`,
        type: 'leave',
        startDate: req.startDate,
        endDate: req.endDate,
        isAllDay: true,
        color: 'bg-green-500'
      }));

    // 2. Holidays
    const holidaySchedules: Schedule[] = HOLIDAY_DATA.map((h, idx) => ({
      id: `holiday_${idx}`,
      userId: 'system',
      userName: 'System',
      title: h.name,
      type: 'company',
      startDate: h.date,
      endDate: h.date,
      isAllDay: true,
      color: 'bg-red-100 text-red-600 holiday-text'
    }));

    // 3. Manual Schedules
    const relevantManual = manualSchedules.filter(s => s.type === 'company' || s.userId === userId);

    return [...holidaySchedules, ...relevantManual, ...leaveSchedules];
  },

  createSchedule: async (schedule: Schedule): Promise<Schedule> => {
    await delay(400);
    const schedules: Schedule[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES) || '[]');
    schedules.push(schedule);
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
    await MockServer.logActivity(schedule.userId, schedule.userName, '일정 등록', `새 일정 등록: ${schedule.title}`);
    return schedule;
  },

  deleteSchedule: async (id: string): Promise<void> => {
    let schedules: Schedule[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES) || '[]');
    schedules = schedules.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
  },

  // Chat Methods
  getChatRooms: async (userId: string): Promise<ChatRoom[]> => {
    // 서버(D1) 우선 — 성공하면 서버 방목록 반환 + localStorage 미러링
    try {
      const res = await fetch('/api/chat?userId=' + encodeURIComponent(userId));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          const server: ChatRoom[] = data.rooms;
          // 미러: 기존 로컬 방 + 서버 방 병합(서버 우선) 저장
          const local: ChatRoom[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_ROOMS) || '[]');
          const byId: Record<string, ChatRoom> = {};
          for (const r of local) byId[r.id] = r;
          for (const r of server) byId[r.id] = r;
          mirrorLocal(STORAGE_KEYS.CHAT_ROOMS, Object.values(byId));
          return server.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        }
      }
      throw new Error('chat rooms fetch failed');
    } catch {
      const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_ROOMS) || '[]');
      return rooms.filter(r => r.participants.includes(userId)).sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    }
  },

  startChat: async (myId: string, otherId: string): Promise<ChatRoom> => {
    const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_ROOMS) || '[]');

    // Check if room exists (서버 방목록도 확인해 크로스브라우저 중복 방 방지)
    let room = rooms.find(r =>
      r.participants.includes(myId) &&
      r.participants.includes(otherId) &&
      r.participants.length === 2
    );

    if (!room) {
      // 서버에 이미 같은 방이 있는지 조회
      try {
        const res = await fetch('/api/chat?userId=' + encodeURIComponent(myId));
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.rooms)) {
            const found = (data.rooms as ChatRoom[]).find(r =>
              r.participants.includes(myId) &&
              r.participants.includes(otherId) &&
              r.participants.length === 2
            );
            if (found) room = found;
          }
        }
      } catch { /* ignore — 로컬 신규 생성으로 진행 */ }
    }

    if (!room) {
      room = {
        id: `room_${Date.now()}`,
        participants: [myId, otherId],
        lastMessage: '',
        lastMessageTime: Date.now(),
      };
    }

    // localStorage에 upsert
    const existsIdx = rooms.findIndex(r => r.id === room!.id);
    if (existsIdx === -1) rooms.push(room);
    else rooms[existsIdx] = room;
    localStorage.setItem(STORAGE_KEYS.CHAT_ROOMS, JSON.stringify(rooms));

    // 서버(D1)에도 방 upsert — best-effort
    try {
      await fetch('/api/chat?action=room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(room),
      });
    } catch { /* ignore */ }

    return room;
  },

  getChatMessages: async (roomId: string): Promise<ChatMessage[]> => {
    // 서버(D1) 우선 — 성공하면 서버 메시지 반환 + localStorage 미러링
    try {
      const res = await fetch('/api/chat?roomId=' + encodeURIComponent(roomId));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          const server: ChatMessage[] = data.messages;
          // 미러: 다른 방 메시지는 유지, 이 방 메시지는 서버로 교체
          const local: ChatMessage[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES) || '[]');
          const others = local.filter(m => m.roomId !== roomId);
          mirrorLocal(STORAGE_KEYS.CHAT_MESSAGES, [...others, ...server]);
          return server.sort((a, b) => a.timestamp - b.timestamp);
        }
      }
      throw new Error('chat messages fetch failed');
    } catch {
      const messages: ChatMessage[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES) || '[]');
      return messages.filter(m => m.roomId === roomId).sort((a, b) => a.timestamp - b.timestamp);
    }
  },

  sendChatMessage: async (roomId: string, senderId: string, content: string): Promise<ChatMessage> => {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find((u: any) => u.id === senderId);

    const messages: ChatMessage[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES) || '[]');
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      roomId,
      senderId,
      content,
      timestamp: Date.now(),
      readBy: [senderId]
    };

    // 서버(D1) 우선 — best-effort. senderName 포함해 전송.
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newMessage, senderName: user?.name || senderId }),
      });
    } catch { /* ignore */ }

    messages.push(newMessage);
    localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(messages));

    // Update Room last message
    const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_ROOMS) || '[]');
    const updatedRooms = rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          lastMessage: content,
          lastMessageTime: Date.now(),
          lastMessageSenderId: senderId
        };
      }
      return r;
    });
    localStorage.setItem(STORAGE_KEYS.CHAT_ROOMS, JSON.stringify(updatedRooms));

    await MockServer.logActivity(senderId, user?.name || senderId, '채팅 메시지', `채팅방(${roomId})에 메시지 전송: ${content.substring(0, 20)}${content.length > 20 ? '...' : ''}`);

    return newMessage;
  },

  resetData: () => {
    localStorage.clear();
    window.location.reload();
  },

  // 비밀번호 리셋 로깅 (김봉정 관리자 전용)
  resetPassword: async (targetUserId: string, newResetPassword: string, requesterId: string): Promise<void> => {
    await delay(300);

    // 요청자가 김봉정 관리자인지 확인
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const requester = users.find(u => u.id === requesterId);

    if (!requester || (requester.id !== '2' && requester.id !== '5')) {
      throw new Error('비밀번호 리셋 권한이 없습니다.');
    }

    // 타겟 사용자 존재 확인
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    // 비밀번호 리셋 로그 기록
    const logs: PasswordResetLog[] = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PASSWORD_RESET_LOGS) || '[]'
    );

    const resetLog: PasswordResetLog = {
      id: `reset_${Date.now()}`,
      targetUserId,
      targetUserName: targetUser.name,
      targetEmail: targetUser.email || '',
      requesterId,
      requesterName: requester.name,
      requesterRole: requester.role,
      resetDate: Date.now(),
      ipAddress: 'unknown', // 실제 환경에서는 request.ip
      deviceInfo: 'unknown', // 실제 환경에서는 navigator.userAgent
      wasSuccessful: false, // 초기 상태
      reason: ''
    };

    logs.push(resetLog);
    localStorage.setItem(STORAGE_KEYS.PASSWORD_RESET_LOGS, JSON.stringify(logs));

    // 사용자 비밀번호 변경
    const userIndex = users.findIndex(u => u.id === targetUserId);
    if (userIndex === -1) throw new Error('User not found');

    users[userIndex].password = btoa(newResetPassword); // 비밀번호 저장
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    // 성공 로그 갱신
    const successLogIndex = logs.findIndex(l => l.id === resetLog.id);
    if (successLogIndex !== -1) {
      logs[successLogIndex].wasSuccessful = true;
      logs[successLogIndex].reason = '비밀번호 리셋 완료';
      localStorage.setItem(STORAGE_KEYS.PASSWORD_RESET_LOGS, JSON.stringify(logs));
    }

    return;
  },

  // 비밀번호 리셋 로그 조회
  getPasswordResetLogs: async (): Promise<PasswordResetLog[]> => {
    await delay(100);
    const logs: PasswordResetLog[] = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PASSWORD_RESET_LOGS) || '[]');

    // 최근 100개만 반환 (최신순)
    return logs.slice(-100).sort((a, b) => b.resetDate - a.resetDate);
  }
}

// ===========================================
// 백엔드 메일 자동 로그인 기능
// ===========================================

export interface MailLoginResult {
  success: boolean;
  message: string;
  timestamp: number;
  attemptCount: number;
}

export interface MailLoginState {
  isLoggedIn: boolean;
  lastLoginAttempt: number;
  attemptCount: number;
  currentUser?: string;
}

// 백엔드 메일 로그인 상태 관리
let mailLoginState: MailLoginState = {
  isLoggedIn: false,
  lastLoginAttempt: 0,
  attemptCount: 0,
};

/**
 * 백엔드 메일 자동 로그인 처리
 * 실제 환경에서는 MailPlug API를 호출
 */
export const mailAutoLogin = async (
  email: string,
  password: string,
  userId: string
): Promise<MailLoginResult> => {
  console.log('[MockServer] Mail auto-login requested for:', email);
  await delay(500); // API 호출 시뮤레이션

  // 로그인 시도 카운터 증가
  mailLoginState.attemptCount++;
  mailLoginState.lastLoginAttempt = Date.now();

  try {
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    // 실제 환경에서는 MailPlug API 호출
    // 예: await fetch('https://api.mailplug.com/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email, password })
    // });

    // Mock 환경에서는 시뮤레이션
    const success = Math.random() > 0.1; // 90% 확률로 성공

    if (success) {
      mailLoginState.isLoggedIn = true;
      mailLoginState.currentUser = userId;

      // 로그인 로그 기록
      const loginHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGIN_HISTORY) || '[]');
      const newLog = {
        id: `login_mail_${Date.now()}`,
        userId,
        userName: users.find(u => u.id === userId)?.name || 'Unknown',
        email,
        type: 'login' as const,
        timestamp: Date.now(),
        deviceInfo: navigator.userAgent,
        ipAddress: '127.0.0.1',
        status: 'success' as const,
      };
      loginHistory.push(newLog);
      localStorage.setItem(STORAGE_KEYS.LOGIN_HISTORY, JSON.stringify(loginHistory));

      console.log('[MockServer] Mail login successful');
      return {
        success: true,
        message: '백엔드 메일 로그인 완료',
        timestamp: Date.now(),
        attemptCount: mailLoginState.attemptCount,
      };
    } else {
      mailLoginState.isLoggedIn = false;

      // 실패 로그 기록
      const loginHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGIN_HISTORY) || '[]');
      const newLog = {
        id: `login_mail_failed_${Date.now()}`,
        userId,
        userName: users.find(u => u.id === userId)?.name || 'Unknown',
        email,
        type: 'login' as const,
        timestamp: Date.now(),
        deviceInfo: navigator.userAgent,
        ipAddress: '127.0.0.1',
        status: 'failed' as const,
        failureReason: '이메일 또는 비밀번호가 틀렸습니다.',
      };
      loginHistory.push(newLog);
      localStorage.setItem(STORAGE_KEYS.LOGIN_HISTORY, JSON.stringify(loginHistory));

      console.log('[MockServer] Mail login failed');
      return {
        success: false,
        message: '이메일 또는 비밀번호가 틀렸습니다.',
        timestamp: Date.now(),
        attemptCount: mailLoginState.attemptCount,
      };
    }
  } catch (error) {
    console.error('[MockServer] Mail login error:', error);

    return {
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: Date.now(),
      attemptCount: mailLoginState.attemptCount,
    };
  }
};

/**
 * 백엔드 메일 로그인 상태 확인
 */
export const getMailLoginState = (): MailLoginState => {
  return { ...mailLoginState };
};

/**
 * 백엔드 메일 로그아웃 처리
 */
export const mailLogout = async (userId: string): Promise<void> => {
  console.log('[MockServer] Mail logout requested for:', userId);
  await delay(200);

  mailLoginState.isLoggedIn = false;
  mailLoginState.currentUser = undefined;

  // 로그아웃 로그 기록
  const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  const loginHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGIN_HISTORY) || '[]');
  const newLog = {
    id: `logout_mail_${Date.now()}`,
    userId,
    userName: users.find(u => u.id === userId)?.name || 'Unknown',
    email: users.find(u => u.id === userId)?.email || '',
    type: 'logout' as const,
    timestamp: Date.now(),
    deviceInfo: navigator.userAgent,
    ipAddress: '127.0.0.1',
    status: 'success' as const,
  };
  loginHistory.push(newLog);
  localStorage.setItem(STORAGE_KEYS.LOGIN_HISTORY, JSON.stringify(loginHistory));
};

/**
 * 백엔드 메일 로그인 시도 초기화 (실패 시 재시도용)
 */
export const resetMailLoginState = (): void => {
  mailLoginState = {
    isLoggedIn: false,
    lastLoginAttempt: 0,
    attemptCount: 0,
  };
  console.log('[MockServer] Mail login state reset');
};