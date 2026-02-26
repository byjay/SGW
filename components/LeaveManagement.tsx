import React from 'react';
import { User, LeaveRequest, LeaveType } from '../types';
import { MockServer } from '../services/mockServer';
import { Calendar, Clock, PieChart, Plus, X, Search, Check, AlertCircle, ChevronLeft, ChevronRight, Download, ArrowUpDown } from 'lucide-react';

interface LeaveManagementProps {
  currentUser: User;
}

export const LeaveManagement: React.FC<LeaveManagementProps> = ({ currentUser }) => {
  const [requests, setRequests] = React.useState<LeaveRequest[]>([]);
  const [allRequests, setAllRequests] = React.useState<LeaveRequest[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [showModal, setShowModal] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [leaveBalance, setLeaveBalance] = React.useState(15);
  const [totalLeave, setTotalLeave] = React.useState(15);
  const [carryover, setCarryover] = React.useState(0);
  
  // Sort State
  const [sortBy, setSortBy] = React.useState<'date' | 'name'>('date');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = React.useState<'my' | 'all'>('my');
  const [tableViewMode, setTableViewMode] = React.useState<'list' | 'summary'>('list');
  const [editingRequest, setEditingRequest] = React.useState<LeaveRequest | null>(null);
  
  // Calendar State
  const [calendarDate, setCalendarDate] = React.useState(new Date());
  
  // Form State
  const [leaveType, setLeaveType] = React.useState<LeaveType>('annual');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [leaveDays, setLeaveDays] = React.useState<number>(1);

  const loadRequests = async () => {
    setLoading(true);
    const data = await MockServer.getLeaveRequests();
    const allUsers = await MockServer.getUsers();
    setUsers(allUsers);
    const me = allUsers.find(u => u.id === currentUser.id);
    if (me) {
        setLeaveBalance(me.leaveBalance || 15);
        setTotalLeave(me.totalLeave || 15);
        setCarryover(me.carryover || 0);
    }
    const isAdminOrManager = ['1', '2', '5'].includes(currentUser.id);
    setAllRequests(data); // All requests for admin
    
    let filteredData = (isAdminOrManager && viewMode === 'all') ? data : data.filter(r => r.userId === currentUser.id);
    
    // Sort logic
    filteredData.sort((a, b) => {
        if (sortBy === 'date') {
            return sortOrder === 'desc' 
                ? new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
                : new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        } else {
            return sortOrder === 'desc'
                ? b.userName.localeCompare(a.userName)
                : a.userName.localeCompare(b.userName);
        }
    });

    setRequests(filteredData);
    setLoading(false);
  };

  React.useEffect(() => {
    loadRequests();
  }, [currentUser.id, sortBy, sortOrder, viewMode]);

  const handleSort = (type: 'date' | 'name') => {
      if (sortBy === type) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
          setSortBy(type);
          setSortOrder('desc');
      }
  };

  const handleExportExcel = () => {
      // Create CSV content
      const headers = ['상태', '신청자', '종류', '시작일', '종료일', '사용일수', '잔여연차', '신청일'];
      const csvContent = [
          headers.join(','),
          ...requests.map(req => {
              const user = users.find(u => u.id === req.userId);
              const remaining = user ? user.leaveBalance : '-';
              return [
                  getStatusText(req.status),
                  req.userName,
                  getTypeText(req.type),
                  req.startDate,
                  req.endDate,
                  req.days,
                  remaining,
                  new Date(req.requestDate).toLocaleDateString()
              ].join(',');
          })
      ].join('\n');

      // Download file
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `연차내역_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

      const handleOpenModal = () => {
      // Set default date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const y = tomorrow.getFullYear();
      const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const d = String(tomorrow.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      
      setEditingRequest(null);
      setStartDate(dateStr);
      setEndDate(dateStr);
      setLeaveType('annual');
      setLeaveDays(1);
      setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    if (editingRequest) {
        await MockServer.updateLeaveRequest(editingRequest.id, {
            type: leaveType,
            startDate,
            endDate,
            days: leaveDays
        });
        alert('연차 내역이 수정되었습니다.');
    } else {
        await MockServer.createLeaveRequest(
            currentUser.id,
            currentUser.name,
            leaveType,
            startDate,
            endDate,
            '', // reason removed
            ''  // emergency contact removed
        );
        alert(currentUser.id === '2' ? '휴가가 자동 승인되었습니다.' : '휴가 신청이 완료되었습니다. 이선우(부장)님의 결재 대기 중입니다.');
    }

    setShowModal(false);
    setEditingRequest(null);
    loadRequests();
  };

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
      await MockServer.approveLeaveRequest(id, status);
      loadRequests();
  };

  // Stats Calculation
  const remainingLeave = leaveBalance;
  const usedLeave = totalLeave - remainingLeave;
  const baseLeave = totalLeave - carryover;

  // Calculate running balances for the table
  const userBalances: Record<string, number> = {};
  users.forEach(u => {
      userBalances[u.id] = u.totalLeave || 15; // Start with total leave
  });

  // Sort ALL requests ascending by date to calculate running balance
  const sortedAllRequests = [...allRequests].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  
  const requestBalances: Record<string, number> = {};
  sortedAllRequests.forEach(req => {
      if (req.status !== 'rejected') {
          if (userBalances[req.userId] !== undefined) {
              userBalances[req.userId] -= req.days;
              requestBalances[req.id] = userBalances[req.userId];
          }
      }
  });

  // Generate Summary Data
  const summaryData = users.map(user => {
      const userRequests = allRequests.filter(r => r.userId === user.id && r.status === 'approved');
      const usedSum = userRequests.reduce((sum, r) => sum + r.days, 0);
      const remainingSum = (user.totalLeave || 15) - usedSum;
      
      const monthlyData: Record<number, { sum: number, details: string[] }> = {};
      for (let i = 1; i <= 12; i++) {
          monthlyData[i] = { sum: 0, details: [] };
      }

      // Sort user requests by date
      userRequests.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      userRequests.forEach(req => {
          const d = new Date(req.startDate);
          const month = d.getMonth() + 1;
          const date = d.getDate();
          monthlyData[month].sum += req.days;
          monthlyData[month].details.push(`${date}(${req.days})`);
      });

      return {
          user,
          usedSum,
          remainingSum,
          monthlyData
      };
  });

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'approved': return 'bg-green-100 text-green-700';
          case 'rejected': return 'bg-red-100 text-red-700';
          default: return 'bg-yellow-100 text-yellow-700';
      }
  };

  const getStatusText = (status: string) => {
      switch(status) {
          case 'approved': return '승인됨';
          case 'rejected': return '반려됨';
          default: return '결재 대기';
      }
  };

  const getTypeText = (type: LeaveType) => {
      switch(type) {
          case 'annual': return '연차';
          case 'morning_half': return '오전 반차';
          case 'afternoon_half': return '오후 반차';
          case 'sick': return '병가';
          case 'event': return '경조사';
          case 'family': return '가족돌봄';
          default: return type;
      }
  };

  // --- Calendar Logic ---
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  const handlePrevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCalendarDate(new Date(year, month + 1, 1));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const days = [];
  
  // Padding
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  // Days
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

  const getDailyLeaves = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      // Show ALL requests for admin/everyone to see availability, or just mine?
      // Usually leave calendar shows everyone's approved leaves.
      // Showing user's own requests (pending + approved) + others approved.
      return allRequests.filter(r => {
          if (r.status === 'rejected') return false;
          // For others: only show approved
          if (r.userId !== currentUser.id && r.status !== 'approved') return false;
          
          return dateStr >= r.startDate && dateStr <= r.endDate;
      });
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">휴가 신청</h2>
            <p className="text-slate-500 text-sm">총 연차 {totalLeave}일 기준 / 결재권자: 이선우(부장)</p>
          </div>
          <button 
            onClick={handleOpenModal}
            className="mt-4 md:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-blue-600/20 flex items-center space-x-2 transition-all"
          >
              <Plus size={18}/>
              <span>연차 신청</span>
          </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <p className="text-xs font-bold text-slate-500 mb-0.5">발생 연차</p>
              <p className="text-xl font-bold text-slate-800">{baseLeave}일</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <p className="text-xs font-bold text-slate-500 mb-0.5">작년 정산 (이월/차감)</p>
              <p className={`text-xl font-bold ${carryover > 0 ? 'text-blue-600' : carryover < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {carryover > 0 ? `+${carryover}` : carryover}일
              </p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <p className="text-xs font-bold text-slate-500 mb-0.5">올해 총 연차</p>
              <p className="text-xl font-bold text-slate-800">{totalLeave}일</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <p className="text-xs font-bold text-slate-500 mb-0.5">사용 연차</p>
              <p className="text-xl font-bold text-slate-800">{usedLeave}일</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-center col-span-2 md:col-span-1">
              <p className="text-xs font-bold text-blue-600 mb-0.5">잔여 연차</p>
              <p className="text-xl font-bold text-blue-700">{remainingLeave}일</p>
          </div>
      </div>

      {/* NEW: Leave Calendar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <Calendar size={18} className="text-blue-600"/>
                  휴가 현황 캘린더
              </h3>
              <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-slate-800">{year}년 {month + 1}월</span>
                  <div className="flex space-x-1">
                      <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><ChevronLeft size={20}/></button>
                      <button onClick={handleNextMonth} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><ChevronRight size={20}/></button>
                  </div>
              </div>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <div key={d} className={`py-2 text-center text-xs font-bold ${i===0?'text-red-500':i===6?'text-blue-500':'text-slate-500'}`}>
                      {d}
                  </div>
              ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-[60px] md:auto-rows-[80px]">
              {days.map((d, idx) => {
                  if (!d) return <div key={idx} className="bg-slate-50/30 border-b border-r border-slate-100"></div>;
                  
                  const dayLeaves = getDailyLeaves(d);
                  const isToday = new Date().toDateString() === d.toDateString();

                  return (
                      <div key={idx} className={`p-1 border-b border-r border-slate-100 relative ${isToday ? 'bg-blue-50/30' : ''}`}>
                          <span className={`text-[10px] md:text-xs font-bold ${d.getDay()===0?'text-red-500':d.getDay()===6?'text-blue-500':'text-slate-700'} ${isToday ? 'bg-blue-600 text-white w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full' : ''}`}>
                              {d.getDate()}
                          </span>
                          <div className="mt-0.5 space-y-0.5 overflow-y-auto max-h-[40px] md:max-h-[50px] scrollbar-hide">
                              {dayLeaves.map(r => (
                                  <div 
                                    key={r.id} 
                                    className={`text-[9px] md:text-[10px] px-1 py-0.5 rounded truncate font-medium ${
                                        r.userId === currentUser.id 
                                        ? (r.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700')
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                      {r.userName} {getTypeText(r.type)}
                                  </div>
                              ))}
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>

      {/* ADMIN SECTION: Approval List */}
      {currentUser.id === '2' && (
          <div className="bg-orange-50 rounded-2xl border border-orange-200 p-6">
              <h3 className="text-lg font-bold text-orange-800 mb-4 flex items-center">
                  <AlertCircle size={20} className="mr-2"/>
                  연차 결재 대기 목록
              </h3>
              <div className="overflow-x-auto bg-white rounded-xl border border-orange-100">
                  <table className="w-full text-left">
                      <thead className="bg-orange-100/50 text-orange-800 text-xs uppercase">
                          <tr>
                              <th className="p-3">신청자</th>
                              <th className="p-3">종류</th>
                              <th className="p-3">기간</th>
                              <th className="p-3 text-right">승인관리</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100 text-sm">
                          {allRequests.filter(r => r.status === 'pending').length === 0 ? (
                              <tr><td colSpan={4} className="p-4 text-center text-slate-400">대기 중인 결재가 없습니다.</td></tr>
                          ) : (
                              allRequests.filter(r => r.status === 'pending').map(req => (
                                  <tr key={req.id}>
                                      <td className="p-3 font-bold">{req.userName}</td>
                                      <td className="p-3">{getTypeText(req.type)}</td>
                                      <td className="p-3">{req.startDate} ~ {req.endDate} ({req.days}일)</td>
                                      <td className="p-3 text-right space-x-2">
                                          <button onClick={() => handleApprove(req.id, 'approved')} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-xs">승인</button>
                                          <button onClick={() => handleApprove(req.id, 'rejected')} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs">반려</button>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-6 mb-3 gap-3">
          <div className="flex items-center gap-4">
              <h3 className="text-lg font-bold text-slate-800">
                  {['1', '2', '5'].includes(currentUser.id) && viewMode === 'all' ? '전체 연차 내역' : '나의 연차 내역'}
              </h3>
              {['1', '2', '5'].includes(currentUser.id) && (
                  <>
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                          <button 
                              onClick={() => setViewMode('my')}
                              className={`px-3 py-1 text-sm font-bold rounded-md transition-all ${viewMode === 'my' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              내 연차
                          </button>
                          <button 
                              onClick={() => setViewMode('all')}
                              className={`px-3 py-1 text-sm font-bold rounded-md transition-all ${viewMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              전체 연차
                          </button>
                      </div>
                      {viewMode === 'all' && (
                          <div className="flex bg-slate-100 p-1 rounded-lg ml-2">
                              <button 
                                  onClick={() => setTableViewMode('list')}
                                  className={`px-3 py-1 text-sm font-bold rounded-md transition-all ${tableViewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                              >
                                  리스트 보기
                              </button>
                              <button 
                                  onClick={() => setTableViewMode('summary')}
                                  className={`px-3 py-1 text-sm font-bold rounded-md transition-all ${tableViewMode === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                              >
                                  요약 보기
                              </button>
                          </div>
                      )}
                  </>
              )}
          </div>
          {['1', '2', '5'].includes(currentUser.id) && viewMode === 'all' && tableViewMode === 'list' && (
              <button 
                onClick={handleExportExcel}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center space-x-2 transition-all text-sm"
              >
                  <Download size={16}/>
                  <span>엑셀 다운로드</span>
              </button>
          )}
      </div>

      {/* My List Table */}
      {viewMode === 'all' && tableViewMode === 'summary' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse text-xs whitespace-nowrap">
                      <thead>
                          <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                              <th className="p-2 border-r border-slate-300">연번</th>
                              <th className="p-2 border-r border-slate-300">소속</th>
                              <th className="p-2 border-r border-slate-300">성명</th>
                              <th className="p-2 border-r border-slate-300">직급</th>
                              <th className="p-2 border-r border-slate-300">입사일</th>
                              <th className="p-2 border-r border-slate-300">연차 갯수</th>
                              <th className="p-2 border-r border-slate-300 text-red-600">사용 합계</th>
                              <th className="p-2 border-r border-slate-300 text-blue-600">잔여 합계</th>
                              <th className="p-2 border-r border-slate-300">작년 정산</th>
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                  <th key={m} className="p-2 border-r border-slate-300 w-20">{m}월</th>
                              ))}
                          </tr>
                      </thead>
                      <tbody>
                          {summaryData.map((row, idx) => (
                              <React.Fragment key={row.user.id}>
                                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                                      <td className="p-2 border-r border-slate-200 font-medium" rowSpan={2}>{idx + 1}</td>
                                      <td className="p-2 border-r border-slate-200" rowSpan={2}>{row.user.department || '-'}</td>
                                      <td className="p-2 border-r border-slate-200 font-bold" rowSpan={2}>{row.user.name}</td>
                                      <td className="p-2 border-r border-slate-200" rowSpan={2}>{row.user.position || '-'}</td>
                                      <td className="p-2 border-r border-slate-200" rowSpan={2}>{row.user.joinDate || '-'}</td>
                                      <td className="p-2 border-r border-slate-200 font-bold" rowSpan={2}>{row.user.totalLeave || 15}</td>
                                      <td className="p-2 border-r border-slate-200 font-bold text-red-500 bg-red-50/30" rowSpan={2}>{row.usedSum}</td>
                                      <td className="p-2 border-r border-slate-200 font-bold text-blue-600 bg-blue-50/30" rowSpan={2}>{row.remainingSum}</td>
                                      <td className="p-2 border-r border-slate-200 text-red-500 font-bold" rowSpan={2}>
                                          {row.user.carryover ? (row.user.carryover > 0 ? `${row.user.carryover}+` : `${Math.abs(row.user.carryover)}-`) : ''}
                                      </td>
                                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                          <td key={m} className="p-1 border-r border-b border-slate-200 text-red-500 font-bold h-8 align-middle">
                                              {row.monthlyData[m].sum > 0 ? row.monthlyData[m].sum : ''}
                                          </td>
                                      ))}
                                  </tr>
                                  <tr className="border-b border-slate-300 hover:bg-slate-50">
                                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                          <td key={m} className="p-1 border-r border-slate-200 text-[10px] text-slate-600 h-8 align-middle">
                                              {row.monthlyData[m].details.join('/')}
                                          </td>
                                      ))}
                                  </tr>
                              </React.Fragment>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="p-4 font-bold">상태</th>
                          {['1', '2', '5'].includes(currentUser.id) && (
                              <th className="p-4 font-bold cursor-pointer hover:text-slate-800" onClick={() => handleSort('name')}>
                                  <div className="flex items-center">신청자 <ArrowUpDown size={12} className="ml-1"/></div>
                              </th>
                          )}
                          <th className="p-4 font-bold">종류</th>
                          <th className="p-4 font-bold cursor-pointer hover:text-slate-800" onClick={() => handleSort('date')}>
                              <div className="flex items-center">기간 <ArrowUpDown size={12} className="ml-1"/></div>
                          </th>
                          <th className="p-4 font-bold">사용일수</th>
                          <th className="p-4 font-bold">잔여연차</th>
                          <th className="p-4 font-bold">신청일</th>
                          {['2', '5'].includes(currentUser.id) && <th className="p-4 font-bold text-right">관리</th>}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {loading ? (
                          <tr><td colSpan={['1', '2', '5'].includes(currentUser.id) ? (viewMode === 'all' ? 8 : 6) : 6} className="p-8 text-center text-slate-400">로딩중...</td></tr>
                      ) : requests.length === 0 ? (
                          <tr><td colSpan={['1', '2', '5'].includes(currentUser.id) ? (viewMode === 'all' ? 8 : 6) : 6} className="p-12 text-center text-slate-400">내역이 없습니다.</td></tr>
                      ) : (
                          requests.map((req) => {
                              const user = users.find(u => u.id === req.userId);
                              return (
                                  <tr key={req.id} className="hover:bg-slate-50 transition-colors text-sm text-slate-700">
                                      <td className="p-4">
                                          <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(req.status)}`}>
                                              {getStatusText(req.status)}
                                          </span>
                                      </td>
                                      {['1', '2', '5'].includes(currentUser.id) && viewMode === 'all' && <td className="p-4 font-bold">{req.userName}</td>}
                                      <td className="p-4 font-bold">{getTypeText(req.type)}</td>
                                      <td className="p-4 text-slate-500">
                                          {req.startDate} ~ {req.endDate}
                                      </td>
                                      <td className="p-4">{req.days}일</td>
                                      <td className="p-4 font-bold text-blue-600">{requestBalances[req.id] !== undefined ? requestBalances[req.id] : '-'}일</td>
                                      <td className="p-4 text-slate-400">
                                          {new Date(req.requestDate).toLocaleDateString()}
                                      </td>
                                      {['1', '2', '5'].includes(currentUser.id) && (
                                          <td className="p-4 text-right">
                                              <button 
                                                  onClick={() => {
                                                      const pwd = prompt('수정 권한 확인을 위해 비밀번호를 입력하세요:');
                                                      if (pwd === currentUser.password) {
                                                          setEditingRequest(req);
                                                          setLeaveType(req.type);
                                                          setStartDate(req.startDate);
                                                          setEndDate(req.endDate);
                                                          setLeaveDays(req.days);
                                                          setShowModal(true);
                                                      } else if (pwd !== null) {
                                                          alert('비밀번호가 일치하지 않습니다.');
                                                      }
                                                  }}
                                                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold transition-colors"
                                              >
                                                  수정
                                              </button>
                                          </td>
                                      )}
                                  </tr>
                              );
                          })
                      )}
                  </tbody>
              </table>
          </div>
      </div>
      )}

      {/* Request Modal */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 animate-fade-in flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">{editingRequest ? '휴가 내역 수정' : '휴가 신청'}</h3>
                        <p className="text-sm text-slate-500">{editingRequest ? `${editingRequest.userName}님의 내역 수정` : '결재권자: 이선우(부장)'}</p>
                      </div>
                      <button onClick={() => { setShowModal(false); setEditingRequest(null); }} className="text-slate-400 hover:text-slate-800">
                          <X size={24}/>
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto">
                      <form onSubmit={handleSubmit} className="space-y-6">
                          <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700">휴가 종류</label>
                              <div className="grid grid-cols-3 gap-2">
                                  {['annual', 'morning_half', 'afternoon_half', 'sick', 'event', 'family'].map((t) => (
                                      <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                            setLeaveType(t as LeaveType);
                                            if (t.includes('half')) {
                                                setLeaveDays(0.5);
                                                setEndDate(startDate);
                                            } else {
                                                setLeaveDays(1);
                                                if (startDate) {
                                                    const start = new Date(startDate);
                                                    setEndDate(start.toISOString().split('T')[0]);
                                                }
                                            }
                                        }}
                                        className={`py-2 px-1 text-sm rounded-lg border font-medium transition-all ${
                                            leaveType === t 
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' 
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                      >
                                          {getTypeText(t as LeaveType)}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">시작일</label>
                                  <input 
                                    type="date" 
                                    required
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        if (leaveType.includes('half')) {
                                            setEndDate(e.target.value);
                                        } else {
                                            const start = new Date(e.target.value);
                                            start.setDate(start.getDate() + leaveDays - 1);
                                            setEndDate(start.toISOString().split('T')[0]);
                                        }
                                    }}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-sm font-bold text-slate-700">일수</label>
                                  <select 
                                    value={leaveDays}
                                    onChange={(e) => {
                                        const days = parseInt(e.target.value);
                                        setLeaveDays(days);
                                        if (startDate && !leaveType.includes('half')) {
                                            const start = new Date(startDate);
                                            start.setDate(start.getDate() + days - 1);
                                            setEndDate(start.toISOString().split('T')[0]);
                                        }
                                    }}
                                    disabled={leaveType.includes('half')}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400"
                                  >
                                      {leaveType.includes('half') ? (
                                          <option value={0.5}>0.5일 (반차)</option>
                                      ) : (
                                          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => (
                                              <option key={d} value={d}>{d}일</option>
                                          ))
                                      )}
                                  </select>
                              </div>
                          </div>
                          
                          <div className="pt-2 flex justify-end space-x-3">
                              <button 
                                type="button" 
                                onClick={() => { setShowModal(false); setEditingRequest(null); }}
                                className="px-5 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-colors"
                              >
                                  취소
                              </button>
                              <button 
                                type="submit"
                                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all flex items-center"
                              >
                                  <Calendar size={18} className="mr-2"/>
                                  {editingRequest ? '수정 완료' : '신청하기'}
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