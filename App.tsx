import React, { useState, useEffect } from 'react';

import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { Board } from './components/Board';
import { Messaging } from './components/Messaging';
import { LeaveManagement } from './components/LeaveManagement';
import { AdminUsers } from './components/AdminUsers';
import { ApprovalSystem } from './components/ApprovalSystem';
import { CalendarView } from './components/CalendarView';
import { Home } from './components/Home';
import { MailView } from './components/MailView';
import { User, ViewState, Post } from './types';
import { MockServer } from './services/mockServer';
import { Megaphone, X, MessageSquare, Calendar as CalendarIcon } from 'lucide-react';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  
  // Notice State
  const [newNotice, setNewNotice] = useState<Post | null>(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [postToOpen, setPostToOpen] = useState<string | null>(null);

  // Leave Notification State
  const [newLeaveRequest, setNewLeaveRequest] = useState<any | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Message Notification State
  const [newMessage, setNewMessage] = useState<any | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  // Approval Notification State
  const [newApproval, setNewApproval] = useState<any | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  useEffect(() => {
    // Initialize mock data
    MockServer.init();

    // Try to restore session from simple storage (optional, for refresh)
    const storedUserId = localStorage.getItem('current_user_id');
    if (storedUserId) {
      MockServer.login(storedUserId).then(user => {
        if (user) setCurrentUser(user);
      });
    }
  }, []);

  // Application Loop: Unread messages, Heartbeat, Online Users, Notices
  useEffect(() => {
    if (!currentUser) return;

    const tick = async () => {
      // 1. Check unread messages
      const messages = await MockServer.getMessages(currentUser.id);
      const unread = messages.filter(m => m.receiverId === currentUser.id && !m.isRead).length;
      setUnreadCount(unread);

      // 2. Send Heartbeat
      await MockServer.heartbeat(currentUser.id);

      // 3. Fetch online users
      const onlineIds = await MockServer.getOnlineUsers();
      const allUsers = await MockServer.getUsers();
      // Filter out self and map to User objects
      const onlineUserList = allUsers.filter(u => onlineIds.includes(u.id) && u.id !== currentUser.id);
      setOnlineUsers(onlineUserList);

      // 4. Check for new notices
      if (!showNoticeModal) { // Don't check if modal is already open
          const notices = await MockServer.getNewNotices(currentUser.id);
          if (notices.length > 0) {
              setNewNotice(notices[0]); // Show most recent one
              setShowNoticeModal(true);
          }
      }

      // 5. Check for new leave requests (for admins/managers)
      if (['1', '2', '5'].includes(currentUser.id) && !showLeaveModal) {
          const leaveRequests = await MockServer.getLeaveRequests();
          const pendingRequests = leaveRequests.filter(r => r.status === 'pending');
          
          if (pendingRequests.length > 0) {
              const lastSeenTime = parseInt(localStorage.getItem(`last_seen_leave_${currentUser.id}`) || '0');
              const newestRequest = pendingRequests[0]; // Assuming sorted by newest first
              
              if (newestRequest.requestDate > lastSeenTime) {
                  setNewLeaveRequest(newestRequest);
                  setShowLeaveModal(true);
              }
          }
      }

      // 6. Check for new messages
      if (!showMessageModal) {
          const myMessages = await MockServer.getMessages(currentUser.id);
          const unreadMessages = myMessages.filter(m => m.receiverId === currentUser.id && !m.isRead);
          if (unreadMessages.length > 0) {
              const lastSeenMsgTime = parseInt(localStorage.getItem(`last_seen_msg_${currentUser.id}`) || '0');
              const newestMsg = unreadMessages[0]; // Assuming sorted by newest first
              
              if (newestMsg.timestamp > lastSeenMsgTime) {
                  setNewMessage(newestMsg);
                  setShowMessageModal(true);
              }
          }
      }

      // 7. Check for new approvals
      if (!showApprovalModal) {
          const myApprovals = await MockServer.getApprovals(currentUser.id);
          const pendingApprovals = myApprovals.filter(a => a.approverId === currentUser.id && a.status === 'pending');
          if (pendingApprovals.length > 0) {
              const lastSeenApprovalTime = parseInt(localStorage.getItem(`last_seen_approval_${currentUser.id}`) || '0');
              const newestApproval = pendingApprovals[0];
              
              if (newestApproval.createdAt > lastSeenApprovalTime) {
                  setNewApproval(newestApproval);
                  setShowApprovalModal(true);
              }
          }
      }
    };

    // Run immediately
    tick();

    // Run interval
    const interval = setInterval(tick, 3000); // 3 second loop for responsiveness
    return () => clearInterval(interval);
  }, [currentUser, showNoticeModal, showLeaveModal, showMessageModal, showApprovalModal]);

  const handleLogin = async (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('current_user_id', user.id);
    await MockServer.heartbeat(user.id); // Immediate heartbeat
    setCurrentView('home');
  };

  const handleLogout = async () => {
    if (currentUser) {
        await MockServer.logout(currentUser.id);
    }
    setCurrentUser(null);
    localStorage.removeItem('current_user_id');
    setCurrentView('login');
  };

  const handleConfirmNotice = async () => {
      if (currentUser && newNotice) {
          await MockServer.markNoticeAsRead(currentUser.id);
          setShowNoticeModal(false);
          setPostToOpen(newNotice.id); // Tell Board to open this post
          setCurrentView('board'); // Navigate to board
      }
  };

  const handleCloseNotice = async () => {
      if (currentUser) {
        await MockServer.markNoticeAsRead(currentUser.id); // Mark read even if closed, to avoid spam
      }
      setShowNoticeModal(false);
  };

  const handleCloseLeaveNotification = () => {
      if (currentUser && newLeaveRequest) {
          localStorage.setItem(`last_seen_leave_${currentUser.id}`, newLeaveRequest.requestDate.toString());
      }
      setShowLeaveModal(false);
  };

  const handleGoToLeave = () => {
      handleCloseLeaveNotification();
      setCurrentView('leave');
  };

  const handleCloseMessageNotification = () => {
      if (currentUser && newMessage) {
          localStorage.setItem(`last_seen_msg_${currentUser.id}`, newMessage.timestamp.toString());
      }
      setShowMessageModal(false);
  };

  const handleGoToMessages = () => {
      handleCloseMessageNotification();
      setCurrentView('messages');
  };

  const handleCloseApprovalNotification = () => {
      if (currentUser && newApproval) {
          localStorage.setItem(`last_seen_approval_${currentUser.id}`, newApproval.createdAt.toString());
      }
      setShowApprovalModal(false);
  };

  const handleGoToApprovals = () => {
      handleCloseApprovalNotification();
      setCurrentView('approvals');
  };

  return (
    
      <>
        <Layout
        currentUser={currentUser}
        currentView={currentView}
        onNavigate={(view) => {
            setCurrentView(view);
            setPostToOpen(null); // Reset auto-open when manually navigating
        }}
        onLogout={handleLogout}
        unreadCount={unreadCount}
        onlineUsers={onlineUsers}
        >
        {!currentUser ? (
            <Login onLogin={handleLogin} />
        ) : (
            <>
            {currentView === 'home' && <Home currentUser={currentUser} onNavigate={setCurrentView} unreadCount={unreadCount} />}
            {currentView === 'board' && <Board currentUser={currentUser} postIdToOpen={postToOpen} />}
            {currentView === 'messages' && <Messaging currentUser={currentUser} />}
            {currentView === 'leave' && <LeaveManagement currentUser={currentUser} />}
            {currentView === 'admin' && <AdminUsers currentUser={currentUser} />}
            {currentView === 'approval' && <ApprovalSystem currentUser={currentUser} />}
            {currentView === 'calendar' && <CalendarView currentUser={currentUser} />}
            {currentView === 'mail' && <MailView />}
            </>
        )}
        </Layout>

        {/* Notice Popup Modal */}
        {showNoticeModal && newNotice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseNotice}></div>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden transform transition-all scale-100">
                    <div className="bg-red-500 p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                            <Megaphone size={120} />
                        </div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center space-x-2 bg-red-600/50 rounded-full px-3 py-1 mb-3 text-xs font-bold border border-red-400">
                                <Megaphone size={12} />
                                <span>새로운 공지사항</span>
                            </div>
                            <h3 className="text-xl font-bold leading-tight">{newNotice.title}</h3>
                            <p className="text-red-100 text-sm mt-2 flex items-center">
                                작성자: {newNotice.authorName}
                            </p>
                        </div>
                    </div>
                    <div className="p-6">
                        <p className="text-slate-600 mb-6 line-clamp-3 leading-relaxed">
                            {newNotice.content}
                        </p>
                        <div className="flex space-x-3">
                            <button 
                                onClick={handleCloseNotice}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-colors"
                            >
                                닫기
                            </button>
                            <button 
                                onClick={handleConfirmNotice}
                                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                            >
                                확인하러 가기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {/* Leave Notification Modal */}
        {showLeaveModal && newLeaveRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseLeaveNotification}></div>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden transform transition-all scale-100">
                    <div className="bg-blue-600 p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                            <CalendarIcon size={120} />
                        </div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center space-x-2 bg-blue-700/50 rounded-full px-3 py-1 mb-3 text-xs font-bold border border-blue-500">
                                <CalendarIcon size={12} />
                                <span>새로운 연차 신청</span>
                            </div>
                            <h3 className="text-xl font-bold mb-1">{newLeaveRequest.userName}님의 연차 신청</h3>
                            <p className="text-blue-100 text-sm">결재 대기 중인 새로운 연차 신청이 있습니다.</p>
                        </div>
                    </div>
                    <div className="p-6 bg-white">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                            <p className="text-sm text-slate-600 mb-1">신청 기간</p>
                            <p className="font-bold text-slate-800">{newLeaveRequest.startDate} ~ {newLeaveRequest.endDate} ({newLeaveRequest.days}일)</p>
                        </div>
                        <div className="flex space-x-3">
                            <button 
                                onClick={handleCloseLeaveNotification}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors"
                            >
                                닫기
                            </button>
                            <button 
                                onClick={handleGoToLeave}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all"
                            >
                                결재하러 가기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Message Notification Modal */}
        {showMessageModal && newMessage && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseMessageNotification}></div>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden transform transition-all scale-100">
                    <div className="bg-emerald-500 p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                            <MessageSquare size={120} />
                        </div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center space-x-2 bg-emerald-600/50 rounded-full px-3 py-1 mb-3 text-xs font-bold border-emerald-400">
                                <MessageSquare size={12} />
                                <span>새로운 쪽지</span>
                            </div>
                            <h3 className="text-xl font-bold mb-1">{newMessage.senderName}님의 쪽지</h3>
                            <p className="text-emerald-100 text-sm">새로운 쪽지가 도착했습니다.</p>
                        </div>
                    </div>
                    <div className="p-6 bg-white">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                            <p className="text-sm text-slate-600 mb-1 line-clamp-2">{newMessage.content}</p>
                        </div>
                        <div className="flex space-x-3">
                            <button 
                                onClick={handleCloseMessageNotification}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors"
                            >
                                닫기
                            </button>
                            <button 
                                onClick={handleGoToMessages}
                                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all"
                            >
                                쪽지 확인하기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Approval Notification Modal */}
        {showApprovalModal && newApproval && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseApprovalNotification}></div>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden transform transition-all scale-100">
                    <div className="bg-blue-600 p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                            <MessageSquare size={120} />
                        </div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center space-x-2 bg-blue-700/50 rounded-full px-3 py-1 mb-3 text-xs font-bold border-blue-500">
                                <MessageSquare size={12} />
                                <span>새로운 결재</span>
                            </div>
                            <h3 className="text-xl font-bold mb-1">{newApproval.requesterName}님의 결재</h3>
                            <p className="text-blue-100 text-sm">새로운 결재 요청이 도착했습니다.</p>
                        </div>
                    </div>
                    <div className="p-6 bg-white">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                            <p className="font-bold text-slate-800 mb-1">{newApproval.title}</p>
                        </div>
                        <div className="flex space-x-3">
                            <button 
                                onClick={handleCloseApprovalNotification}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors"
                            >
                                닫기
                            </button>
                            <button 
                                onClick={handleGoToApprovals}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all"
                            >
                                결재함 가기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </>
    
  );
}

export default App;
