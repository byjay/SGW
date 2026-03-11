import React from 'react';
import { User } from '../types';
import { MockServer } from '../services/mockServer';
import { Shield, Plus, X, Search, User as UserIcon, Trash2, KeyRound, AlertTriangle, Clock, Calendar, Edit3, Check, Save } from 'lucide-react';

interface AdminUsersProps {
  currentUser: User;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({ currentUser }) => {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loginHistory, setLoginHistory] = React.useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'users' | 'logs'>('users');
  const [activityLogs, setActivityLogs] = React.useState<any[]>([]);

  // Editing state
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<Partial<User>>({});

  // 비밀번호 리셋 관련 상태
  const [showResetModal, setShowResetModal] = React.useState(false);
  const [resetTargetUser, setResetTargetUser] = React.useState<User | null>(null);
  const [newResetPassword, setNewResetPassword] = React.useState('');
  const [resetError, setResetError] = React.useState('');

  // 연차 수정 관련 상태
  const [showLeaveModal, setShowLeaveModal] = React.useState(false);
  const [leaveTargetUser, setLeaveTargetUser] = React.useState<User | null>(null);
  const [editTotalLeave, setEditTotalLeave] = React.useState('');
  const [editLeaveBalance, setEditLeaveBalance] = React.useState('');

  // 사용자 추가 관련 상태
  const [newId, setNewId] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [newDept, setNewDept] = React.useState('');
  const [newPos, setNewPos] = React.useState('');
  const [newRole, setNewRole] = React.useState<'user' | 'admin' | 'manager'>('user');

  const loadData = async () => {
    setLoading(true);
    const data = await MockServer.getUsers();
    const historyData = await MockServer.getLoginHistory();
    const onlineData = await MockServer.getOnlineUsers();
    const logsData = await MockServer.getActivityLogs();

    setUsers(data);
    setLoginHistory(historyData.sort((a: any, b: any) => b.timestamp - a.timestamp));
    setOnlineUsers(onlineData);
    setActivityLogs(logsData);
    setLoading(false);
  };

