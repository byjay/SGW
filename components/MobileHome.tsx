import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { MockServer } from '../services/mockServer';
import { MapPin, Lock, CheckCircle, X } from 'lucide-react';

interface MobileHomeProps {
  currentUser: User;
  onNavigate: (view: any) => void;
  unreadCount: number;
}

const OFFICE_LOCATION = {
  lat: 37.5665,
  lng: 126.9780,
  radius: 500 // meters
};

export const MobileHome: React.FC<MobileHomeProps> = ({ currentUser, onNavigate, unreadCount }) => {
  const [attendance, setAttendance] = useState<{ clockIn: number | null, clockOut: number | null }>({ clockIn: null, clockOut: null });
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceStep, setAttendanceStep] = useState<'location' | 'verify' | 'success'>('location');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [locationStatus, setLocationStatus] = useState('위치 확인 중...');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    MockServer.getTodayAttendance(currentUser.id).then(setAttendance);
  }, [currentUser.id]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const checkLocation = () => {
    setLocationStatus('GPS 위치 확인 중...');
    if (!navigator.geolocation) {
      setLocationStatus('GPS를 지원하지 않는 브라우저입니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const dist = calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          OFFICE_LOCATION.lat,
          OFFICE_LOCATION.lng
        );

        setTimeout(() => {
          if (dist > OFFICE_LOCATION.radius) {
            setLocationStatus(`위치 인증 실패 — 사무실에서 ${Math.round(dist)}m 떨어져 있습니다. (500m 이내 필요)`);
          } else {
            setLocationStatus('위치 인증 완료 (본사 반경 500m 내)');
            setTimeout(() => setAttendanceStep('verify'), 800);
          }
        }, 1500);
      },
      (error) => {
        console.error(error);
        setLocationStatus('위치 정보를 가져올 수 없습니다. 권한을 확인해주세요.');
      }
    );
  };

  const handleIdentityVerify = async () => {
    if (!verifyPassword.trim()) {
      alert('비밀번호를 입력해주세요.');
      return;
    }
    setIsVerifying(true);

    const verifiedUser = await MockServer.login(currentUser.id, verifyPassword);
    if (!verifiedUser) {
      alert('비밀번호가 일치하지 않습니다.');
      setIsVerifying(false);
      return;
    }

    setTimeout(async () => {
      setIsVerifying(false);
      if (!attendance.clockIn) {
        await MockServer.logAttendance(currentUser.id, 'clock_in');
      } else {
        await MockServer.logAttendance(currentUser.id, 'clock_out');
      }
      MockServer.getTodayAttendance(currentUser.id).then(setAttendance);
      setAttendanceStep('success');
    }, 1000);
  };

  const openAttendanceModal = () => {
    setShowAttendanceModal(true);
    setAttendanceStep('location');
    setVerifyPassword('');
    checkLocation();
  };

  const isAdmin = ['2', '5'].includes(currentUser.id);

  const handleNavigate = (view: any) => {
    onNavigate(view);
  };

  return (
    <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101622]">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#135bec] text-white p-1.5 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.946 9.315c-.522-1.667-.55-2.259.028-3.572.254-.603.587-.825.816-.939.018-.01.036-.018.053-.025L12 2.25l9.157 2.524c.018.007.035.015.053.025.229.114.562.336.816.94.578 1.313.55 1.905.028 3.572l-9.054 10.474c-.29.34-.825.34-1.115 0L1.946 9.315z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#135bec]">SEASTAR</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>}
            </button>
            <div className="w-10 h-10 rounded-full bg-[#135bec]/10 border-2 border-[#135bec]/20 overflow-hidden">
              <img className="w-full h-full object-cover" src={currentUser.avatar} alt={currentUser.name} />
            </div>
          </div>
        </div>
      </header>

      <main className="overflow-y-auto pb-24">
        {/* Welcome Section */}
        <section className="p-4">
          <div className="bg-gradient-to-br from-[#135bec] to-blue-700 rounded-xl p-6 text-white shadow-lg shadow-[#135bec]/20">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold">Welcome back, {currentUser.name.split(' ')[0]}</h2>
              <p className="opacity-90 text-sm">{currentUser.role === 'admin' ? 'Administrator' : 'Employee'} • {currentUser.projectScope}</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Last login: Today
            </div>
          </div>
        </section>

        {/* Attendance Quick Status */}
        <section className="px-4 py-2">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">출퇴근 관리</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">
                    {attendance.clockIn ? new Date(attendance.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={openAttendanceModal}
              className="bg-[#135bec] hover:bg-[#135bec]/90 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-sm active:scale-95"
            >
              출근/퇴근
            </button>
          </div>
        </section>

        {/* Main Features Grid */}
        <section className="p-4">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            Main Features
            <span className="h-1 w-1 bg-slate-400 rounded-full"></span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Feature 1: Leave - MOVED TO TOP */}
            <div
              onClick={() => handleNavigate('leave')}
              className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-start gap-4 hover:border-purple-500/30 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-xl flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">연차 신청</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">휴가/반차 신청</p>
              </div>
            </div>

            {/* Feature 2: Mail - Updated to window.open */}
            <div
              onClick={() => window.open('https://m193.mailplug.com/member/login', '_blank')}
              className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-start gap-4 hover:border-[#135bec]/30 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-[#135bec] rounded-xl flex items-center justify-center group-hover:bg-[#135bec] group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">사내 메일</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">MailPlug</p>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block">
                    {unreadCount}개
                  </span>
                )}
              </div>
            </div>

            {/* Feature 3: Attendance */}
            <div
              onClick={openAttendanceModal}
              className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-start gap-4 hover:border-orange-500/30 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-xl flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">출퇴근 관리</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {attendance.clockIn ? new Date(attendance.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'}
                </p>
              </div>
            </div>

            {/* Feature 4: Messages */}
            <div
              onClick={() => handleNavigate('messages')}
              className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-start gap-4 hover:border-slate-600/30 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center group-hover:bg-slate-600 dark:group-hover:bg-slate-400 group-hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">쪽지/조직도</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">임직원 검색</p>
              </div>
            </div>

            {/* Bug #3 Fix: Admin check corrected to ['2', '5'] */}
            {isAdmin && (
              <div
                onClick={() => handleNavigate('admin')}
                className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-start gap-4 hover:border-slate-600/30 transition-all cursor-pointer group col-span-2"
              >
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center group-hover:bg-slate-600 dark:group-hover:bg-slate-400 group-hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">사용자 관리</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">관리자</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Secondary Banner/Info */}
        <section className="px-4 pb-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 flex shadow-sm">
            <div className="flex-1 p-5">
              <h4 className="font-bold text-slate-900 dark:text-slate-100">Company News</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Welcome to SEASTAR Groupware. Stay connected!</p>
              <button
                onClick={() => handleNavigate('board')}
                className="text-[#135bec] text-xs font-bold mt-3 inline-block"
              >
                READ MORE
              </button>
            </div>
            <div className="w-24 bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1497366216548-37526070297c?w=200')` }}></div>
          </div>
        </section>
      </main>

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAttendanceModal(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 animate-fade-in overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin size={32} className="text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">출퇴근 체크</h3>

              {/* Step 1: Location Check */}
              {attendanceStep === 'location' && (
                <div className="py-4">
                  <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-600 font-medium">{locationStatus}</p>
                </div>
              )}

              {/* Step 2: Identity Verify */}
              {attendanceStep === 'verify' && (
                <div className="py-2 space-y-4 animate-fade-in">
                  <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                    <CheckCircle size={16} />
                    위치 인증 완료
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-3">본인 확인을 위해 비밀번호를 입력해주세요.</p>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={verifyPassword}
                        onChange={(e) => setVerifyPassword(e.target.value)}
                        placeholder="비밀번호"
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleIdentityVerify}
                    disabled={isVerifying}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-orange-600/20 disabled:opacity-70"
                  >
                    {isVerifying ? '확인 중...' : (attendance.clockIn && !attendance.clockOut ? '퇴근 처리하기' : '출근 처리하기')}
                  </button>
                </div>
              )}

              {/* Step 3: Success */}
              {attendanceStep === 'success' && (
                <div className="py-4 animate-fade-in">
                  <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                  <h4 className="text-lg font-bold text-slate-800">처리가 완료되었습니다.</h4>
                  <p className="text-slate-500 text-sm mt-2">
                    {new Date().toLocaleString()}
                  </p>
                  <button
                    onClick={() => setShowAttendanceModal(false)}
                    className="mt-6 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                  >
                    닫기
                  </button>
                </div>
              )}
            </div>
            {attendanceStep !== 'success' && (
              <button onClick={() => setShowAttendanceModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
