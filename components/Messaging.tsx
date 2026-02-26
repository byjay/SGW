import React from 'react';
import { User, Message } from '../types';
import { MockServer } from '../services/mockServer';
import { Send, Search, Mail, User as UserIcon, CheckCheck, ArrowLeft, Users, Trash2 } from 'lucide-react';

interface MessagingProps {
  currentUser: User;
}

export const Messaging: React.FC<MessagingProps> = ({ currentUser }) => {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // State for Compose
  const [selectedUser, setSelectedUser] = React.useState<string>('');
  const [messageContent, setMessageContent] = React.useState('');
  
  // View State
  const [view, setView] = React.useState<'list' | 'detail' | 'compose' | 'users'>('list');
  const [activeMessage, setActiveMessage] = React.useState<Message | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [msgs, usrs] = await Promise.all([
      MockServer.getMessages(currentUser.id),
      MockServer.getUsers()
    ]);
    setMessages(msgs);
    setUsers(usrs.filter(u => u.id !== currentUser.id)); // Exclude self
    setLoading(false);
  };

  React.useEffect(() => {
    fetchData();
    // Simple polling to simulate real-time updates
    const interval = setInterval(() => {
        MockServer.getMessages(currentUser.id).then(setMessages);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !messageContent.trim()) return;

    await MockServer.sendMessage(currentUser, selectedUser, messageContent);
    setMessageContent('');
    setSelectedUser('');
    setView('list');
    fetchData();
  };

  const handleRead = (msg: Message) => {
      setActiveMessage(msg);
      setView('detail');
      
      if (!msg.isRead && msg.receiverId === currentUser.id) {
          MockServer.markAsRead(msg.id);
          setMessages(prev => prev.map(m => m.id === msg.id ? {...m, isRead: true} : m));
      }
  }

  const handleDelete = async (msgId: string) => {
      if (window.confirm('이 쪽지를 삭제하시겠습니까?')) {
          await MockServer.deleteMessage(msgId);
          setActiveMessage(null);
          setView('list');
          fetchData();
      }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] flex gap-6">
      {/* Sidebar List (Always visible on Desktop, visible on Mobile if view is list) */}
      <div className={`flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${view !== 'list' ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Mail size={18} className="text-blue-600"/>
            쪽지함
          </h2>
          <div className="flex gap-2">
             <button 
                onClick={() => setView('users')} 
                className="md:hidden text-sm bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-medium hover:bg-slate-200"
             >
                <Users size={16}/>
             </button>
             <button 
                onClick={() => {
                    setActiveMessage(null);
                    setView('compose');
                }}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
             >
                새 쪽지
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {loading ? (
             <div className="p-4 text-center text-slate-400 text-sm">로딩중...</div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 p-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <Mail size={32} className="text-slate-300"/>
                </div>
                <p>주고받은 쪽지가 없습니다.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isReceived = msg.receiverId === currentUser.id;
              const isActive = activeMessage?.id === msg.id;
              
              return (
                <div 
                  key={msg.id}
                  onClick={() => handleRead(msg)}
                  className={`group p-4 rounded-xl border transition-all cursor-pointer ${
                    isActive 
                        ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'
                        : !msg.isRead && isReceived
                            ? 'bg-white border-blue-100 shadow-sm ring-1 ring-blue-50' 
                            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-sm font-bold ${!msg.isRead && isReceived ? 'text-blue-700' : 'text-slate-700'}`}>
                      {isReceived ? msg.senderName : `To: ${msg.receiverName}`}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(msg.timestamp)}</span>
                  </div>
                  <p className={`text-sm line-clamp-1 mb-2 ${!msg.isRead && isReceived ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                    {msg.content}
                  </p>
                  <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                         <span className={`text-[10px] px-2 py-0.5 rounded-full ${isReceived ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-600'}`}>
                            {isReceived ? '받은 쪽지' : '보낸 쪽지'}
                         </span>
                         {!isReceived && (
                             <div className="flex items-center text-xs text-slate-400">
                                 <CheckCheck size={14} className={msg.isRead ? 'text-blue-500' : 'text-slate-300'} />
                             </div>
                         )}
                         {isReceived && !msg.isRead && (
                             <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                         )}
                     </div>
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(msg.id);
                        }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        title="쪽지 삭제"
                     >
                         <Trash2 size={14}/>
                     </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detail / Compose Area / User List */}
      <div className={`flex-[1.5] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${view === 'list' ? 'hidden md:flex' : 'flex'}`}>
         
         {/* User List (Org Chart substitute) */}
         {view === 'users' && (
             <>
                 <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setView('list')}
                            className="md:hidden p-1.5 -ml-2 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            <ArrowLeft size={20}/>
                        </button>
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <Users size={18} className="text-blue-600"/>
                            임직원 목록
                        </h2>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {users.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full" />
                                <div>
                                    <p className="font-bold text-slate-800">{u.name}</p>
                                    <p className="text-xs text-slate-500">{u.role}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setSelectedUser(u.id);
                                    setView('compose');
                                }}
                                className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100"
                            >
                                쪽지
                            </button>
                        </div>
                    ))}
                </div>
             </>
         )}

         {/* Compose View */}
         {view === 'compose' && (
            <>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setView('list')}
                            className="md:hidden p-1.5 -ml-2 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            <ArrowLeft size={20}/>
                        </button>
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <Send size={18} className="text-blue-600"/>
                            쪽지 보내기
                        </h2>
                    </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                    <form onSubmit={handleSend} className="h-full flex flex-col space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">받는 사람</label>
                            <div className="relative">
                                <select
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none appearance-none bg-white text-slate-900 font-medium"
                                    required
                                >
                                    <option value="">사용자를 선택하세요</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                    ))}
                                </select>
                                <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            </div>
                        </div>

                        <div className="space-y-2 flex-1 flex flex-col">
                            <label className="text-sm font-medium text-slate-700">내용</label>
                            <textarea
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                                className="w-full flex-1 p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none bg-white text-slate-900 leading-relaxed min-h-[200px]"
                                placeholder="전달할 내용을 입력하세요..."
                                required
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={!selectedUser || !messageContent.trim()}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center space-x-2"
                            >
                                <Send size={18} />
                                <span>보내기</span>
                            </button>
                        </div>
                    </form>
                </div>
            </>
         )}

         {/* Read View */}
         {view === 'detail' && activeMessage && (
             <>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setView('list')}
                            className="md:hidden p-1.5 -ml-2 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            <ArrowLeft size={20}/>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                <UserIcon size={16}/>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">
                                    {activeMessage.senderId === currentUser.id 
                                        ? `To: ${activeMessage.receiverName}` 
                                        : `From: ${activeMessage.senderName}`
                                    }
                                </h3>
                                <p className="text-xs text-slate-500">{new Date(activeMessage.timestamp).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleDelete(activeMessage.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="쪽지 삭제"
                    >
                        <Trash2 size={18}/>
                    </button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{activeMessage.content}</p>
                    </div>
                    {activeMessage.receiverId === currentUser.id && (
                        <div className="mt-6 flex justify-end">
                            <button 
                                onClick={() => {
                                    setSelectedUser(activeMessage.senderId);
                                    setView('compose');
                                }}
                                className="bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 text-slate-600 px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2"
                            >
                                <Send size={16}/>
                                답장하기
                            </button>
                        </div>
                    )}
                </div>
             </>
         )}

         {/* Empty State (Desktop only) */}
         {view === 'list' && (
             <div className="hidden md:flex flex-col items-center justify-center h-full text-slate-300 space-y-4">
                 <Mail size={48} className="opacity-20"/>
                 <p className="font-medium">쪽지를 선택하여 내용을 확인하세요</p>
             </div>
         )}
      </div>
    </div>
  );
};