import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, Loader2, Eye, EyeOff, User as UserIcon, LayoutGrid } from 'lucide-react';
import { User } from '../types';
import { MockServer } from '../services/mockServer';

const now = new Date();
const BUILD_VERSION = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} (KST)`;
const VIDEO_1 = "/SEASTAR_shipbuilding.mp4";
const VIDEO_2 = "/SEASTAR_offshore_win.mp4";
const CONTACT_EMAIL = "designsir@seasargo.com";
import LOGO_TOP from '../logo.jpg';

// Custom SGW SVG Logo matching the vibe of SEDMS
const SgwLogo = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 400 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-full h-full object-contain ${className}`}
  >
    {/* Abstract geometric sea/star mark */}
    <g transform="translate(50, 50)">
      <path d="M0 -30 L10 -10 L30 0 L10 10 L0 30 L-10 10 L-30 0 L-10 -10 Z" fill="url(#blue-gradient)" />
      <circle cx="0" cy="0" r="15" fill="#0f172a" stroke="url(#cyan-gradient)" strokeWidth="3" />
      <path d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3 Z" fill="#38BDF8" />
    </g>
    <text x="110" y="65" fontFamily="sans-serif" fontWeight="900" fontSize="48" fill="#ffffff" letterSpacing="0.1em">
      SGW<span style={{ fill: '#38BDF8' }}>.</span>
    </text>
    <defs>
      <linearGradient id="blue-gradient" x1="-30" y1="-30" x2="30" y2="30" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2563EB" />
        <stop offset="1" stopColor="#06B6D4" />
      </linearGradient>
      <linearGradient id="cyan-gradient" x1="-15" y1="-15" x2="15" y2="15" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" />
        <stop offset="1" stopColor="#818CF8" />
      </linearGradient>
    </defs>
  </svg>
);

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  // Video State
  const [currentVideo, setCurrentVideo] = useState(VIDEO_1);

  const handleVideoEnded = () => {
    setCurrentVideo(prev => prev === VIDEO_1 ? VIDEO_2 : VIDEO_1);
  };

  useEffect(() => {
    const savedName = localStorage.getItem('savedName');
    if (savedName) setName(savedName);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!name.trim()) {
        setError('ID 또는 이름을 입력해주세요.');
        setLoading(false);
        return;
      }

      const allUsers = await MockServer.getUsers();

      const matchedUser = allUsers.find(
        u => u.name === name.trim() || u.email.split('@')[0] === name.trim() || u.email === name.trim()
      );

      if (!matchedUser) {
        setError('존재하지 않는 사용자입니다.');
        setLoading(false);
        return;
      }

      const user = await MockServer.login(matchedUser.id, password);

      if (user) {
        localStorage.setItem('savedName', name);
        onLogin(user);
      } else {
        setError('비밀번호가 일치하지 않습니다.');
      }
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center bg-slate-900 overflow-hidden relative w-full">
      {/* Background - Blue/Slate Gradient (SEDMS Style) */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />

      {/* Main Container - Narrow Width (280px) & Compact - EXACTLY like SEDMS */}
      <div className="w-full max-w-[280px] bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 relative z-10 flex flex-col overflow-hidden transition-all duration-300 mx-auto max-h-[100dvh]">

        {/* HEADING: SINGLE LOGO AT THE VERY TOP */}
        <div className="w-full h-16 relative overflow-hidden shrink-0 border-b border-white/10 bg-white flex items-center justify-center">
          <img
            src={LOGO_TOP}
            alt="SEASTAR"
            className="w-full h-full object-contain p-2"
          />
        </div>

        {/* Content Area - Single Unified Form */}
        <div className="p-6 overflow-y-auto scrollbar-hide flex-1">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Brand Logo & Title - EXACTLY mimicking SEDMS with SGW instead */}
            <div className="flex flex-col items-center mb-6">
              <div className="h-10 mb-3 drop-shadow-lg flex items-center justify-center">
                <div className="p-2 rounded-full bg-slate-800/80 ring-1 ring-blue-500/30">
                  <LayoutGrid className="w-6 h-6 text-blue-400" />
                </div>
              </div>
              <h1 className="text-xl font-black text-white tracking-widest text-shadow-glow">SGW</h1>
              <p className="text-[10px] text-blue-300 font-medium tracking-[0.2em] uppercase mt-1 text-center leading-tight">
                Seastar Groupware System
              </p>
            </div>

            {/* ID Input */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide ml-1">ID (Employee / Partner)</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="ID 또는 이름"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-700 font-medium transition-all"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-700 font-medium transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium flex items-start gap-2 animate-in fade-in zoom-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'LOGIN'}
            </button>
          </form>

        </div>

        {/* Footer: Video with 16:9 Aspect Ratio (No Black Bars, Full Content) - EXACTLY like SEDMS */}
        <div className="relative w-full aspect-video bg-black mt-auto overflow-hidden shrink-0 flex flex-col justify-end">
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-none" />
          <video
            key={currentVideo}
            src={currentVideo}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            onEnded={handleVideoEnded}
          />

          <div className="relative z-20 w-full px-3 pb-2 flex items-end justify-between">
          </div>
        </div>

      </div>
    </div>
  );
};