  React.useEffect(() => {
    loadData();
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
        department: newDept || '미지정',
        position: newPos || '사원',
        joinDate: new Date().toISOString().split('T')[0],
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newId}`
      } as User);
      setShowModal(false);
      setNewId('');
      setNewName('');
      setNewDept('');
      setNewPos('');
      setNewRole('user');
      loadData();
      alert('사용자가 추가되었습니다.');
    } catch (error) {
      alert('사용자 추가 실패');
    }
  };

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setEditForm({ ...user });
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setEditForm({});
  };

  const handleUpdateUser = async () => {
    if (!editingUserId) return;
    try {
      await MockServer.updateUser(editingUserId, editForm);
      alert('사용자 정보가 수정되었습니다.');
      setEditingUserId(null);
      loadData();
    } catch (error) {
      alert('수정 실패');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      alert("자기 자신은 삭제할 수 없습니다.");
      return;
    }
    if (confirm("정말로 이 사용자를 삭제하시겠습니까?")) {
      await MockServer.deleteUser(userId);
      await loadData();
      alert('사용자가 삭제되었습니다.');
    }
  };

  const handleBulkPasswordChange = async () => {
    if (confirm("모든 사용자의 비밀번호를 '1'로 초기화하시겠습니까?")) {
      await MockServer.bulkResetPasswords('1');
      alert("비밀번호가 초기화되었습니다.");
      loadData();
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (currentUser.id !== '5') {
    return <div className="p-8 text-center text-red-500">접근 권한이 없습니다. 시스템 설정은 최고 관리자만 접근 가능합니다.</div>;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">시스템 설정</h2>
          <p className="text-slate-500 text-sm">시스템 사용자를 관리하고 모든 활동 로그를 모니터링합니다.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex mr-4">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              사용자 관리
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              활동 로그
            </button>
          </div>
          {activeTab === 'users' && (
            <>
              <button
                onClick={handleBulkPasswordChange}
                className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold border border-red-200 flex items-center space-x-2"
              >
                <KeyRound size={18} />
                <span className="text-sm">PW 일괄변경</span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-md shadow-blue-600/20 flex items-center space-x-2"
              >
                <Plus size={18} />
                <span>사용자 추가</span>
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-700">전체 사용자 {filteredUsers.length}명</h3>
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-64">
              <Search size={14} className="text-slate-400 mr-2" />
              <input
                type="text"
                placeholder="이름, ID, 부서 검색"
                className="text-sm outline-none bg-transparent w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold">프로필</th>
                  <th className="p-4 font-bold">ID</th>
                  <th className="p-4 font-bold">이름</th>
                  <th className="p-4 font-bold">직급</th>
                  <th className="p-4 font-bold">부서</th>
                  <th className="p-4 font-bold">권한</th>
                  <th className="p-4 font-bold">연차</th>
                  <th className="p-4 font-bold text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">로딩중...</td></tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors text-sm text-slate-700">
                      <td className="p-4">
                        <div className="relative inline-block">
                          <img src={user.avatar} className="w-10 h-10 rounded-full border border-slate-100" />
                          {onlineUsers.includes(user.id) && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-medium text-slate-500">{user.id}</td>
                      <td className="p-4">
                        {editingUserId === user.id ? (
                          <input
                            className="px-2 py-1 border border-blue-400 rounded w-24 text-sm"
                            value={editForm.name || ''}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          />
                        ) : (
                          <span className="font-bold text-slate-800">{user.name}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {editingUserId === user.id ? (
                          <input
                            className="px-2 py-1 border border-blue-400 rounded w-20 text-sm"
                            value={editForm.position || ''}
                            onChange={e => setEditForm({ ...editForm, position: e.target.value })}
                          />
                        ) : (
                          <span className="text-blue-600 font-medium">{user.position}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {editingUserId === user.id ? (
                          <input
                            className="px-2 py-1 border border-blue-400 rounded w-24 text-sm"
                            value={editForm.department || ''}
                            onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                          />
                        ) : (
                          <span>{user.department}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {editingUserId === user.id ? (
                          <select
                            className="px-2 py-1 border border-blue-400 rounded text-sm"
                            value={editForm.role}
                            onChange={e => setEditForm({ ...editForm, role: e.target.value as any })}
                          >
                            <option value="user">USER</option>
                            <option value="manager">MANAGER</option>
                            <option value="admin">ADMIN</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded text-[10px] font-black tracking-tighter ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {user.role.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-600">{user.leaveBalance ?? 0}</span>
                          <span className="text-slate-400">/{user.totalLeave ?? 0}</span>
                          <button onClick={() => { setLeaveTargetUser(user); setShowLeaveModal(true); setEditTotalLeave(String(user.totalLeave || 0)); setEditLeaveBalance(String(user.leaveBalance || 0)); }} className="text-slate-300 hover:text-blue-600"><Edit3 size={12} /></button>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {editingUserId === user.id ? (
                          <div className="flex justify-end gap-1">
                            <button onClick={handleUpdateUser} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"><Save size={14} /></button>
                            <button onClick={cancelEditing} className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => startEditing(user)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit3 size={16} /></button>
                            <button onClick={() => { setResetTargetUser(user); setShowResetModal(true); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"><KeyRound size={16} /></button>
                            <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-700">전체 활동 로그 {activityLogs.length}건</h3>
            <button onClick={loadData} className="text-xs text-blue-600 font-bold hover:underline">새로고침</button>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider z-10">
                <tr>
                  <th className="p-4 font-bold w-48">일시</th>
                  <th className="p-4 font-bold w-40">사용자</th>
                  <th className="p-4 font-bold w-32">활동 유형</th>
                  <th className="p-4 font-bold">상세 내용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activityLogs.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">활동 기록이 없습니다.</td></tr>
                ) : (
                  activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors text-xs text-slate-700">
                      <td className="p-4 text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{log.userName}</span>
                          <span className="text-slate-400">({log.userId})</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${log.type === '로그인' ? 'bg-green-100 text-green-700' :
                          log.type === '비밀번호 변경' ? 'bg-amber-100 text-amber-700' :
                            log.type === '쪽지 발송' ? 'bg-blue-100 text-blue-700' :
                              log.type === '출근' || log.type === '퇴근' ? 'bg-purple-100 text-purple-700' :
                                'bg-slate-100 text-slate-600'
                          }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 italic">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 p-6">
            <h3 className="text-xl font-bold mb-6">사용자 추가</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">ID</label>
                <input value={newId} onChange={e => setNewId(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">이름</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">직급</label>
                  <input value={newPos} onChange={e => setNewPos(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none" placeholder="사원/주임/부장 등" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">부서</label>
                  <input value={newDept} onChange={e => setNewDept(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none" placeholder="서무/전장 등" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">권한</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none">
                  <option value="user">사용자 (USER)</option>
                  <option value="manager">관리자 (MANAGER)</option>
                  <option value="admin">최고관리자 (ADMIN)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">취소</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700">추가하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {showLeaveModal && leaveTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLeaveModal(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 p-6">
            <h3 className="text-xl font-bold mb-4">{leaveTargetUser.name} 연차 수정</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">총 연차</label>
                <input type="number" step="0.5" value={editTotalLeave} onChange={e => setEditTotalLeave(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">잔여 연차</label>
                <input type="number" step="0.5" value={editLeaveBalance} onChange={e => setEditLeaveBalance(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-blue-600 font-bold" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowLeaveModal(false)} className="px-4 py-2 text-slate-500">취소</button>
                <button onClick={async () => {
                  await MockServer.updateUser(leaveTargetUser.id, { totalLeave: parseFloat(editTotalLeave), leaveBalance: parseFloat(editLeaveBalance) });
                  setShowLeaveModal(false);
                  loadData();
                }} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">저장</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset PWD Modal */}
      {showResetModal && resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowResetModal(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 p-6">
            <h3 className="text-xl font-bold mb-4">비밀번호 강제 변경</h3>
            <p className="text-sm text-slate-500 mb-4">{resetTargetUser.name}님의 비밀번호를 재설정합니다.</p>
            <input
              type="text"
              placeholder="새 비밀번호 입력"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg mb-4"
              value={newResetPassword}
              onChange={e => setNewResetPassword(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowResetModal(false)} className="px-4 py-2 text-slate-500">취소</button>
              <button onClick={async () => {
                if (!newResetPassword) return;
                await MockServer.resetPassword(resetTargetUser.id, newResetPassword, currentUser.id);
                alert('비밀번호가 변경되었습니다.');
                setShowResetModal(false);
                setNewResetPassword('');
                loadData();
              }} className="px-4 py-2 bg-amber-500 text-white rounded-lg font-bold">변경하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
