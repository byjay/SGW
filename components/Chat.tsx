import React from 'react';
import { User, ChatRoom, ChatMessage } from '../types';
import { MockServer } from '../services/mockServer';
import { Send, ArrowLeft, MessageCircle, Plus, Search, User as UserIcon, Users, Settings } from 'lucide-react';

interface ChatProps {
  currentUser: User;
  onlineUsers: User[]; 
}

export const Chat: React.FC<ChatProps> = ({ currentUser, onlineUsers }) => {
  const [rooms, setRooms] = React.useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = React.useState<ChatRoom | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'friends' | 'chats'>('friends');
  
  // Ref for auto-scrolling
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const loadRooms = async () => {
    const fetchedRooms = await MockServer.getChatRooms(currentUser.id);
    setRooms(fetchedRooms);
  };

  React.useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 3000); 
    return () => clearInterval(interval);
  }, [currentUser.id]);

  React.useEffect(() => {
    let interval: any;
    if (activeRoom) {
      const fetchMessages = async () => {
        const msgs = await MockServer.getChatMessages(activeRoom.id);
        setMessages(msgs);
      };
      fetchMessages();
      interval = setInterval(fetchMessages, 1000); 
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeRoom]);

  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleStartChat = async (targetUser: User) => {
    const room = await MockServer.startChat(currentUser.id, targetUser.id);
    setActiveRoom(room);
    loadRooms(); 
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !newMessage.trim()) return;

    await MockServer.sendChatMessage(activeRoom.id, currentUser.id, newMessage);
    setNewMessage('');
    const msgs = await MockServer.getChatMessages(activeRoom.id);
    setMessages(msgs);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // --------------------------------------------------------------------------------
  // CHAT ROOM VIEW (Black/Blue Dark Theme)
  // --------------------------------------------------------------------------------
  if (activeRoom) {
    const [otherUser, setOtherUser] = React.useState<User | undefined>(undefined);
    
    React.useEffect(() => {
        const loadUser = async () => {
             const users = await MockServer.getUsers();
             const otherId = activeRoom.participants.find(id => id !== currentUser.id);
             setOtherUser(users.find(u => u.id === otherId));
        };
        loadUser();
    }, [activeRoom]);

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a1a]"> {/* Full screen overlay for chat room */}
        {/* Header */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-10 border-b border-slate-800">
          <div className="flex items-center space-x-3">
             <button 
                onClick={() => setActiveRoom(null)}
                className="text-white hover:text-blue-400 transition-colors"
             >
                <ArrowLeft size={24} />
             </button>
             {otherUser && (
                 <div className="flex items-center space-x-3">
                     <img src={otherUser.avatar} className="w-10 h-10 rounded-full border border-slate-600" alt={otherUser.name} />
                     <h3 className="font-bold text-white text-lg">{otherUser.name}</h3>
                 </div>
             )}
          </div>
          <button className="text-slate-400">
              <Search size={24}/>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#1a1a1a]">
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUser.id;
            
            return (
              <div key={msg.id} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    <div className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isMine && otherUser && (
                            <img src={otherUser.avatar} className="w-8 h-8 rounded-full mb-4" />
                        )}
                        <div className="flex flex-col">
                            {!isMine && <span className="text-slate-400 text-xs mb-1 ml-1">{otherUser?.name}</span>}
                            <div className="flex items-end gap-1.5">
                                 <div 
                                    className={`px-4 py-2 rounded-2xl text-[15px] leading-relaxed break-words shadow-sm
                                    ${isMine 
                                        ? 'bg-[#3b82f6] text-white rounded-tr-sm' // Blue bubble for me
                                        : 'bg-[#334155] text-white rounded-tl-sm' // Dark Slate bubble for others
                                    }`}
                                >
                                    {msg.content}
                                </div>
                                <span className="text-[10px] text-slate-500 min-w-max pb-0.5">
                                    {formatTime(msg.timestamp)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-[#0f172a] p-3 pb-6 border-t border-slate-800">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <button type="button" className="text-slate-400 p-2">
                    <Plus size={24}/>
                </button>
                <div className="flex-1 bg-[#1e293b] rounded-full overflow-hidden flex items-center">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="메시지 보내기"
                        className="w-full bg-[#1e293b] border-none focus:ring-0 px-4 py-3 text-white placeholder-slate-500"
                    />
                </div>
                <button 
                    type="submit"
                    disabled={!newMessage.trim()}
                    className={`p-3 rounded-full transition-colors ${newMessage.trim() ? 'bg-blue-600 text-white' : 'bg-[#1e293b] text-slate-500'}`}
                >
                    <Send size={20} />
                </button>
            </form>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // MAIN LIST VIEW (Black/Blue Mobile Style)
  // --------------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] text-white rounded-xl overflow-hidden shadow-2xl border border-slate-800">
      {/* App Header */}
      <div className="px-5 py-4 flex justify-between items-center bg-[#0f172a]">
          <h2 className="text-2xl font-bold">
              {activeTab === 'friends' ? '친구' : '채팅'}
          </h2>
          <div className="flex gap-4">
              <Search size={24} className="text-slate-300"/>
              <UserIcon size={24} className="text-slate-300"/>
              <Settings size={24} className="text-slate-300"/>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
          {activeTab === 'friends' ? (
              <div className="p-4 space-y-4">
                  {/* My Profile */}
                  <div className="flex items-center gap-4 py-2 border-b border-slate-800 pb-4">
                      <img src={currentUser.avatar} className="w-14 h-14 rounded-2xl" alt="Me" />
                      <div>
                          <h3 className="font-bold text-lg">{currentUser.name}</h3>
                          <p className="text-sm text-slate-400 truncate max-w-[200px]">{currentUser.role} · {currentUser.email}</p>
                      </div>
                  </div>

                  {/* Friends List (Online Users Highligted) */}
                  <div>
                      <h4 className="text-xs text-slate-500 font-bold mb-3 mt-2">친구 {onlineUsers.length}</h4>
                      {onlineUsers.length === 0 ? (
                          <div className="text-center py-8 text-slate-600">접속 중인 친구가 없습니다.</div>
                      ) : (
                          <div className="space-y-4">
                              {onlineUsers.map(user => (
                                  <div key={user.id} onClick={() => handleStartChat(user)} className="flex items-center gap-4 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors">
                                      <div className="relative">
                                          <img src={user.avatar} className="w-11 h-11 rounded-xl" alt={user.name} />
                                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#1a1a1a] rounded-full"></div>
                                      </div>
                                      <div>
                                          <h4 className="font-semibold text-base">{user.name}</h4>
                                          <p className="text-xs text-blue-400 font-medium">{user.role}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          ) : (
             <div className="p-0">
                  {rooms.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                          <MessageCircle size={48} className="mb-2 opacity-50"/>
                          <p>대화방이 없습니다.</p>
                      </div>
                  ) : (
                      rooms.map(room => (
                          <RoomItem key={room.id} room={room} currentUser={currentUser} onClick={() => setActiveRoom(room)} />
                      ))
                  )}
             </div>
          )}
      </div>

      {/* Bottom Navigation */}
      <div className="bg-[#0f172a] border-t border-slate-800 px-6 py-3 flex justify-between items-center safe-area-bottom">
          <button 
            onClick={() => setActiveTab('friends')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'friends' ? 'text-white' : 'text-slate-500'}`}
          >
              <UserIcon size={24} fill={activeTab === 'friends' ? "currentColor" : "none"}/>
              <span className="text-[10px]">친구</span>
          </button>
          <button 
            onClick={() => setActiveTab('chats')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'chats' ? 'text-white' : 'text-slate-500'}`}
          >
              <MessageCircle size={24} fill={activeTab === 'chats' ? "currentColor" : "none"}/>
              <span className="text-[10px]">채팅</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-500">
              <span className="font-bold text-xl leading-none">...</span>
              <span className="text-[10px]">더보기</span>
          </button>
      </div>
    </div>
  );
};

// Helper component
const RoomItem: React.FC<{ room: ChatRoom, currentUser: User, onClick: () => void }> = ({ room, currentUser, onClick }) => {
    const [otherUser, setOtherUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        const loadUser = async () => {
             const users = await MockServer.getUsers();
             const otherId = room.participants.find(id => id !== currentUser.id);
             const u = users.find(u => u.id === otherId);
             setOtherUser(u || null);
        };
        loadUser();
    }, [room, currentUser]);

    if (!otherUser) return null;

    return (
        <div 
            onClick={onClick}
            className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
        >
            <img 
                src={otherUser.avatar} 
                alt={otherUser.name} 
                className="w-14 h-14 rounded-2xl object-cover" 
            />
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                    <h4 className="font-bold text-white text-base">{otherUser.name}</h4>
                    <span className="text-xs text-slate-500 font-medium">{new Date(room.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <p className="text-slate-400 text-sm truncate pr-4">{room.lastMessage || '사진'}</p>
            </div>
        </div>
    );
}