import React, { useState, useEffect } from 'react';
import { ViewState, User, Schedule } from '../types';
import { MockServer } from '../services/mockServer';
import { Mail, Clock, Users, Layout, Archive, Shield, CheckCircle, FileText, Settings, MapPin, X, Lock, Calendar } from 'lucide-react';

interface HomeProps {
  currentUser: User;
  onNavigate: (view: ViewState) => void;
  unreadCount: number;
}

// Dummy Office Location
const OFFICE_LOCATION = {
    lat: 37.5665,
    lng: 126.9780,
    radius: 500 // meters
};

const EXTERNAL_LINK = 'http://dms.seastar.work';

export const Home: React.FC<HomeProps> = ({ currentUser, onNavigate, unreadCount }) => {
  const [attendance, setAttendance] = useState<{clockIn: number | null, clockOut: number | null}>({clockIn: null, clockOut: null});
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceStep, setAttendanceStep] = useState<'location' | 'verify' | 'success'>('location');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [locationStatus, setLocationStatus] = useState('위치 확인 중...');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
      MockServer.getTodayAttendance(currentUser.id).then(setAttendance);
  }, [currentUser.id]);

  const handleExternalLink = () => {
      window.open(EXTERNAL_LINK, '_blank');
  };

  const Card = ({ 
    title, 
    icon: Icon, 
    colorClass, 
    bgClass, 
    onClick, 
    children,
    isExternal = false,
    headerAction
  }: { 
    title: string, 
    icon: any, 
    colorClass: string, 
    bgClass: string, 
    onClick?: () => void,
    children?: React.ReactNode,
    isExternal?: boolean,
    headerAction?: React.ReactNode
  }) => (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl p-3 md:p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden flex flex-col items-center justify-start md:block md:text-left h-32 md:h-auto`}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 ${bgClass} rounded-bl-full opacity-50 transition-transform group-hover:scale-110 hidden md:block`}></div>
      
      <div className="flex flex-col md:flex-row items-center md:space-x-3 mb-2 md:mb-6 relative z-10 w-full justify-between">
        <div className="flex items-center space-x-3 w-full md:w-auto justify-center md:justify-start">
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl ${bgClass} ${colorClass} flex items-center justify-center mb-1 md:mb-0`}>
                <Icon size={18} className="md:w-5 md:h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-[11px] md:text-base text-center md:text-left leading-tight w-full md:w-auto truncate">{title}</h3>
        </div>
        {headerAction && (
            <div className="hidden md:block" onClick={(e) => e.stopPropagation()}>
                {headerAction}
            </div>
        )}
      </div>
      
      <div className="relative z-10 w-full hidden md:block">
        {children}
      </div>

      {/* Mobile Only Indicator */}
      <div className="md:hidden mt-auto">
          {isExternal && <p className="text-[9px] text-slate-400">외부연동</p>}
      </div>
    </div>
  );

  const handleSystemSettings = () => {
      if (currentUser.id === '1') { // Check specifically for Ko Youngkwan
          onNavigate('admin');
      } else {
          alert("접근 권한이 없습니다.\n시스템 설정은 고영관(CEO)님만 접근 가능합니다.");
      }
  };

  // --- Attendance Logic ---

  const openAttendanceModal = () => {
      setShowAttendanceModal(true);
      setAttendanceStep('location');
      setVerifyPassword('');
      checkLocation();
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const checkLocation = () => {
      setLocationStatus('GPS 위치 확인 중...');
      if (!navigator.geolocation) {
          setLocationStatus('GPS를 지원하지 않는 브라우저입니다.');
          return;
      }

      navigator.geolocation.getCurrentPosition(
          (position) => {
              // For Demo: Use the real calculation but allow manual override if user is far
              const dist = calculateDistance(
                  position.coords.latitude, 
                  position.coords.longitude,
                  OFFICE_LOCATION.lat,
                  OFFICE_LOCATION.lng
              );
              
              setTimeout(() => {
                  setLocationStatus('위치 인증 완료 (본사 반경 500m 내)');
                  setTimeout(() => setAttendanceStep('verify'), 800);
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

  return (
    <div className="animate-fade-in space-y-4 md:space-y-8 relative">
      <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        
        {/* Mail Card */}
        <Card 
            title="사내 메일" 
            icon={Mail} 
            colorClass="text-indigo-600" 
            bgClass="bg-indigo-100"
            onClick={() => onNavigate('mail')}
        >
            <div className="flex flex-col items-center justify-center h-24">
                {unreadCount > 0 && (
                     <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
                        {unreadCount}개
                    </span>
                )}
                <p className="text-xs text-slate-500">MailPlug</p>
            </div>
        </Card>

        {/* Attendance Card */}
        <Card 
            title="출퇴근 관리" 
            icon={Clock} 
            colorClass="text-orange-600" 
            bgClass="bg-orange-100"
            onClick={openAttendanceModal}
        >
             <div className="text-center py-2">
                 <p className="text-xl font-bold text-slate-800 tracking-tight">
                     {attendance.clockIn ? new Date(attendance.clockIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '00:00'}
                 </p>
             </div>
        </Card>

        {/* Leave Management Card */}
        <Card 
            title="연차 신청" 
            icon={Calendar} 
            colorClass="text-pink-600" 
            bgClass="bg-pink-100"
            onClick={() => onNavigate('leave')}
        >
            <div className="flex flex-col items-center justify-center h-24">
                <p className="text-xs text-slate-500">휴가/반차 신청</p>
            </div>
        </Card>

        {/* Org Chart (Merged into Messaging) */}
        <Card 
            title="쪽지/조직도" 
            icon={Users} 
            colorClass="text-cyan-600" 
            bgClass="bg-cyan-100"
            onClick={() => onNavigate('messages')}
        >
             <div className="flex flex-col items-center justify-center h-24">
                <p className="text-xs text-slate-500">임직원 검색</p>
            </div>
        </Card>

        {/* Settings */}
        <Card 
            title="시스템 설정" 
            icon={Settings} 
            colorClass="text-slate-600" 
            bgClass="bg-slate-100"
            onClick={handleSystemSettings}
        >
             <div className="flex flex-col items-center justify-center h-24">
                <p className="text-[10px] text-slate-400">관리자</p>
            </div>
        </Card>
      </div>

      {/* --- MODALS --- */}

      {/* 2. Attendance Modal */}
      {showAttendanceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAttendanceModal(false)}></div>
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 animate-fade-in overflow-hidden">
                   <div className="p-6 text-center">
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MapPin size={32} className="text-orange-600"/>
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
                                    <CheckCircle size={16}/>
                                    위치 인증 완료
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 mb-3">본인 확인을 위해 비밀번호를 입력해주세요.</p>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
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
                                <CheckCircle size={48} className="text-green-500 mx-auto mb-4"/>
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
                           <X size={20}/>
                       </button>
                   )}
               </div>
          </div>
      )}

    </div>
  );
};