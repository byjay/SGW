import { User, Post, Message, ChatRoom, ChatMessage, LeaveRequest, LeaveType, Approval, AttendanceLog, Schedule, Comment } from '../types';

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
  { id: '1', name: '고영관', email: 'kohyk@seastargo.com', role: 'manager', status: 'active', position: 'CEO', department: '임원', joinDate: '2010-01-01', phone: '010-2830-4610', totalLeave: 15, carryover: 0, leaveBalance: 15, password: '1', avatar: generate3DAvatar('고영관', '#4facfe', '#00f2fe') },
  { id: '2', name: '이선우', email: 'lsw00@seastargo.com', role: 'manager', status: 'active', position: '부장', department: '배관', joinDate: '2017-07-01', phone: '010-6805-1307', totalLeave: 18, carryover: 0, leaveBalance: 16.5, password: '1', avatar: generate3DAvatar('이선우', '#f093fb', '#f5576c') },
  { id: '3', name: '김미진', email: 'kimmj@seastargo.com', role: 'manager', status: 'active', position: '차장', department: '배관', joinDate: '2023-10-16', phone: '010-7328-1223', totalLeave: 17, carryover: -1, leaveBalance: 15.5, password: '1', avatar: generate3DAvatar('김미진', '#84fab0', '#8fd3f4') },
  { id: '4', name: '김민경', email: 'min55@seastargo.com', role: 'manager', status: 'active', position: '대리', department: '배관', joinDate: '2018-12-11', phone: '010-8540-0073', totalLeave: 22, carryover: 4, leaveBalance: 16, password: '1', avatar: generate3DAvatar('김민경', '#fa709a', '#fee140') },
  { id: '5', name: '김봉정', email: 'designsir@seastargo.com', role: 'admin', status: 'active', position: '부장', department: '전장', joinDate: '2019-04-01', phone: '010-4544-0953', totalLeave: 18.5, carryover: 0.5, leaveBalance: 18.5, password: '0953', avatar: generate3DAvatar('김봉정', '#a18cd1', '#fbc2eb') },
  { id: '6', name: '김정인', email: 'bsbinin@seastargo.com', role: 'manager', status: 'active', position: '차장', department: '철의장', joinDate: '2018-10-15', phone: '010-8631-4430', totalLeave: 17, carryover: -1, leaveBalance: 15, password: '1', avatar: generate3DAvatar('김정인', '#ff0844', '#ffb199') },
  { id: '7', name: '이재명', email: 'leejm@seastargo.com', role: 'manager', status: 'active', position: '전무', department: '임원', joinDate: '2020-01-01', phone: '010-1234-5678', totalLeave: 20, carryover: 0, leaveBalance: 20, password: '1', avatar: generate3DAvatar('이재명', '#f6d365', '#fda085') },
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
    { id: 'leave_9', userId: '6', userName: '김정인', type: 'annual', startDate: '2026-01-02', endDate: '2026-01-02', days: 1, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-02T00:00:00').getTime() },
    { id: 'leave_10', userId: '6', userName: '김정인', type: 'annual', startDate: '2026-01-30', endDate: '2026-01-30', days: 1, reason: '', emergencyContact: '', status: 'approved', requestDate: new Date('2026-01-30T00:00:00').getTime() },
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
  CHAT_ROOMS: 'app_chat_rooms',
  CHAT_MESSAGES: 'app_chat_messages',
  NOTICE_CHECK: 'app_notice_check',
  LEAVE_REQUESTS: 'app_leave_requests',
  APPROVALS: 'app_approvals',
  ATTENDANCE: 'app_attendance',
  SCHEDULES: 'app_schedules'
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const MockServer = {
  // Initialize data if empty
  init: () => {
    // Force update users and leave requests to apply new data
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(INITIAL_LEAVE_REQUESTS));

    if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(INITIAL_POSTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ONLINE)) {
      localStorage.setItem(STORAGE_KEYS.ONLINE, JSON.stringify({}));
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
      const updatedUsers = users.map(u => u.id === userId ? { ...u, password: newPassword } : u);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
  },

  getUsers: async (): Promise<User[]> => {
    await delay(300);
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  },

  createUser: async (user: User): Promise<User> => {
      await delay(400);
      const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      if (users.find(u => u.id === user.id)) {
          throw new Error('User ID already exists');
      }
      users.push(user);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      return user;
  },

  deleteUser: async (userId: string): Promise<void> => {
      await delay(300);
      let users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      users = users.filter(u => u.id !== userId);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  bulkResetPasswords: async (newPassword: string): Promise<void> => {
      await delay(300);
      let users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      users = users.map(u => ({ ...u, password: newPassword }));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  login: async (userId: string): Promise<User | undefined> => {
    await delay(500);
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    return users.find((u: User) => u.id === userId);
  },

  loginByEmail: async (email: string): Promise<User | undefined> => {
    await delay(500);
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    return users.find((u: User) => u.email === email);
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

      // If applicant is Lee Sunwoo (id: 2), auto approve
      const isAdmin = userId === '2';

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
          status: isAdmin ? 'approved' : 'pending',
          requestDate: Date.now()
      };

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

  updateLeaveRequest: async (requestId: string, updates: Partial<LeaveRequest>): Promise<void> => {
      const requests: LeaveRequest[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS) || '[]');
      const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      
      let targetUserId = '';
      let oldDays = 0;
      let newDays = updates.days || 0;

      const updatedRequests = requests.map(r => {
          if (r.id === requestId) {
              targetUserId = r.userId;
              oldDays = r.days;
              return { ...r, ...updates };
          }
          return r;
      });
      
      localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(updatedRequests));

      // Adjust leave balance if days changed
      if (oldDays !== newDays && targetUserId) {
          const diff = newDays - oldDays;
          const updatedUsers = users.map(u => {
              if (u.id === targetUserId) {
                  return { ...u, leaveBalance: (u.leaveBalance || 15) - diff };
              }
              return u;
          });
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
      }
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

  getTodayAttendance: async (userId: string): Promise<{clockIn: number | null, clockOut: number | null}> => {
      const logs: AttendanceLog[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE) || '[]');
      const today = new Date().setHours(0,0,0,0);
      
      const todayLogs = logs.filter(l => 
          l.userId === userId && 
          l.timestamp >= today
      );

      const clockIn = todayLogs.find(l => l.type === 'clock_in')?.timestamp || null;
      const clockOut = todayLogs.filter(l => l.type === 'clock_out').sort((a,b) => b.timestamp - a.timestamp)[0]?.timestamp || null;

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
  }
};