export interface User {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  role: 'admin' | 'user' | 'manager' | 'engineer' | 'viewer' | 'guest'; // Expanded roles based on data
  projectScope?: string;
  status?: 'active' | 'pending' | 'suspended';
  phone?: string;
  position?: string;
  department?: string;
  joinDate?: string;
  totalLeave?: number;
  carryover?: number;
  leaveBalance?: number;
  password?: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  timestamp: number;
  likes: number;
  type: 'notice' | 'normal';
  comments: Comment[];
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  timestamp: number;
  isRead: boolean;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: number;
  lastMessageSenderId?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  timestamp: number;
  readBy: string[];
}

export type LeaveType = 'annual' | 'morning_half' | 'afternoon_half' | 'sick' | 'event' | 'family';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  emergencyContact: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: number;
}

export interface Approval {
  id: string;
  requesterId: string;
  requesterName: string;
  approverId: string;
  approverName: string;
  title: string;
  content: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  createdAt: number;
  updatedAt: number;
  attachment?: string; // Added attachment field
}

export interface AttendanceLog {
  id: string;
  userId: string;
  type: 'clock_in' | 'clock_out';
  timestamp: number;
  location: string;
}

export interface Schedule {
  id: string;
  userId: string;
  userName: string;
  title: string;
  type: 'personal' | 'company' | 'leave'; // leave is auto-generated
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isAllDay: boolean;
  color?: string;
}

export type ViewState = 'login' | 'home' | 'board' | 'messages' | 'chat' | 'leave' | 'approval' | 'admin' | 'calendar' | 'mail';