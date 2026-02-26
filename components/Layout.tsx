import React from 'react';
import { User, ViewState } from '../types';
import { LogOut, LayoutGrid, MessageSquare, Menu, X, Calendar, Shield, FileCheck, Home, Calendar as CalendarIcon, Mail, ExternalLink, Archive, Layers, Key } from 'lucide-react';
import logoImage from '../7.png';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User | null;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onLogout: () => void;
  unreadCount: number;
  onlineUsers: User[];
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentUser, 
  currentView, 
  onNavigate, 
  onLogout,
  unreadCount,
  onlineUsers
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');

  if (!currentUser) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">{children}</div>;
  }

  const handleExternalLink = (url: string) => {
      window.open(url, '_blank');
      setIsMobileMenuOpen(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError('');

      if (newPassword !== confirmPassword) {
          setPasswordError('비밀번호가 일치하지 않습니다.');
          return;
      }

      if (newPassword.length < 4) {
          setPasswordError('비밀번호는 4자리 이상이어야 합니다.');
          return;
      }

      try {
          const { MockServer } = await import('../services/mockServer');
          await MockServer.changePassword(currentUser.id, newPassword);
          alert('비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.');
          setShowPasswordModal(false);
          onLogout();
      } catch (error) {
          setPasswordError('비밀번호 변경 중 오류가 발생했습니다.');
      }
  };

  const NavItem = ({ view, icon: Icon, label, badge }: { view: ViewState; icon: any; label: string, badge?: number }) => (
    <button
      onClick={() => {
        onNavigate(view);
        setIsMobileMenuOpen(false);
      }}
      className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ${
        currentView === view 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
      {badge ? (
        <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm">
          {badge}
        </span>
      ) : null}
    </button>
  );

  const ExternalItem = ({ url, icon: Icon, label }: { url: string; icon: any; label: string }) => (
    <button
      onClick={() => handleExternalLink(url)}
      className="flex items-center space-x-3 w-full px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-all duration-200"
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
      <ExternalLink size={14} className="ml-auto opacity-50"/>
    </button>
  );

  const NavigationContent = () => (
      <>
          <NavItem view="home" icon={Home} label="홈 (대시보드)" />
          
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">소통 및 알림</p>
          </div>
          <NavItem view="mail" icon={Mail} label="사내 메일" />
          <NavItem view="board" icon={LayoutGrid} label="게시판" />
          <NavItem view="messages" icon={MessageSquare} label="쪽지함 (조직도)" badge={unreadCount > 0 ? unreadCount : undefined} />
          
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">업무 관리</p>
          </div>
          <NavItem view="calendar" icon={CalendarIcon} label="일정 캘린더" />
          <NavItem view="approval" icon={FileCheck} label="전자 결재" />
          <NavItem view="leave" icon={Calendar} label="휴가 신청" />

          {/* Only Kim Bongjung (ID: 5) and Lee Seon-woo (ID: 2) can see admin menu */}
          {['2', '5'].includes(currentUser.id) && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">관리자</p>
              </div>
              <NavItem view="admin" icon={Shield} label="사용자 관리" />
            </>
          )}
      </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-6 fixed h-full z-10 overflow-y-auto">
        <div className="flex items-center mb-10 px-2 cursor-pointer" onClick={() => onNavigate('home')}>
          <img src={logoImage} alt="SEASTAR Logo" className="w-full max-w-[200px] h-auto object-contain" />
        </div>

        <nav className="space-y-1 mb-8">
            <NavigationContent />
        </nav>

        {/* Online Users Section */}
        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="flex items-center space-x-3 px-4 py-3 mb-2 bg-slate-50 rounded-xl">
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className="w-9 h-9 rounded-full border border-white shadow-sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{currentUser.name}</p>
              <div className="flex items-center text-xs text-green-600 font-medium">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></div>
                온라인
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center space-x-3 w-full px-4 py-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm mb-1"
          >
            <Key size={16} />
            <span>비밀번호 변경</span>
          </button>
          <button 
            onClick={onLogout}
            className="flex items-center space-x-3 w-full px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
          >
            <LogOut size={16} />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => onNavigate('home')}>
          <img src={logoImage} alt="SEASTAR Logo" className="h-8 w-auto object-contain" />
        </div>
        <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
                <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
            )}
            <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-white z-50 pt-20 px-6 pb-6 flex flex-col animate-fade-in overflow-y-auto">
           <nav className="flex-1 space-y-2">
             <NavigationContent />
          </nav>

          <div className="pt-6 border-t border-slate-100 mt-auto">
             <div className="flex items-center space-x-3 mb-6 bg-slate-50 p-3 rounded-xl">
              <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full" />
              <div>
                <p className="font-semibold">{currentUser.name}</p>
                <p className="text-xs text-green-600 font-medium flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                    접속중
                </p>
              </div>
            </div>
             <button 
              onClick={() => {
                  setIsMobileMenuOpen(false);
                  setShowPasswordModal(true);
              }}
              className="w-full flex items-center justify-center space-x-2 bg-blue-50 text-blue-600 hover:bg-blue-100 py-3 rounded-xl font-medium transition-colors mb-2"
            >
              <Key size={18} />
              <span>비밀번호 변경</span>
            </button>
             <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 bg-red-50 text-red-600 hover:bg-red-100 py-3 rounded-xl font-medium transition-colors"
            >
              <LogOut size={18} />
              <span>로그아웃</span>
            </button>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-4 right-4 p-2 text-slate-500">
              <X size={24}/>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-[calc(100vh-64px)] md:h-screen bg-slate-50/50">
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>

      {/* Password Change Modal */}
      {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)}></div>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 animate-fade-in overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-800">비밀번호 변경</h3>
                      <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-800">
                          <X size={24}/>
                      </button>
                  </div>
                  <div className="p-6">
                      <form onSubmit={handleChangePassword} className="space-y-4">
                          {passwordError && (
                              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                                  {passwordError}
                              </div>
                          )}
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">새 비밀번호</label>
                              <input 
                                  type="password" 
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                  required
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">새 비밀번호 확인</label>
                              <input 
                                  type="password" 
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                  required
                              />
                          </div>
                          <button 
                              type="submit"
                              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-600/20"
                          >
                              변경하기
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};