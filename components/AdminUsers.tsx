import React from 'react';
import { User, PasswordResetLog } from '../types';
import { MockServer } from '../services/mockServer';
import { Shield, Plus, X, Search, User as UserIcon, Trash2, KeyRound, AlertTriangle, Clock, Calendar, Edit3, Check } from 'lucide-react';

interface AdminUsersProps {
  currentUser: User;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({ currentUser }) => {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loginHistory, setLoginHistory] = React.useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'users' | 'history' | 'reset-logs'>('users');
  // 비밀번호 리셋 관련 상태
  const [showResetModal, setShowResetModal] = React.useState(false);
  const [resetTargetUser, setResetTargetUser] = React.useState<User | null>(null);
  const [newResetPassword, setNewResetPassword] = React.useState('');
  const [resetError, setResetError] = React.useState('');
  // 연차 수정 관련 상태
  const [showLeaveModal, setShowLeaveModal] = React.useState(false);
  const [leaveTargetUser, setLeaveTargetUser] = React.useState<User | null>(null);
  const [editTotalLeave, setEditTotalLeave] = React.useState('');
  const [editCarryover, setEditCarryover] = React.useState('');
  const [editLeaveBalance, setEditLeaveBalance] = React.useState('');
  // 사용자 추가 관련 상태
  const [newId, setNewId] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [newRole, setNewRole] = React.useState<'user' | 'admin' | 'manager'>('user');

  const loadUsers = async () => {
    setLoading(true);
    const data = await MockServer.getUsers();
    const historyData = await MockServer.getLoginHistory();
    const onlineData = await MockServer.getOnlineUsers();

    setUsers(data);
    setLoginHistory(historyData.sort((a, b) => b.timestamp - a.timestamp));
    setOnlineUsers(onlineData);
    setLoading(false);
  };

