import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { Board } from './components/Board';
import { Messaging } from './components/Messaging';
import { LeaveManagement } from './components/LeaveManagement';
import { AdminUsers } from './components/AdminUsers';
import { ApprovalSystem } from './components/ApprovalSystem';
import { CalendarView } from './components/CalendarView';
import { Home } from './components/Home';
import { Chat } from './components/Chat';
import { LoginPopup } from './components/LoginPopup';
import { InitialPasswordModal } from './components/InitialPasswordModal';
import { User, ViewState, Post } from './types';
import { MockServer } from './services/mockServer';
import { Megaphone, X, MessageSquare, Calendar as CalendarIcon } from 'lucide-react';

function App() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    // ★ 세션 복원 중 로그인 화면이 잠깐 번쩍이는 문제 방지 — current_user_id가 있으면
    //   복원 완료 전까지 스플래시만 보여주고 Login 폼은 렌더하지 않는다.
    const [isRestoring, setIsRestoring] = useState<boolean>(() => !!localStorage.getItem('current_user_id'));
    const [currentView, setCurrentView] = useState<ViewState>('home');
    const [unreadCount, setUnreadCount] = useState(0);
    const [onlineUsers, setOnlineUsers] = useState<User[]>([]);

    // Initial Password Check
    const [initialPwdCheck, setInitialPwdCheck] = useState<{ required: boolean; count: number } | null>(null);

    // ★ 확장앱 메뉴 클릭마다 그룹웨어를 새 탭으로 열던 시절, 탭마다 App이 새로
    //   마운트되며 이 알림이 매번 다시 떴다(귀찮음 신고됨). 탭 재사용으로도 고쳤지만,
    //   그래도 남을 수 있는 새로고침/새탭 경로를 대비해 "이 브라우저에서 한 번 봤으면
    //   다시 안 띄움" 가드를 추가— 비밀번호를 실제로 바꾸기 전까진 원치 않아도 되는
    //   반복 팝업만 막는다(변경 완료 시 isInitialPasswordRequired 자체가 false가 됨).
    const shouldShowPwdNag = (userId: string) => {
        const key = `swgs_pwd_nag_seen_${userId}`;
        if (localStorage.getItem(key)) return false;
        localStorage.setItem(key, '1');
        return true;
    };

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

    // Chat Notification State
    const [newChat, setNewChat] = useState<any | null>(null);
    const [showChatModal, setShowChatModal] = useState(false);

    // Approval Notification State
    const [newApproval, setNewApproval] = useState<any | null>(null);
    const [showApprovalModal, setShowApprovalModal] = useState(false);

    // Native Notification Permission
    const requestNotificationPermission = useCallback(async () => {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }, []);

    const sendNativeNotification = useCallback((title: string, body: string, url: string = '/') => {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        try {
            const options = {
                body: body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: 'sgw-notification',
                renotify: true
            };
            const n = new Notification(title, options);
            n.onclick = () => {
                window.focus();
                n.close();
            };
        } catch (e) {
            console.error('Native notification error:', e);
        }
    }, []);

    // ★ 확장앱(page-bridge.js)이 알림을 가로채려면 window 전역에 노출돼야 한다.
    //   이게 없으면 공지/연차/쪽지/결재 강력 알림(OS 팝업)이 절대 발동하지 않는다 — 실사용 버그였음.
    useEffect(() => {
        (window as any).sendNativeNotification = sendNativeNotification;
        return () => { delete (window as any).sendNativeNotification; };
    }, [sendNativeNotification]);

    // 확장앱 deep-link: URL 경로(/board) 또는 ?view=board → 초기 뷰
    const getDeepLinkView = (): ViewState | null => {
        try {
            const valid: ViewState[] = ['home', 'board', 'messages', 'chat', 'leave', 'approval', 'admin', 'calendar', 'mail'];
            const params = new URLSearchParams(window.location.search);
            const q = (params.get('view') || '').toLowerCase();
            const seg = (window.location.pathname.replace(/^\/+/, '').split('/')[0] || '').toLowerCase();
            const want = (valid as string[]).includes(q) ? q : ((valid as string[]).includes(seg) ? seg : '');
            return want ? (want as ViewState) : null;
        } catch { return null; }
    };

    // ★ 구글 계정 연동 콜백 결과 처리 (?linked=1&g=... / ?linked=0&err=...)
    //   콜백이 앱 루트로 리다이렉트하며 붙인 쿼리를 읽어 알림 후 URL 정리.
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const linked = params.get('linked');
            if (linked === '1') {
                const g = params.get('g') || '';
                alert(`구글 계정(${g})이 연동되었습니다.`);
            } else if (linked === '0') {
                const err = params.get('err') || 'unknown';
                alert(`구글 계정 연동에 실패했습니다. (${err})`);
            }
            if (linked !== null) {
                params.delete('linked');
                params.delete('g');
                params.delete('err');
                const qs = params.toString();
                window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
            }
        } catch { /* 쿼리 파싱 실패 무시 */ }
    }, []);

    useEffect(() => {
        // Initialize mock data
        MockServer.init();

        // 확장앱 메뉴 deep-link → 초기 뷰 반영
        const dl = getDeepLinkView();
        if (dl) setCurrentView(dl);

        // Try to restore session from simple storage (optional, for refresh)
        const storedUserId = localStorage.getItem('current_user_id');
        if (storedUserId) {
            MockServer.login(storedUserId).then(async (user) => {
                if (user) {
                    setCurrentUser(user);
                    // Also check for mandatory password change on refresh/restore
                    const check = await MockServer.isInitialPasswordRequired(user.id);
                    if (check.required && shouldShowPwdNag(user.id)) {
                        setInitialPwdCheck(check);
                    }
                }
            }).finally(() => setIsRestoring(false));
        } else {
            setIsRestoring(false);
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
                    sendNativeNotification('📢 새로운 공지사항', notices[0].title);
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
                        sendNativeNotification('📅 새로운 연차 신청', `${newestRequest.userName}님의 연차 신청이 있습니다.`);
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
                        sendNativeNotification(`💬 ${newestMsg.senderName}님의 쪽지`, newestMsg.content);
                    }
                }
            }

            // 6-1. Check for new chat messages
            if (!showChatModal) {
                const rooms = await MockServer.getChatRooms(currentUser.id);
                const lastSeenChatTime = parseInt(localStorage.getItem(`last_seen_chat_${currentUser.id}`) || '0');
                let candidate: { roomId: string; senderId: string; content: string; timestamp: number } | null = null;
                for (const room of rooms) {
                    const msgs = await MockServer.getChatMessages(room.id);
                    for (const m of msgs) {
                        if (m.senderId !== currentUser.id && m.timestamp > lastSeenChatTime) {
                            if (!candidate || m.timestamp > candidate.timestamp) {
                                candidate = { roomId: room.id, senderId: m.senderId, content: m.content, timestamp: m.timestamp };
                            }
                        }
                    }
                }
                if (candidate) {
                    const allUsersForChat = await MockServer.getUsers();
                    const sender = allUsersForChat.find(u => u.id === candidate!.senderId);
                    const senderName = sender ? sender.name : '알 수 없음';
                    setNewChat({ ...candidate, senderName });
                    setShowChatModal(true);
                    sendNativeNotification(`💬 ${senderName} 채팅`, candidate.content);
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
                        sendNativeNotification('📑 새로운 결재 요청', newestApproval.title);
                    }
                }
            }
        };

        // Run immediately
        tick();

        // Run interval
        const interval = setInterval(tick, 3000); // 3 second loop for responsiveness
        return () => clearInterval(interval);
    }, [currentUser, showNoticeModal, showLeaveModal, showMessageModal, showChatModal, showApprovalModal]);

    const handleLogin = async (user: User) => {
        setCurrentUser(user);
        localStorage.setItem('current_user_id', user.id);
        await MockServer.heartbeat(user.id); // Immediate heartbeat
        requestNotificationPermission(); // Request permission on login
        setCurrentView(getDeepLinkView() || 'home'); // 확장앱 deep-link 존중

        // ★ 로그인 직후: 미읽음 쪽지/채팅을 "가장 먼저" 팝업 노출 (마스터 요구)
        //   쪽지 우선(z-[110]로 초기비번 모달보다 위), 없으면 채팅 팝업.
        let popupShown = false;
        try {
            const myMessages = await MockServer.getMessages(user.id);
            const unreadMessages = myMessages.filter(m => m.receiverId === user.id && !m.isRead);
            if (unreadMessages.length > 0) {
                const newestMsg = unreadMessages[0];
                setNewMessage(newestMsg);
                setShowMessageModal(true);
                sendNativeNotification(`💬 ${newestMsg.senderName}님의 쪽지`, newestMsg.content);
                popupShown = true;
            }
        } catch { /* 쪽지 조회 실패는 무시 */ }

        if (!popupShown) {
            try {
                const rooms = await MockServer.getChatRooms(user.id);
                let candidate: { roomId: string; senderId: string; content: string; timestamp: number } | null = null;
                const lastSeenChatTime = parseInt(localStorage.getItem(`last_seen_chat_${user.id}`) || '0');
                for (const room of rooms) {
                    const msgs = await MockServer.getChatMessages(room.id);
                    for (const m of msgs) {
                        if (m.senderId !== user.id && m.timestamp > lastSeenChatTime) {
                            if (!candidate || m.timestamp > candidate.timestamp) {
                                candidate = { roomId: room.id, senderId: m.senderId, content: m.content, timestamp: m.timestamp };
                            }
                        }
                    }
                }
                if (candidate) {
                    const allUsersForChat = await MockServer.getUsers();
                    const sender = allUsersForChat.find(u => u.id === candidate!.senderId);
                    const senderName = sender ? sender.name : '알 수 없음';
                    setNewChat({ ...candidate, senderName });
                    setShowChatModal(true);
                    sendNativeNotification(`💬 ${senderName} 채팅`, candidate.content);
                }
            } catch { /* 채팅 조회 실패는 무시 */ }
        }

        // 초기비번 모달은 쪽지/채팅 팝업 뒤에 배치 (쪽지 모달이 z-[110]로 위에 노출됨)
        const check = await MockServer.isInitialPasswordRequired(user.id);
        if (check.required && shouldShowPwdNag(user.id)) {
            setInitialPwdCheck(check);
        }
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

    const handleCloseLeaveNotification = useCallback(() => {
        if (currentUser && newLeaveRequest) {
            localStorage.setItem(`last_seen_leave_${currentUser.id}`, newLeaveRequest.requestDate.toString());
        }
        setShowLeaveModal(false);
    }, [currentUser, newLeaveRequest]);

    const handleGoToLeave = useCallback(() => {
        handleCloseLeaveNotification();
        setCurrentView('leave');
    }, [handleCloseLeaveNotification]);

    const handleCloseMessageNotification = useCallback(() => {
        if (currentUser && newMessage) {
            localStorage.setItem(`last_seen_msg_${currentUser.id}`, newMessage.timestamp.toString());
        }
        setShowMessageModal(false);
    }, [currentUser, newMessage]);

    const handleGoToMessages = useCallback(() => {
        handleCloseMessageNotification();
        setCurrentView('messages');
    }, [handleCloseMessageNotification]);

    const handleCloseChatNotification = useCallback(() => {
        if (currentUser && newChat) {
            localStorage.setItem(`last_seen_chat_${currentUser.id}`, newChat.timestamp.toString());
        }
        setShowChatModal(false);
    }, [currentUser, newChat]);

    const handleGoToChat = useCallback(() => {
        handleCloseChatNotification();
        setCurrentView('chat');
    }, [handleCloseChatNotification]);

    const handleCloseApprovalNotification = useCallback(() => {
        if (currentUser && newApproval) {
            localStorage.setItem(`last_seen_approval_${currentUser.id}`, newApproval.createdAt.toString());
        }
        setShowApprovalModal(false);
    }, [currentUser, newApproval]);

    const handleGoToApprovals = useCallback(() => {
        handleCloseApprovalNotification();
        setCurrentView('approval');
    }, [handleCloseApprovalNotification]);

    // ★ 세션 복원 중 — 로그인 폼 대신 스플래시(다크/그린 브랜드)만 표시, 화면 번쩍임 방지
    if (isRestoring) {
        return (
            <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0e0e' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #2b2b2b', borderTopColor: '#3ecf8e', animation: 'sgw-spin .8s linear infinite' }} />
                <style>{`@keyframes sgw-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

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
                        {currentView === 'chat' && <Chat currentUser={currentUser} onlineUsers={onlineUsers} />}
                        {currentView === 'leave' && <LeaveManagement currentUser={currentUser} />}
                        {currentView === 'admin' && <AdminUsers currentUser={currentUser} />}
                        {currentView === 'approval' && <ApprovalSystem currentUser={currentUser} />}
                        {currentView === 'calendar' && <CalendarView currentUser={currentUser} />}
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
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
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

            {/* Chat Notification Modal */}
            {showChatModal && newChat && (
                <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseChatNotification}></div>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden transform transition-all scale-100">
                        <div className="bg-indigo-600 p-6 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                                <MessageSquare size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="inline-flex items-center space-x-2 bg-indigo-700/50 rounded-full px-3 py-1 mb-3 text-xs font-bold border border-indigo-400">
                                    <MessageSquare size={12} />
                                    <span>새 채팅 메시지</span>
                                </div>
                                <h3 className="text-xl font-bold mb-1">{newChat.senderName}님의 채팅</h3>
                                <p className="text-indigo-100 text-sm">새로운 채팅 메시지가 도착했습니다.</p>
                            </div>
                        </div>
                        <div className="p-6 bg-white">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                                <p className="text-sm text-slate-600 mb-1 line-clamp-2">{newChat.content}</p>
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    onClick={handleCloseChatNotification}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors"
                                >
                                    닫기
                                </button>
                                <button
                                    onClick={handleGoToChat}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all"
                                >
                                    채팅 확인하기
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

            {/* Initial Password Change Modal */}
            {initialPwdCheck && currentUser && (
                <InitialPasswordModal
                    isOpen={true}
                    userId={currentUser.id}
                    skipCount={initialPwdCheck.count}
                    onComplete={(changed) => {
                        setInitialPwdCheck(null);
                        if (changed) {
                            handleLogout();
                        }
                    }}
                />
            )}
        </>

    );
}

export default App;
