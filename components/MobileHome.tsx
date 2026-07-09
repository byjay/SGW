import React from 'react';
import { User, ViewState } from '../types';
import { APP_CONFIG } from '../constants/appConfig';
import { Home, LayoutGrid, MessageSquare, MessageCircle, Calendar, FileCheck, CalendarDays, Shield, Mail, FolderOpen, ExternalLink } from 'lucide-react';

interface MobileHomeProps {
  currentUser: User;
  onNavigate: (view: ViewState) => void;
  unreadCount: number;
}

// SEDMS 진입은 SGW 서버(/api/sedms-sso)가 HMAC 서명 후 재로그인 없이 세션 발급 (Home.tsx와 동일 로직)
const SEDMS_SSO_ENDPOINT = '/api/sedms-sso';

// ★ 모바일에서도 웹과 동일하게 전 기능 접근 (2026-07-09 마스터 지시: "모바일 2기능 제한 취소")
export const MobileHome: React.FC<MobileHomeProps> = ({ currentUser, onNavigate, unreadCount }) => {
  const openSedms = () => {
    if (!currentUser?.email) {
      alert('SGW 로그인이 필요합니다.');
      return;
    }
    const params = new URLSearchParams({
      email: currentUser.email,
      name: currentUser.name || '',
      emp_id: currentUser.id || '',
      role: currentUser.role || '',
      dept: currentUser.department || '',
    });
    window.open(`${SEDMS_SSO_ENDPOINT}?${params.toString()}`, '_blank');
  };

  // 내부 기능 카드 정의 (color 토큰: 라이트/다크 모두 대비 4.5:1↑ 확보)
  const features: Array<{
    view: ViewState;
    label: string;
    desc: string;
    icon: any;
    iconClass: string;
    iconBg: string;
    badge?: number;
    adminOnly?: boolean;
  }> = [
    { view: 'home', label: '홈', desc: '대시보드', icon: Home, iconClass: 'text-blue-600 dark:text-blue-300', iconBg: 'bg-blue-50 dark:bg-blue-900/30' },
    { view: 'board', label: '게시판', desc: '공지·자료', icon: LayoutGrid, iconClass: 'text-indigo-600 dark:text-indigo-300', iconBg: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { view: 'messages', label: '쪽지함', desc: '쪽지·조직도', icon: MessageSquare, iconClass: 'text-cyan-600 dark:text-cyan-300', iconBg: 'bg-cyan-50 dark:bg-cyan-900/30', badge: unreadCount },
    { view: 'chat', label: '채팅', desc: '실시간 대화', icon: MessageCircle, iconClass: 'text-teal-600 dark:text-teal-300', iconBg: 'bg-teal-50 dark:bg-teal-900/30' },
    { view: 'leave', label: '연차 신청', desc: '휴가/반차', icon: Calendar, iconClass: 'text-purple-600 dark:text-purple-300', iconBg: 'bg-purple-50 dark:bg-purple-900/30' },
    { view: 'approval', label: '전자결재', desc: '결재 문서', icon: FileCheck, iconClass: 'text-amber-600 dark:text-amber-300', iconBg: 'bg-amber-50 dark:bg-amber-900/30' },
    { view: 'calendar', label: '캘린더', desc: '일정 관리', icon: CalendarDays, iconClass: 'text-rose-600 dark:text-rose-300', iconBg: 'bg-rose-50 dark:bg-rose-900/30' },
    { view: 'admin', label: '관리자', desc: '사용자 관리', icon: Shield, iconClass: 'text-slate-700 dark:text-slate-200', iconBg: 'bg-slate-100 dark:bg-slate-800', adminOnly: true },
  ];

  const visibleFeatures = features.filter(f => !f.adminOnly || currentUser.role === 'admin');

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] -mx-4 -mt-4 min-h-[calc(100vh-64px)] pb-24 flex flex-col">
      <div className="flex-1 w-full">
        {/* Welcome Section */}
        <section className="p-4">
          <div className="bg-gradient-to-br from-[#135bec] to-blue-700 rounded-xl p-6 text-white shadow-lg shadow-[#135bec]/20">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold">{currentUser.name}님, 환영합니다 👋</h2>
              <p className="opacity-90 text-sm">{currentUser.position}{currentUser.department ? ` · ${currentUser.department}` : ''}{currentUser.role === 'admin' ? ' · 관리자' : ''}</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              오늘 접속 중
            </div>
          </div>
        </section>

        {/* Main Features Grid — 전 기능 */}
        <section className="px-4 pb-2">
          <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-100">주요 기능</h3>
          <div className="grid grid-cols-2 gap-3">
            {visibleFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.view}
                  onClick={() => onNavigate(f.view)}
                  className="text-left bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-start gap-3 hover:border-blue-500/40 active:scale-[0.98] transition-all cursor-pointer group relative"
                >
                  {f.badge && f.badge > 0 ? (
                    <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{f.badge}</span>
                  ) : null}
                  <div className={`w-11 h-11 ${f.iconBg} ${f.iconClass} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon size={22} />
                  </div>
                  <div className="w-full">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm break-keep line-clamp-1">{f.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 break-keep line-clamp-1 mt-0.5">{f.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* External Services */}
        <section className="p-4">
          <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-100">외부 연동</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* MailPlug 메일 */}
            <button
              onClick={() => window.open(APP_CONFIG.MAIL.URL, '_blank')}
              className="text-left bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-start gap-3 hover:border-blue-500/40 active:scale-[0.98] transition-all cursor-pointer relative"
            >
              <ExternalLink size={13} className="absolute top-3 right-3 text-slate-400" />
              <div className="w-11 h-11 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail size={22} />
              </div>
              <div className="w-full">
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm break-keep line-clamp-1">메일</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 break-keep line-clamp-1 mt-0.5">MailPlug 웹메일</p>
              </div>
            </button>

            {/* SEDMS 전자문서 */}
            <button
              onClick={openSedms}
              className="text-left bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-start gap-3 hover:border-blue-500/40 active:scale-[0.98] transition-all cursor-pointer relative"
            >
              <ExternalLink size={13} className="absolute top-3 right-3 text-slate-400" />
              <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 rounded-xl flex items-center justify-center flex-shrink-0">
                <FolderOpen size={22} />
              </div>
              <div className="w-full">
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm break-keep line-clamp-1">SEDMS</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 break-keep line-clamp-1 mt-0.5">전자문서 시스템</p>
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
