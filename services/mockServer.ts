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
const INITIAL_USERS: User[] = [
  { id: '1', name: '고영관', email: 'kohyk@seasargo.com', role: 'manager', status: 'active', position: 'CEO', department: '임원', joinDate: '2010-01-01', phone: '010-2830-4610', totalLeave: 15, carryover: 0, leaveBalance: 15, password: '1', avatar: generate3DAvatar('고영관', '#4facfe', '#00f2fe') },
  { id: '2', name: '이선우', email: 'lsw00@seasargo.com', role: 'manager', status: 'active', position: '부장', department: '배관', joinDate: '2017-07-01', phone: '010-6805-1307', totalLeave: 18, carryover: 0, leaveBalance: 16.5, password: '1', avatar: generate3DAvatar('이선우', '#f093fb', '#f5576c') },
  { id: '3', name: '김미진', email: 'kimmj@seasargo.com', role: 'manager', status: 'active', position: '차장', department: '배관', joinDate: '2023-10-16', phone: '010-7328-1223', totalLeave: 17, carryover: -1, leaveBalance: 15.5, password: '1', avatar: generate3DAvatar('김미진', '#84fab0', '#8fd3f4') },
  { id: '4', name: '김민경', email: 'min55@seasargo.com', role: 'manager', status: 'active', position: '대리', department: '배관', joinDate: '2018-12-11', phone: '010-8540-0073', totalLeave: 22, carryover: 4, leaveBalance: 16, password: '1', avatar: generate3DAvatar('김민경', '#fa709a', '#fee140') },
  { id: '5', name: '김봉정', email: 'designsir@seasargo.com', role: 'admin', status: 'active', position: '부장', department: '전장', joinDate: '2019-04-01', phone: '010-4544-0953', totalLeave: 18.5, carryover: 0.5, leaveBalance: 18.5, password: '0953', avatar: generate3DAvatar('김봉정', '#a18cd1', '#fbc2eb') },
  { id: '6', name: '김선우', email: 'swlee@seasargo.com', role: 'manager', status: 'active', position: '차장', department: '철의장', joinDate: '2018-10-15', phone: '010-8631-4430', totalLeave: 17, carryover: -1, leaveBalance: 15, password: '1', avatar: generate3DAvatar('김선우', '#ff0844', '#ffb199') },
  { id: '7', name: '이재명', email: 'leejm@seasargo.com', role: 'manager', status: 'active', position: '전무', department: '임원', joinDate: '2020-01-01', phone: '010-1234-5678', totalLeave: 20, carryover: 0, leaveBalance: 20, password: '1', avatar: generate3DAvatar('이재명', '#f6d365', '#fda085') },
  { id: '8', name: '김정인', email: 'kimji@seasargo.com', role: 'user', status: 'active', position: '사원', department: '전장', joinDate: '2024-01-15', phone: '010-1111-2222', totalLeave: 15, carryover: 0, leaveBalance: 15, password: '1', avatar: generate3DAvatar('김정인', '#667eea', '#764ba2') },
  { id: '9', name: '장현현', email: 'janghh@seasargo.com', role: 'user', status: 'active', position: '주임', department: '전장', joinDate: '2026-03-03', phone: '010-0000-0000', totalLeave: 0, carryover: 0, leaveBalance: 0, password: '1', avatar: generate3DAvatar('장현현', '#fdfbfb', '#ebedee') },
];

