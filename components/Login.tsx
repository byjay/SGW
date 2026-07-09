import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, Loader2, Eye, EyeOff, Mail, ArrowRight } from 'lucide-react';
import { User } from '../types';
import { MockServer } from '../services/mockServer';
import SEASTAR_LOGO from '../seastar-logo.png';

const VIDEO_1 = "/SEASTAR_shipbuilding.mp4";
const VIDEO_2 = "/SEASTAR_offshore_win.mp4";

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentVideo, setCurrentVideo] = useState(VIDEO_1);
  const [hidePwdHint, setHidePwdHint] = useState(false);

  const handleVideoEnded = () => setCurrentVideo(prev => (prev === VIDEO_1 ? VIDEO_2 : VIDEO_1));

  useEffect(() => {
    // 확장앱에서 ?email= 로 넘긴 값 우선, 없으면 저장된 이메일
    let prefill = '';
    try { prefill = new URLSearchParams(window.location.search).get('email') || ''; } catch {}
    const saved = prefill || localStorage.getItem('savedEmail') || localStorage.getItem('savedName') || '';
    if (saved) setEmail(saved);
  }, []);

  // ★ 이미 비밀번호를 변경한 사람에게는 "초기 비밀번호는 1" 안내를 보여주지 않는다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = email.trim().toLowerCase();
      if (!id) { setHidePwdHint(false); return; }
      const allUsers = await MockServer.getUsers();
      const matched = allUsers.find(u =>
        u.email.toLowerCase() === id ||
        u.email.split('@')[0].toLowerCase() === id ||
        u.name === email.trim()
      );
      if (!cancelled) setHidePwdHint(!!matched?.passwordChanged);
    })();
    return () => { cancelled = true; };
  }, [email]);

  // ★ Google 계정(회사메일) 연동 로그인 — Cloudflare Pages Functions 기반 서버 OAuth
  // (functions/auth/google/*, E:\code-project\auth\ 라이브러리에서 이식, WORK_ORDER_2026-07-03.md §2 A-4)
  // 버튼 클릭 → /auth/google/login → Google 동의 → /auth/google/callback → AUTH_SUCCESS_URL(=/)로 복귀.
  // 복귀 시 이 컴포넌트가 다시 마운트되므로, 여기서 세션 쿠키(/auth/me) 유무를 확인해 자동 로그인 처리한다.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/auth/me', { credentials: 'include' });
        if (!r.ok) return; // 401 = 아직 구글 로그인 안 함 — 조용히 무시
        const { user: gUser } = await r.json();
        const gEmail = String(gUser.email || '').toLowerCase();
        const allUsers = await MockServer.getUsers();
        const matched = allUsers.find(u =>
          u.email.toLowerCase() === gEmail ||
          u.email.split('@')[0].toLowerCase() === gEmail.split('@')[0] // 회사메일↔gmail 로컬파트 매칭
        );
        if (!matched) { setError(`등록되지 않은 Google 계정입니다: ${gEmail} — 관리자에게 문의하세요.`); return; }
        const user = await MockServer.loginTrusted(matched.id); // Google 인증 성공 = 비밀번호 검증 생략
        if (user) {
          localStorage.setItem('savedEmail', matched.email);
          localStorage.setItem('savedName', matched.name);
          onLogin(user);
        }
      } catch { /* /auth/* 미배포 환경(로컬 프리뷰 등)에서도 조용히 무시 */ }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const id = email.trim().toLowerCase();
      if (!id) { setError('이메일을 입력해주세요.'); setLoading(false); return; }

      const allUsers = await MockServer.getUsers();
      const matchedUser = allUsers.find(
        u => u.email.toLowerCase() === id
          || u.email.split('@')[0].toLowerCase() === id
          || u.name === email.trim()
      );
      if (!matchedUser) { setError('등록되지 않은 이메일입니다. 관리자에게 문의하세요.'); setLoading(false); return; }

      const user = await MockServer.login(matchedUser.id, password);
      if (user) {
        localStorage.setItem('savedEmail', matchedUser.email);
        localStorage.setItem('savedName', matchedUser.name);
        onLogin(user);
      } else {
        setError('비밀번호가 일치하지 않습니다. (초기 비밀번호: 1)');
      }
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden bg-[#05080f] px-4 py-3 sm:py-8">
      <style>{`
        @keyframes luxeRise { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        .luxe-rise { animation: luxeRise .9s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {/* ── 풀스크린 시네마틱 배경 (두 영상 교차) ── */}
      <div className="absolute inset-0 z-0">
        <video key={currentVideo} src={currentVideo} autoPlay muted playsInline
          onEnded={handleVideoEnded}
          className="absolute inset-0 w-full h-full object-contain" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05080f]/80 via-[#06101f]/75 to-[#05080f]/92" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#05080f_95%)]" />
      </div>

      {/* ── 중앙 로그인 카드 ── */}
      <div className="relative z-10 w-full max-w-[400px] luxe-rise" style={{ animationDelay: '.08s' }}>
        <div className="login-card rounded-2xl border shadow-2xl p-5 sm:p-10">
          {/* 헤더 — 깨끗한 CSS 워드마크 (지저분한 PNG 대신, 어느 크기든 선명) */}
          <div className="text-center mb-3 sm:mb-7">
            <div className="inline-flex flex-col items-center mb-3 sm:mb-6 luxe-rise select-none">
              {/* 돛(sail) 마크 */}
              <svg viewBox="0 0 48 40" className="h-7 sm:h-10 w-auto mb-1" aria-hidden="true">
                <path d="M24 2 C26 12 30 20 40 30 L24 30 Z" fill="#2c7a8c" opacity="0.9"/>
                <path d="M24 6 C22 14 18 22 10 30 L24 30 Z" fill="#1e3a8a"/>
              </svg>
              <div className="leading-none">
                <span className="text-2xl sm:text-4xl font-black tracking-tight text-[#1e3a8a]">SEA</span><span className="text-2xl sm:text-4xl font-black tracking-tight text-[#dc2626]">STAR</span>
              </div>
              <span className="text-[11px] sm:text-base font-extrabold tracking-[0.35em] text-[#1e3a8a] mt-0.5 ml-[0.35em]">GROUPWARE</span>
            </div>
            <h1 className="text-xl sm:text-[24px] font-extrabold text-white tracking-tight">로그인</h1>
            <p className="text-xs sm:text-sm text-slate-300/80 mt-1">회사 이메일로 로그인하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-4">
            {/* 이메일 또는 이름 */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300/90 tracking-wide ml-0.5">이메일 또는 이름</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-2.5 sm:top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-sky-400 transition-colors" />
                <input
                  type="text" inputMode="email" autoComplete="username"
                  placeholder="name@seastargo.com 또는 이름"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 sm:py-3 rounded-xl text-sm outline-none focus:border-sky-400/70 focus:ring-4 focus:ring-sky-500/15 transition-all"
                  required autoFocus
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300/90 tracking-wide ml-0.5">비밀번호</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-2.5 sm:top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-sky-400 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="초기 비밀번호: 1"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 sm:py-3 rounded-xl text-sm outline-none focus:border-sky-400/70 focus:ring-4 focus:ring-sky-500/15 transition-all"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-200 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="group w-full py-2.5 sm:py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-bold text-sm tracking-wide hover:from-sky-400 hover:to-blue-500 transition-all shadow-lg shadow-sky-900/50 active:scale-[.98] flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>로그인 <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>}
            </button>
          </form>

          {/* Google 계정(회사메일) 로그인 */}
          <div className="mt-2 sm:mt-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" /><span className="text-[10px] text-slate-400">또는</span><div className="flex-1 h-px bg-slate-200" />
          </div>
          <a
            href="/auth/google/login"
            className="mt-2 sm:mt-3 w-full flex items-center justify-center gap-2 py-2 sm:py-3 bg-white hover:bg-slate-100 text-slate-800 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-black/20"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11C3.25 21.3 7.31 24 12 24z"/>
              <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.61H1.27A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75z"/>
            </svg>
            Google로 계속하기
          </a>

          {!hidePwdHint && (
            <div className="mt-2 sm:mt-6 p-2.5 sm:p-3.5 rounded-xl bg-sky-500/[.08] border border-sky-400/20">
              <p className="text-[11px] text-sky-100/85 leading-relaxed">
                💡 <b className="text-white">최초 로그인</b> — 초기 비밀번호는 <b className="text-white">1</b> 입니다. 로그인 후 비밀번호를 변경해주세요.
              </p>
            </div>
          )}

          {/* Contact Admin */}
          <div className="mt-2 sm:mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400/80">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
            Contact Admin (<a href="mailto:designsir@seastargo.com" className="hover:underline" style={{color:'var(--sq-accent, #3ecf8e)'}}>designsir@seastargo.com</a>)
          </div>

          {/* 하단: SEASTAR 로고 — 모바일에서는 숨겨 높이 절약 */}
          <div className="hidden sm:flex mt-5 pt-4 flex-col items-center gap-1.5 border-t border-white/[.07]">
            <div className="bg-white keep-white rounded-lg px-3 py-1.5">
              <img src={SEASTAR_LOGO} alt="SEASTAR" className="h-6 object-contain" />
            </div>
            <span className="text-[10px] tracking-wide text-slate-500">© {new Date().getFullYear()} SEASTAR Inc.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