  React.useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName) return;

    try {
      await MockServer.createUser({
        id: newId,
        name: newName,
        email: `${newId}@seastargo.com`,
        role: newRole,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newId}` // Auto generate avatar based on ID
      } as User);
      setShowModal(false);
      setNewId('');
      setNewName('');
      setNewRole('user');
      loadUsers();
      alert('사용자가 추가되었습니다.');
    } catch (error) {
      alert('사용자 추가 실패: ID가 이미 존재할 수 있습니다.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      alert("자기 자신은 삭제할 수 없습니다.");
      return;
    }
    // 김봉정(5) 관리자는 모든 사용자 삭제 권한
    if (confirm("정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      try {
        await MockServer.deleteUser(userId);
        await loadUsers();
        alert('사용자가 삭제되었습니다.');
      } catch (error) {
        alert('사용자 삭제 실패');
      }
    }
  };

  const handleBulkPasswordChange = async () => {
    if (currentUser.id !== '5') {
      alert('모든 사용자 비밀번호 리셋 권한이 없습니다. 김봉정 관리자만 가능합니다.');
      return;
    }
    if (confirm("모든 사용자의 비밀번호를 '1'로 초기화하시겠습니까?")) {
      await MockServer.bulkResetPasswords('1');
      alert("모든 사용자의 비밀번호가 '1'로 변경되었습니다.");
      loadUsers();
    }
  };

  // 비밀번호 리셋 모달 닫기
  const closeResetModal = () => {
    setShowResetModal(false);
    setResetTargetUser(null);
    setNewResetPassword('');
    setResetError('');
  };

  // 비밀번호 리셋 모달 열기
  const openResetModal = (user: User) => {
    if (currentUser.id !== '5') {
      alert('접근 권한이 없습니다.');
      return;
    }
    setShowResetModal(true);
    setResetTargetUser(user);
    setNewResetPassword('');
    setResetError('');
  };

  // 비밀번호 리셋 핸들러
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!resetTargetUser || !newResetPassword || newResetPassword.length < 4) {
      setResetError('비밀번호는 4자리 이상이어야 합니다.');
      return;
    }

    try {
      await MockServer.resetPassword(resetTargetUser.id, newResetPassword, currentUser.id);
      alert(`비밀번호가 '${newResetPassword}'(으)로 초기화되었습니다.`);
      closeResetModal();
      loadUsers();
    } catch (error) {
      setResetError('비밀번호 리셋 중 오류가 발생했습니다.');
    }
  };

  // 연차 수정 모달 열기
  const openLeaveModal = (user: User) => {
    setLeaveTargetUser(user);
    setEditTotalLeave(String(user.totalLeave ?? 0));
    setEditCarryover(String(user.carryover ?? 0));
    setEditLeaveBalance(String(user.leaveBalance ?? 0));
    setShowLeaveModal(true);
  };

  // 연차 수정 모달 닫기
  const closeLeaveModal = () => {
    setShowLeaveModal(false);
    setLeaveTargetUser(null);
    setEditTotalLeave('');
    setEditCarryover('');
    setEditLeaveBalance('');
  };

  // 연차 수정 핸들러
  const handleLeaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveTargetUser) return;

    try {
      await MockServer.updateUser(leaveTargetUser.id, {
        totalLeave: parseFloat(editTotalLeave) || 0,
        carryover: parseFloat(editCarryover) || 0,
        leaveBalance: parseFloat(editLeaveBalance) || 0,
      });
      alert(`${leaveTargetUser.name}님의 연차 정보가 수정되었습니다.`);
      closeLeaveModal();
      loadUsers();
    } catch (error) {
      alert('연차 수정 중 오류가 발생했습니다.');
    }
  };

  if (currentUser.id !== '5') {
    return <div className="p-8 text-center text-red-500">접근 권한이 없습니다. 시스템 설정은 최고 관리자만 접근 가능합니다.</div>;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">사용자 관리</h2>
          <p className="text-slate-500 text-sm">시스템 사용자를 관리하고 권한을 설정합니다.</p>
        </div>
        <div className="flex gap-2">
          {currentUser.id === '5' && (
            <button
              onClick={handleBulkPasswordChange}
              className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold shadow-sm border border-red-200 flex items-center space-x-2 transition-all"
            >
              <KeyRound size={18} />
              <span className="text-sm">PW 일괄변경</span>
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-md shadow-blue-600/20 flex items-center space-x-2 transition-all"
          >
            <Plus size={18} />
            <span>사용자 추가</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-700">전체 사용자 {users.length}명</h3>
          <div className="hidden md:flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            <Search size={14} className="text-slate-400 mr-2" />
            <input type="text" placeholder="이름, ID 검색" className="text-sm outline-none bg-transparent w-full" />
          </div>
        </div>
        <div className="overflow-x-auto pb-4">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">프로필</th>
                <th className="p-4 font-bold">ID</th>
                <th className="p-4 font-bold">이름</th>
                <th className="p-4 font-bold">이메일</th>
                <th className="p-4 font-bold">권한</th>
                <th className="p-4 font-bold">연차</th>
                <th className="p-4 font-bold">상태</th>
                <th className="p-4 font-bold text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">로딩중...</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors text-sm text-slate-700">
                    <td className="p-4">
                      <div className="relative inline-block">
                        <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border border-slate-100" />
                        {onlineUsers.includes(user.id) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-600">{user.id}</td>
                    <td className="p-4 font-bold text-slate-800">{user.name}</td>
                    <td className="p-4 text-slate-600">{user.email}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="text-center">
                          <span className="text-sm font-bold text-blue-600">{user.leaveBalance ?? '-'}</span>
                          <span className="text-xs text-slate-400">/{user.totalLeave ?? '-'}</span>
                        </div>
                        <button
                          onClick={() => openLeaveModal(user)}
                          className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="연차 수정"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.status === 'active' ? 'bg-green-100 text-green-700' :
                        user.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {user.status || 'active'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                        title="사용자 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                      {/* 김봉정 관리자 전용 비밀번호 리셋 버튼 */}
                      {currentUser.id === '5' && (
                        <button
                          onClick={() => openResetModal(user)}
                          className="ml-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                          title="비밀번호 리셋"
                        >
                          <KeyRound size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 비밀번호 리셋 모달 */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => closeResetModal()}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">비밀번호 리셋</h3>
              <button onClick={() => closeResetModal()} className="text-slate-400 hover:text-slate-800">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <KeyRound size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800 mb-1">
                    {resetTargetUser?.name} 사용자
                  </p>
                  <p className="text-sm text-slate-600">
                    비밀번호를 리셋합니다.
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handlePasswordReset} className="space-y-4 px-6 pb-6">
              {resetError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                  {resetError}
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">새 비밀번호</label>
                <input
                  type="password"
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
                  placeholder="4자리 이상으로 입력하세요"
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => closeResetModal()}
                  className="px-4 py-2 rounded-lg text-slate-500 font-bold hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md"
                >
                  리셋
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 연차 수정 모달 */}
      {showLeaveModal && leaveTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeLeaveModal}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 animate-fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">연차 수정</h3>
              <button onClick={closeLeaveModal} className="text-slate-400 hover:text-slate-800">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              {/* 대상 사용자 정보 */}
              <div className="flex items-center gap-4 mb-6 bg-blue-50 rounded-xl p-4">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-200 shrink-0">
                  <img src={leaveTargetUser.avatar} alt={leaveTargetUser.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">{leaveTargetUser.name}</p>
                  <p className="text-sm text-slate-500">{leaveTargetUser.department} · {leaveTargetUser.position}</p>
                </div>
              </div>

              <form onSubmit={handleLeaveUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      <Calendar size={14} className="inline mr-1 text-blue-500" />
                      총 연차
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editTotalLeave}
                      onChange={(e) => setEditTotalLeave(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-center font-bold text-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      <Calendar size={14} className="inline mr-1 text-amber-500" />
                      이월 연차
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editCarryover}
                      onChange={(e) => setEditCarryover(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-center font-bold text-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    <Calendar size={14} className="inline mr-1 text-green-500" />
                    잔여 연차
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editLeaveBalance}
                    onChange={(e) => setEditLeaveBalance(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-center font-bold text-2xl text-green-600"
                  />
                  <p className="text-xs text-slate-400 mt-1 text-center">0.5 단위로 입력 가능합니다</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeLeaveModal}
                    className="px-4 py-2 rounded-lg text-slate-500 font-bold hover:bg-slate-100 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-600/20 flex items-center gap-2 transition-colors"
                  >
                    <Check size={16} />
                    저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
