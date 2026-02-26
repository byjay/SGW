import React from 'react';
import { User } from '../types';
import { MockServer } from '../services/mockServer';
import { Shield, Plus, X, Search, User as UserIcon, Trash2, KeyRound, AlertTriangle } from 'lucide-react';

interface AdminUsersProps {
  currentUser: User;
}

export const AdminUsers: React.FC<AdminUsersProps> = ({ currentUser }) => {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);

  // New User Form State
  const [newId, setNewId] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [newRole, setNewRole] = React.useState<'user'|'admin'>('user');

  const loadUsers = async () => {
    setLoading(true);
    const data = await MockServer.getUsers();
    setUsers(data);
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
            role: newRole,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newId}` // Auto generate avatar based on ID
        });
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
      if (confirm("정말로 이 사용자를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) {
          await MockServer.deleteUser(userId);
          loadUsers();
      }
  };

  const handleBulkPasswordChange = async () => {
      if (confirm("모든 사용자의 비밀번호를 '1234'로 초기화하시겠습니까?")) {
          await MockServer.bulkResetPasswords('1234');
          alert("모든 사용자의 비밀번호가 '1234'로 변경되었습니다.");
          loadUsers();
      }
  };

  if (!['2', '5'].includes(currentUser.id)) { // Check ID strictly
      return <div className="p-8 text-center text-red-500 font-bold">접근 권한이 없습니다. (관리자 전용)</div>;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">사용자 관리</h2>
            <p className="text-slate-500 text-sm">시스템 사용자를 관리하고 권한을 설정합니다.</p>
          </div>
          <div className="flex gap-2">
            <button 
                onClick={handleBulkPasswordChange}
                className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold shadow-sm border border-red-200 flex items-center space-x-2 transition-all"
            >
                <KeyRound size={18}/>
                <span className="text-sm">PW 일괄변경</span>
            </button>
            <button 
                onClick={() => setShowModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-md shadow-blue-600/20 flex items-center space-x-2 transition-all"
            >
                <Plus size={18}/>
                <span>사용자 추가</span>
            </button>
          </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700">전체 사용자 {users.length}명</h3>
            <div className="hidden md:flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                 <Search size={14} className="text-slate-400 mr-2"/>
                 <input type="text" placeholder="이름, ID 검색" className="text-sm outline-none bg-transparent"/>
             </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-bold">프로필</th>
                        <th className="p-4 font-bold">ID</th>
                        <th className="p-4 font-bold">이름</th>
                        <th className="p-4 font-bold">이메일</th>
                        <th className="p-4 font-bold">권한</th>
                        <th className="p-4 font-bold">프로젝트</th>
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
                                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border border-slate-100" />
                                </td>
                                <td className="p-4 font-medium text-slate-600">{user.id}</td>
                                <td className="p-4 font-bold text-slate-800">{user.name}</td>
                                <td className="p-4 text-slate-600">{user.email}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-600 max-w-xs truncate" title={user.projectScope}>{user.projectScope}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        user.status === 'active' ? 'bg-green-100 text-green-700' : 
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
                                        <Trash2 size={16}/>
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 animate-fade-in">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-800">사용자 추가</h3>
                      <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800">
                          <X size={24}/>
                      </button>
                  </div>
                  <form onSubmit={handleAddUser} className="p-6 space-y-4">
                      <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">사용자 ID</label>
                          <input 
                            type="text" 
                            required
                            value={newId}
                            onChange={(e) => setNewId(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
                            placeholder="user123"
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">이름</label>
                          <input 
                            type="text" 
                            required
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
                            placeholder="홍길동"
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">권한</label>
                          <select 
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none bg-white"
                          >
                              <option value="user">일반 사용자 (USER)</option>
                              <option value="admin">관리자 (ADMIN)</option>
                          </select>
                      </div>
                      <div className="pt-4 flex justify-end space-x-3">
                          <button 
                            type="button" 
                            onClick={() => setShowModal(false)}
                            className="px-4 py-2 rounded-lg text-slate-500 font-bold hover:bg-slate-100"
                          >
                              취소
                          </button>
                          <button 
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md"
                          >
                              추가하기
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};