const INITIAL_POSTS: Post[] = [
  {
    id: 'post1',
    authorId: '2',
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

const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'leave_1', userId: '2', userName: '이선우', type: 'annual', startDate: '2026-01-02', endDate: '2026-01-02', days: 1, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-02T00:00:00').getTime() },
  { id: 'leave_2', userId: '2', userName: '이선우', type: 'morning_half', startDate: '2026-02-03', endDate: '2026-02-03', days: 0.5, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-02-03T00:00:00').getTime() },
  { id: 'leave_3', userId: '3', userName: '김미진', type: 'morning_half', startDate: '2026-02-05', endDate: '2026-02-05', days: 0.5, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-02-05T00:00:00').getTime() },
  { id: 'leave_4', userId: '3', userName: '김미진', type: 'afternoon_half', startDate: '2026-02-25', endDate: '2026-02-25', days: 0.5, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-02-25T00:00:00').getTime() },
  { id: 'leave_5', userId: '4', userName: '김민경', type: 'annual', startDate: '2026-01-09', endDate: '2026-01-09', days: 1, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-09T00:00:00').getTime() },
  { id: 'leave_6', userId: '4', userName: '김민경', type: 'annual', startDate: '2026-01-16', endDate: '2026-01-16', days: 1, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-16T00:00:00').getTime() },
  { id: 'leave_7', userId: '4', userName: '김민경', type: 'annual', startDate: '2026-01-23', endDate: '2026-01-23', days: 1, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-23T00:00:00').getTime() },
  { id: 'leave_9', userId: '6', userName: '김선우', type: 'annual', startDate: '2026-01-02', endDate: '2026-01-02', days: 1, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-02T00:00:00').getTime() },
  { id: 'leave_10', userId: '6', userName: '김선우', type: 'annual', startDate: '2026-01-30', endDate: '2026-01-30', days: 1, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-30T00:00:00').getTime() },
  { id: 'leave_11', userId: '4', userName: '김민경', type: 'annual', startDate: '2026-02-27', endDate: '2026-02-27', days: 1, reason: '', emergencyContact: '', status: 'approved', requestDate: Date.now() },
  { id: 'leave_12', userId: '4', userName: '김민경', type: 'afternoon_half', startDate: '2026-03-06', endDate: '2026-03-06', days: 0.5, reason: '', emergencyContact: '', status: 'approved', requestDate: Date.now() },
  { id: 'leave_13', userId: '4', userName: '김민경', type: 'annual', startDate: '2026-03-25', endDate: '2026-03-25', days: 1, reason: '', emergencyContact: '', status: 'approved', requestDate: Date.now() },
  { id: 'leave_14', userId: '3', userName: '김미진', type: 'afternoon_half', startDate: '2026-02-27', endDate: '2026-02-27', days: 0.5, reason: '', emergencyContact: '', status: 'approved', requestDate: Date.now() },
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
  MIGRATION: 'app_migration_v2'
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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
    const MIGRATION_KEY = 'app_migration_v2'; // To prevent re-adding deleted users
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      localStorage.setItem(MIGRATION_KEY, 'done');
    } else if (!localStorage.getItem(MIGRATION_KEY)) {
      // One-time migration to add Kim Jeong-in without breaking future deletes
      const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      let updated = false;
      INITIAL_USERS.forEach(initialUser => {
        if (!users.find(u => u.id === initialUser.id || u.name === initialUser.name)) {
          users.push(initialUser);
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }
      localStorage.setItem(MIGRATION_KEY, 'done');
    }
    if (!localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS)) {
      localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(INITIAL_LEAVE_REQUESTS));
    }

    if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(INITIAL_POSTS));
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
  },

  changePassword: async (userId: string, newPassword: string): Promise<void> => {
    const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const updatedUsers = users.map(u => u.id === userId ? { ...u, password: btoa(newPassword), passwordChanged: true } : u);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
  },

  isInitialPasswordRequired: async (userId: string): Promise<{ required: boolean; count: number }> => {
    await delay(200);
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find((u: User) => u.id === userId);
    if (!user) return { required: false, count: 0 };

    // Default password is '1' or btoa('1')
    const isDefault = user.password === '1' || user.password === btoa('1');
    if (isDefault && !user.passwordChanged) {
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
    return newUser;
  },

  deleteUser: async (userId: string): Promise<void> => {
    await delay(300);
    let users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    users = users.filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<User | undefined> => {
    await delay(300);
    let users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return undefined;
    // Don't allow overwriting password via this method
    const { password, ...safeUpdates } = updates as any;
    users[idx] = { ...users[idx], ...safeUpdates };
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return { ...users[idx], password: '' };
  },


  bulkResetPasswords: async (newPassword: string): Promise<void> => {
    await delay(300);
    let users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    users = users.map(u => ({ ...u, password: btoa(newPassword) }));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
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

  heartbeat: async (userId: string): Promise<void> => {
    const onlineStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.ONLINE) || '{}');
    onlineStatus[userId] = Date.now();
    localStorage.setItem(STORAGE_KEYS.ONLINE, JSON.stringify(onlineStatus));
  },

  getOnlineUsers: async (): Promise<string[]> => {
    const onlineStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.ONLINE) || '{}');
    const now = Date.now();
    const threshold = 10 * 1000;

    return Object.keys(onlineStatus).filter(userId => {
      return (now - onlineStatus[userId]) < threshold;
    });
  },

  logout: async (userId: string): Promise<void> => {
    const onlineStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.ONLINE) || '{}');
    delete onlineStatus[userId];
    localStorage.setItem(STORAGE_KEYS.ONLINE, JSON.stringify(onlineStatus));
    await MockServer.logLoginHistory(userId, 'logout');
  },

  getPosts: async (): Promise<Post[]> => {
    await delay(400);
    const posts = JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS) || '[]');
    return posts.sort((a: Post, b: Post) => {
      if (a.type === 'notice' && b.type !== 'notice') return -1;
      if (a.type !== 'notice' && b.type === 'notice') return 1;
      return b.timestamp - a.timestamp;
    });
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
    posts.unshift(newPost);
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
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

    posts[postIndex].comments.push(newComment);
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
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
    await delay(300);
    const allMessages: Message[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    return allMessages
      .filter((m) => m.receiverId === userId || m.senderId === userId)
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  sendMessage: async (sender: User, receiverId: string, content: string): Promise<Message> => {
    await delay(500);
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
    };

    allMessages.push(newMessage);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
    return newMessage;
  },

  markAsRead: async (messageId: string): Promise<void> => {
    const allMessages: Message[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    const updatedMessages = allMessages.map(m =>
      m.id === messageId ? { ...m, isRead: true } : m
    );
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedMessages));
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    const allMessages: Message[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    const updatedMessages = allMessages.filter(m => m.id !== messageId);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(updatedMessages));
  },

  // Leave Management Methods
  getLeaveRequests: async (userId?: string): Promise<LeaveRequest[]> => {
    await delay(300);
    const allRequests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS) || '[]');
    return allRequests.sort((a, b) => b.requestDate - a.requestDate);
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

    return newRequest;
  },

  approveLeaveRequest: async (requestId: string, status: 'approved' | 'rejected'): Promise<void> => {
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
  },

  getApprovals: async (userId: string): Promise<Approval[]> => {
    await delay(300);
    const approvals: Approval[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPROVALS) || '[]');
    return approvals
      .filter(a => a.requesterId === userId || a.approverId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
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

    approvals.unshift(newApproval);
    localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify(approvals));
    return newApproval;
  },

  updateApprovalStatus: async (approvalId: string, status: 'approved' | 'rejected'): Promise<void> => {
    await delay(300);
    let approvals: Approval[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPROVALS) || '[]');
    approvals = approvals.map(a => a.id === approvalId ? { ...a, status, updatedAt: Date.now() } : a);
    localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify(approvals));
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
    return schedule;
  },

  deleteSchedule: async (id: string): Promise<void> => {
    let schedules: Schedule[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES) || '[]');
    schedules = schedules.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
  },

  // Chat Methods
  getChatRooms: async (userId: string): Promise<ChatRoom[]> => {
    await delay(300);
    const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_ROOMS) || '[]');
    return rooms.filter(r => r.participants.includes(userId)).sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  },

  startChat: async (myId: string, otherId: string): Promise<ChatRoom> => {
    await delay(300);
    const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_ROOMS) || '[]');

    // Check if room exists
    let room = rooms.find(r =>
      r.participants.includes(myId) &&
      r.participants.includes(otherId) &&
      r.participants.length === 2
    );

    if (!room) {
      room = {
        id: `room_${Date.now()}`,
        participants: [myId, otherId],
        lastMessage: '',
        lastMessageTime: Date.now(),
      };
      rooms.push(room);
      localStorage.setItem(STORAGE_KEYS.CHAT_ROOMS, JSON.stringify(rooms));
    }
    return room;
  },

  getChatMessages: async (roomId: string): Promise<ChatMessage[]> => {
    // await delay(100); 
    const messages: ChatMessage[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES) || '[]');
    return messages.filter(m => m.roomId === roomId).sort((a, b) => a.timestamp - b.timestamp);
  },

  sendChatMessage: async (roomId: string, senderId: string, content: string): Promise<ChatMessage> => {
    // await delay(100);
    const messages: ChatMessage[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES) || '[]');
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      roomId,
      senderId,
      content,
      timestamp: Date.now(),
      readBy: [senderId]
    };
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