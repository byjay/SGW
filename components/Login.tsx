import React, { useState } from 'react';
import { User } from '../types';
import { Users, Lock, User as UserIcon } from 'lucide-react';
import { MockServer } from '../services/mockServer';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const users = await MockServer.getUsers();
      const user = users.find(u => u.name === name && (u.password || '1') === password);
      
      if (user) {
        onLogin(user);
      } else {
        setError('이름 또는 비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if(confirm('모든 데이터가 초기화됩니다. 계속하시겠습니까?')) {
      MockServer.resetData();
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-sm mb-4">
            <Users className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect</h2>
          <p className="text-blue-100 text-sm">편리한 그룹웨어 접속</p>
        </div>
        
        <div className="p-6 space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="이름을 입력하세요"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="비밀번호를 입력하세요 (초기 비밀번호: 1)"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="pt-4 mt-2 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 mb-2">
              데모 환경: 데이터는 브라우저에 임시 저장됩니다.
            </p>
            <button 
              onClick={handleReset}
              className="text-xs text-red-400 hover:text-red-600 underline"
            >
              시스템 초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};