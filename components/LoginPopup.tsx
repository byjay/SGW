import React from 'react';
import { User } from '../types';
import { X, CreditCard, Calendar, Users, AlertCircle } from 'lucide-react';

interface LoginPopupProps {
  currentUser: User;
  todayLeaveUsers?: User[];
  showPaymentRequest: boolean;
  onClose: () => void;
}

export const LoginPopup: React.FC<LoginPopupProps> = ({
  currentUser,
  todayLeaveUsers = [],
  showPaymentRequest,
  onClose
}) => {
  const isManagement = ['1', '2', '5'].includes(currentUser.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-slate-800">로그인 알림</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24}/>
          </button>
        </div>
        <div className="p-6 space-y-6">
          {/* Welcome Message */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">환영합니다!</p>
                <p className="text-sm text-slate-600">{currentUser.name}님, 오늘 하루도 좋은 하루 되세요.</p>
              </div>
            </div>
          </div>

          {/* Payment Request for Management */}
          {isManagement && showPaymentRequest && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-amber-600" />
                    <p className="font-bold text-amber-800">결제 요청 안내</p>
                  </div>
                  <p className="text-sm text-amber-700 mb-3">
                    미결제된 요청이 {Math.floor(Math.random() * 5) + 1}건 있습니다.
                    금일 내 결제를 완료해 주시기 바랍니다.
                  </p>
                  <button className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-sm transition-colors">
                    결제 요청 확인하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Today's Leave Users */}
          {todayLeaveUsers.length > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Calendar size={20} className="text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-purple-600" />
                    <p className="font-bold text-purple-800">오늘 연차 사용자</p>
                  </div>
                  <div className="space-y-2">
                    {todayLeaveUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between bg-white/60 rounded-lg p-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-8 h-8 rounded-full border border-purple-200"
                          />
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.projectScope}</p>
                          </div>
                        </div>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                          연차
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Today's Summary */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Users size={18} className="text-slate-600" />
              오늘의 요약
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{Math.floor(Math.random() * 10) + 5}</p>
                <p className="text-xs text-slate-600">출근 인원</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-600">{todayLeaveUsers.length}</p>
                <p className="text-xs text-slate-600">연차 사용</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
