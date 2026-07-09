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
    const [viewMode, setViewMode] = React.useState<'my' | 'all'>(currentUser.role === 'admin' ? 'all' : 'my');
    const [tableViewMode, setTableViewMode] = React.useState<'list' | 'summary'>('list');
    const [filterUserId, setFilterUserId] = React.useState<string>('all');
    const [filterYearMonth, setFilterYearMonth] = React.useState<string>('all');
    const [availableYearMonths, setAvailableYearMonths] = React.useState<string[]>([]);
    const [editingRequest, setEditingRequest] = React.useState<LeaveRequest | null>(null);
    const [detailRequest, setDetailRequest] = React.useState<LeaveRequest | null>(null);
    const [showListSheet, setShowListSheet] = React.useState(false); // 모바일 리스트 바텀시트
    const isPartTime = !!currentUser.isPartTime; // 아르바이트 — 연차 대신 출근/쉬는날

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
        const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager';
        setAllRequests(data); // All requests for admin

        let filteredData = (isAdminOrManager && viewMode === 'all') ? data : data.filter(r => r.userId === currentUser.id);

        // Extract available year-months
        const yms = new Set<string>();
        filteredData.forEach(r => yms.add(r.startDate.substring(0, 7)));
        setAvailableYearMonths(Array.from(yms).sort((a, b) => b.localeCompare(a)));

        // Apply Filters
        if (filterUserId !== 'all') {
            filteredData = filteredData.filter(r => r.userId === filterUserId);
        }
        if (filterYearMonth !== 'all') {
            filteredData = filteredData.filter(r => r.startDate.startsWith(filterYearMonth));
        }

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
    }, [currentUser.id, sortBy, sortOrder, viewMode, filterUserId, filterYearMonth]);

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

    const handleExportSummaryExcel = () => {
        const headers = ['연번', '소속', '성명', '직급', '입사일', '총연차', '사용합계', '잔여합계', '작년정산', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        const csvContent = [
            headers.join(','),
            ...summaryData.map((row, idx) => {
                return [
                    idx + 1,
                    row.user.department || '-',
                    row.user.name,
                    row.user.position || '-',
                    row.user.joinDate || '-',
                    row.user.totalLeave || 15,
                    row.usedSum,
                    row.remainingSum,
                    row.user.carryover || 0,
                    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => row.monthlyData[m].sum || 0)
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `연차요약_${new Date().toISOString().split('T')[0]}.csv`);
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
        setLeaveType(isPartTime ? 'dayoff' : 'annual');
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
            }, currentUser.id);
            alert(isPartTime ? '근무 내역이 수정되었습니다.' : '연차 내역이 수정되었습니다.');
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
            alert(isPartTime ? '근무 일정이 등록되었습니다.' : '연차가 자동 승인되었습니다. (관리자에게 알림이 발송되었습니다.)');
        }

        setShowModal(false);
        setEditingRequest(null);
        loadRequests();
    };

    const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
        const req = allRequests.find(r => r.id === id);
        if (req?.status === 'pending_delete' && status === 'approved') {
            await MockServer.deleteLeaveRequest(id, '5'); // Kim Bong-jeong/Manager level bypass
        } else {
            await MockServer.approveLeaveRequest(id, status);
        }
        loadRequests();
    };

    // Stats Calculation — 실제 승인된 연차 기록 합계 기준(단일 진실원천)
    const usedLeave = allRequests
        .filter(r => r.userId === currentUser.id && r.status === 'approved')
        .reduce((sum, r) => sum + (r.days || 0), 0);
    const remainingLeave = totalLeave - usedLeave;
    const baseLeave = totalLeave - carryover;

    // 아르바이트(part-time) — 이번 달 출근/쉬는날 카운트
    const thisMonthPrefix = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const myThisMonth = allRequests.filter(r => r.userId === currentUser.id && r.startDate.startsWith(thisMonthPrefix));
    const workCount = myThisMonth.filter(r => r.type === 'work').length;
    const offCount = myThisMonth.filter(r => r.type === 'dayoff').length;

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

    const getStatusText = (status: string) => {
        switch (status) {
            case 'approved': return '승인됨';
            case 'rejected': return '반려됨';
            case 'pending_approval': return '수정 승인대기';
            case 'pending_delete': return '삭제 승인대기';
            default: return '승인대기';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-700';
            case 'rejected': return 'bg-red-100 text-red-700';
            case 'pending_approval': return 'bg-orange-100 text-orange-700';
            case 'pending_delete': return 'bg-red-50 text-red-600 border border-red-100';
            default: return 'bg-yellow-100 text-yellow-700';
        }
    };

    const getTypeText = (type: LeaveType) => {
        switch (type) {
            case 'annual': return '연차';
            case 'morning_half': return '오전 반차';
            case 'afternoon_half': return '오후 반차';
            case 'sick': return '병가';
            case 'event': return '경조사';
            case 'family': return '가족돌봄';
            case 'work': return '출근';
            case 'dayoff': return '쉬는날';
            default: return type;
        }
    };

    // --- Calendar Logic ---
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const handlePrevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCalendarDate(new Date(year, month + 1, 1));

    const handleDateClick = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const dStr = String(date.getDate()).padStart(2, '0');
        const dateString = `${y}-${m}-${dStr}`;

        setEditingRequest(null);
        setStartDate(dateString);
        setEndDate(dateString);
        setLeaveType('annual');
        setLeaveDays(1);
        setShowModal(true);
    };

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
        <div className="animate-fade-in space-y-1.5 md:space-y-4">
            {/* ── 헤더 ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-base md:text-2xl font-bold text-slate-800">{isPartTime ? '근무 관리' : '연차 신청'}</h2>
                    <span className="text-slate-400 text-[11px] md:text-sm">{isPartTime ? '아르바이트 출근/쉬는날' : `총 ${totalLeave}일`}</span>
                </div>
                <button
                    onClick={handleOpenModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 md:px-6 md:py-2.5 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-md shadow-blue-600/20 flex items-center gap-1 transition-all"
                >
                    <Plus size={13} />
                    <span className="md:hidden">{isPartTime ? '등록' : '신청'}</span>
                    <span className="hidden md:inline">{isPartTime ? '근무 등록' : '연차 신청'}</span>
                </button>
            </div>

            {/* ── 스탯 (모바일: 가로 한 줄 / 데스크탑: 그리드) ── */}
            <div className="md:hidden flex items-stretch bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {(isPartTime
                    ? [
                        { label: '출근', value: `${workCount}일`, color: 'text-emerald-600' },
                        { label: '쉬는날', value: `${offCount}일`, color: 'text-orange-500', highlight: true },
                      ]
                    : [
                        { label: '발생', value: `${baseLeave}일`, color: 'text-slate-800' },
                        { label: '사용', value: `${usedLeave}일`, color: 'text-slate-800' },
                        { label: '정산', value: `${carryover > 0 ? '+' : ''}${carryover}일`, color: carryover > 0 ? 'text-blue-600' : carryover < 0 ? 'text-red-600' : 'text-slate-800' },
                        { label: '잔여', value: `${remainingLeave}일`, color: 'text-blue-600', highlight: true },
                      ]
                ).map((s: any, i) => (
                    <div key={s.label} className={`flex-1 flex flex-col items-center justify-center py-1.5 ${s.highlight ? 'bg-blue-50' : ''} ${i > 0 ? 'border-l border-slate-200' : ''}`}>
                        <span className={`text-[9px] font-medium ${s.highlight ? 'text-blue-500' : 'text-slate-400'}`}>{s.label}</span>
                        <span className={`text-xs font-extrabold ${s.color}`}>{s.value}</span>
                    </div>
                ))}
                <button
                    onClick={() => setShowListSheet(true)}
                    className="flex-1 flex flex-col items-center justify-center py-1.5 border-l border-slate-200 bg-slate-50 active:bg-slate-100 transition-colors"
                >
                    <span className="text-[9px] font-medium text-slate-400">내역</span>
                    <span className="text-xs font-extrabold text-slate-600">보기 →</span>
                </button>
            </div>
            {isPartTime ? (
            <div className="hidden md:grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                    <p className="text-xs font-bold text-slate-500 mb-0.5">이번 달 출근</p>
                    <p className="text-xl font-bold text-emerald-600">{workCount}일</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-xl shadow-sm border border-orange-100 flex flex-col justify-center">
                    <p className="text-xs font-bold text-orange-500 mb-0.5">이번 달 쉬는날</p>
                    <p className="text-xl font-bold text-orange-500">{offCount}일</p>
                </div>
            </div>
            ) : (
            <div className="hidden md:grid grid-cols-5 gap-3">
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
                <div className="bg-blue-50 p-3 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-center">
                    <p className="text-xs font-bold text-blue-600 mb-0.5">잔여 연차</p>
                    <p className="text-xl font-bold text-blue-700">{remainingLeave}일</p>
                </div>
            </div>
            )}

            {/* NEW: Leave Calendar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-3 py-2 md:p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-700 flex items-center gap-1.5 text-xs md:text-base">
                        <Calendar size={14} className="text-blue-600 md:hidden" />
                        <Calendar size={18} className="text-blue-600 hidden md:block" />
                        연차 캘린더
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-sm md:text-lg font-bold text-slate-800">{year}년 {month + 1}월</span>
                        <div className="flex gap-0.5">
                            <button onClick={handlePrevMonth} className="p-0.5 md:p-1 hover:bg-slate-200 rounded-full transition-colors"><ChevronLeft size={16} /></button>
                            <button onClick={handleNextMonth} className="p-0.5 md:p-1 hover:bg-slate-200 rounded-full transition-colors"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-7 border-b border-slate-100">
                    {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                        <div key={d} className={`py-1 md:py-2 text-center text-[10px] md:text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[34px] md:auto-rows-[80px]">
                    {days.map((d, idx) => {
                        if (!d) return <div key={idx} className="bg-slate-50/30 border-b border-r border-slate-100"></div>;

                        const dayLeaves = getDailyLeaves(d);
                        const isToday = new Date().toDateString() === d.toDateString();

                        return (
                            <div
                                key={idx}
                                onDoubleClick={() => handleDateClick(d)}
                                title="더블클릭하여 이 날짜에 연차 신청"
                                className={`p-0.5 border-b border-r border-slate-100 relative cursor-pointer hover:bg-slate-50 transition-colors ${isToday ? 'bg-blue-50/30' : ''}`}
                            >
                                <span className={`text-[10px] md:text-xs font-bold ${d.getDay() === 0 ? 'text-red-500' : d.getDay() === 6 ? 'text-blue-500' : 'text-slate-700'} ${isToday ? 'bg-blue-600 text-white w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full' : ''}`}>
                                    {d.getDate()}
                                </span>
                                <div className="space-y-0.5 overflow-hidden max-h-[16px] md:max-h-[50px]">
                                    {dayLeaves.map(r => (
                                        <div
                                            key={r.id}
                                            className={`text-[9px] md:text-[10px] px-1 py-0.5 rounded truncate font-medium ${r.userId === currentUser.id
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

            {/* ADMIN SECTION: Approval List — 모바일에서는 리스트 팝업 안에 표시 */}
            {currentUser.id === '2' && (
                <div className="hidden md:block bg-orange-50 rounded-2xl border border-orange-200 p-6">
                    <h3 className="text-lg font-bold text-orange-800 mb-4 flex items-center">
                        <AlertCircle size={20} className="mr-2" />
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

            {/* Action Bar + List — 모바일에서는 바텀시트로 이동 */}
            <div className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-center mt-6 mb-3 gap-3">
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

                <div className="flex items-center space-x-2">
                    {['1', '2', '5'].includes(currentUser.id) && viewMode === 'all' && tableViewMode === 'list' && (
                        <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                            <option value="all">전체 직원</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    )}

                    {tableViewMode === 'list' && (
                        <select value={filterYearMonth} onChange={e => setFilterYearMonth(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-500 bg-white">
                            <option value="all">전체 기간</option>
                            {availableYearMonths.map(ym => <option key={ym} value={ym}>{ym.replace('-', '년 ')}월</option>)}
                        </select>
                    )}

                    {['1', '2', '5'].includes(currentUser.id) && viewMode === 'all' && (
                        <button
                            onClick={tableViewMode === 'list' ? handleExportExcel : handleExportSummaryExcel}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center space-x-2 transition-all text-sm"
                        >
                            <Download size={16} />
                            <span>엑셀 다운로드</span>
                        </button>
                    )}
                </div>
            </div>

            {/* My List Table — 모바일에서 숨김 (바텀시트에서 렌더) */}
            {viewMode === 'all' && tableViewMode === 'summary' ? (
                <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto pb-4">
                        <table className="w-full text-center border-collapse text-xs whitespace-nowrap min-w-[1200px]">
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
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
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
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                                <td key={m} className="p-1 border-r border-b border-slate-200 text-red-500 font-bold h-8 align-middle">
                                                    {row.monthlyData[m].sum > 0 ? row.monthlyData[m].sum : ''}
                                                </td>
                                            ))}
                                        </tr>
                                        <tr className="border-b border-slate-300 hover:bg-slate-50">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
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
                <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* ── 모바일 카드 리스트 (< md) ── */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400 text-sm">로딩중...</div>
                        ) : requests.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm">내역이 없습니다.</div>
                        ) : requests.map((req) => {
                            const sameDay = req.startDate === req.endDate;
                            const fmtDate = (d: string) => d.slice(5).replace('-', '/'); // MM/DD
                            const dateLabel = sameDay ? fmtDate(req.startDate) : `${fmtDate(req.startDate)}~${fmtDate(req.endDate)}`;
                            return (
                                <div key={req.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold leading-tight whitespace-nowrap ${getStatusColor(req.status)}`}>
                                        {getStatusText(req.status)}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {['1', '2', '5'].includes(currentUser.id) && viewMode === 'all' && (
                                                <span className="text-xs font-bold text-slate-700 truncate max-w-[60px]">{req.userName}</span>
                                            )}
                                            <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">{getTypeText(req.type)}</span>
                                            <span className="text-[10px] text-slate-300">·</span>
                                            <span className="text-[10px] text-slate-500 whitespace-nowrap">{req.days}일</span>
                                            <span className="text-[10px] text-slate-300">·</span>
                                            <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">잔여 {requestBalances[req.id] ?? '-'}일</span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">{dateLabel}</div>
                                    </div>
                                    <button
                                        onClick={() => setDetailRequest(req)}
                                        className="shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-base leading-none transition-colors"
                                    >⋯</button>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── 데스크탑 테이블 (md+) ── */}
                    <div className="hidden md:block overflow-x-auto pb-4">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                                    <th className="p-4 font-bold">상태</th>
                                    {['1', '2', '5'].includes(currentUser.id) && (
                                        <th className="p-4 font-bold cursor-pointer hover:text-slate-800" onClick={() => handleSort('name')}>
                                            <div className="flex items-center">신청자 <ArrowUpDown size={12} className="ml-1" /></div>
                                        </th>
                                    )}
                                    <th className="p-4 font-bold">종류</th>
                                    <th className="p-4 font-bold cursor-pointer hover:text-slate-800" onClick={() => handleSort('date')}>
                                        <div className="flex items-center">기간 <ArrowUpDown size={12} className="ml-1" /></div>
                                    </th>
                                    <th className="p-4 font-bold">사용일수</th>
                                    <th className="p-4 font-bold">잔여연차</th>
                                    <th className="p-4 font-bold">신청일</th>
                                    <th className="p-4 font-bold text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={8} className="p-8 text-center text-slate-400">로딩중...</td></tr>
                                ) : requests.length === 0 ? (
                                    <tr><td colSpan={8} className="p-12 text-center text-slate-400">내역이 없습니다.</td></tr>
                                ) : (
                                    requests.map((req) => {
                                        const user = users.find(u => u.id === req.userId);
                                        return (
                                            <tr key={req.id} className="hover:bg-slate-50 transition-colors text-sm text-slate-700">
                                                <td className="p-2 md:p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(req.status)}`}>
                                                        {getStatusText(req.status)}
                                                    </span>
                                                </td>
                                                {['1', '2', '5'].includes(currentUser.id) && viewMode === 'all' && <td className="p-4 font-bold">{req.userName}</td>}
                                                <td className="p-4 font-bold">{getTypeText(req.type)}</td>
                                                <td className="p-4 text-slate-500 whitespace-nowrap">
                                                    {req.startDate} ~ {req.endDate}
                                                </td>
                                                <td className="p-4">{req.days}일</td>
                                                <td className="p-4 font-bold text-blue-600">{requestBalances[req.id] !== undefined ? requestBalances[req.id] : '-'}일</td>
                                                <td className="p-4 text-slate-400">
                                                    {new Date(req.requestDate).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {['2', '5'].includes(currentUser.id) && (req.status === 'pending_approval' || req.status === 'pending_delete') && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleApprove(req.id, 'approved')}
                                                                    className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded font-bold shadow-sm transition-all flex items-center gap-1"
                                                                >
                                                                    <Check size={12} /> 승인
                                                                </button>
                                                                <button
                                                                    onClick={() => handleApprove(req.id, 'rejected')}
                                                                    className="text-[10px] bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded font-bold shadow-sm transition-all flex items-center gap-1"
                                                                >
                                                                    <X size={12} /> 반려
                                                                </button>
                                                            </>
                                                        )}
                                                        {((currentUser.id === req.userId) || ['2', '5'].includes(currentUser.id)) && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingRequest(req);
                                                                        setLeaveType(req.type);
                                                                        setStartDate(req.startDate);
                                                                        setEndDate(req.endDate);
                                                                        setLeaveDays(req.days);
                                                                        setShowModal(true);
                                                                    }}
                                                                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold transition-colors"
                                                                >
                                                                    수정
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        const isSameDay = new Date(req.requestDate).toDateString() === new Date().toDateString();
                                                                        const confirmMsg = (isSameDay || ['2', '5'].includes(currentUser.id))
                                                                            ? '이 내역을 삭제하시겠습니까?'
                                                                            : '연차 삭제를 요청하시겠습니까? (관리자 승인 필요)';
                                                                        if (window.confirm(confirmMsg)) {
                                                                            await MockServer.deleteLeaveRequest(req.id, currentUser.id);
                                                                            loadRequests();
                                                                        }
                                                                    }}
                                                                    className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded font-bold transition-colors"
                                                                >
                                                                    삭제
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>{/* end hidden md:block */}
                </div>
            )}

            {/* ── 모바일 연차 내역 바텀시트 ── */}
            {showListSheet && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowListSheet(false)} />
                    <div className="relative z-10 bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
                        {/* 시트 헤더 */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
                            <h3 className="font-bold text-slate-800 text-sm">
                                {['1', '2', '5'].includes(currentUser.id) && viewMode === 'all' ? '전체 연차 내역' : '나의 연차 내역'}
                            </h3>
                            <div className="flex items-center gap-2">
                                {['1', '2', '5'].includes(currentUser.id) && (
                                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                                        <button onClick={() => setViewMode('my')} className={`px-2 py-0.5 text-xs font-bold rounded transition-all ${viewMode === 'my' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>내 연차</button>
                                        <button onClick={() => setViewMode('all')} className={`px-2 py-0.5 text-xs font-bold rounded transition-all ${viewMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>전체</button>
                                    </div>
                                )}
                                <select value={filterYearMonth} onChange={e => setFilterYearMonth(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 outline-none">
                                    <option value="all">전체 기간</option>
                                    {availableYearMonths.map(ym => <option key={ym} value={ym}>{ym.replace('-', '년 ')}월</option>)}
                                </select>
                                <button onClick={() => setShowListSheet(false)} className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                        {/* 관리자 승인대기 (모바일) */}
                        {currentUser.id === '2' && allRequests.filter(r => r.status === 'pending').length > 0 && (
                            <div className="px-3 py-2 bg-orange-50 border-b border-orange-100 shrink-0">
                                <p className="text-[11px] font-bold text-orange-700 mb-1.5 flex items-center gap-1"><AlertCircle size={12} /> 결재 대기</p>
                                <div className="space-y-1.5">
                                    {allRequests.filter(r => r.status === 'pending').map(req => (
                                        <div key={req.id} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-orange-100">
                                            <span className="text-xs font-bold text-slate-700">{req.userName}</span>
                                            <span className="text-xs text-slate-500 mx-2">{getTypeText(req.type)} · {req.days}일</span>
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => handleApprove(req.id, 'approved')} className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded font-bold">승인</button>
                                                <button onClick={() => handleApprove(req.id, 'rejected')} className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded font-bold">반려</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* 카드 리스트 */}
                        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                            {loading ? (
                                <div className="p-8 text-center text-slate-400 text-sm">로딩중...</div>
                            ) : requests.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 text-sm">내역이 없습니다.</div>
                            ) : requests.map((req) => {
                                const sameDay = req.startDate === req.endDate;
                                const fmtDate = (d: string) => d.slice(5).replace('-', '/');
                                const dateLabel = sameDay ? fmtDate(req.startDate) : `${fmtDate(req.startDate)}~${fmtDate(req.endDate)}`;
                                return (
                                    <div key={req.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${getStatusColor(req.status)}`}>
                                            {getStatusText(req.status)}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {['1', '2', '5'].includes(currentUser.id) && viewMode === 'all' && (
                                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[56px]">{req.userName}</span>
                                                )}
                                                <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">{getTypeText(req.type)}</span>
                                                <span className="text-[10px] text-slate-300">·</span>
                                                <span className="text-[10px] text-slate-500 whitespace-nowrap">{req.days}일</span>
                                                <span className="text-[10px] text-slate-300">·</span>
                                                <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">잔여 {requestBalances[req.id] ?? '-'}일</span>
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">{dateLabel}</div>
                                        </div>
                                        <button onClick={() => { setDetailRequest(req); }} className="shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-base leading-none">⋯</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ★ 모바일/확장앱 압축 리스트 상세 팝업 — 사용일수/잔여연차/신청일/관리(승인·수정·삭제)를 여기서 처리 */}
            {detailRequest && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetailRequest(null)}></div>
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm relative z-10 animate-fade-in">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(detailRequest.status)}`}>
                                    {getStatusText(detailRequest.status)}
                                </span>
                                <h3 className="text-base font-bold text-slate-800 mt-1">
                                    {['1', '2', '5'].includes(currentUser.id) && viewMode === 'all' ? `${detailRequest.userName} · ` : ''}{getTypeText(detailRequest.type)}
                                </h3>
                            </div>
                            <button onClick={() => setDetailRequest(null)} className="text-slate-400 hover:text-slate-800">
                                <X size={22} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-slate-400">기간</span><span className="font-medium text-slate-700">{detailRequest.startDate} ~ {detailRequest.endDate}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">사용일수</span><span className="font-medium text-slate-700">{detailRequest.days}일</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">잔여연차</span><span className="font-bold text-blue-600">{requestBalances[detailRequest.id] !== undefined ? requestBalances[detailRequest.id] : '-'}일</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">신청일</span><span className="font-medium text-slate-700">{new Date(detailRequest.requestDate).toLocaleDateString()}</span></div>
                        </div>
                        <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                            {['2', '5'].includes(currentUser.id) && (detailRequest.status === 'pending_approval' || detailRequest.status === 'pending_delete') && (
                                <>
                                    <button
                                        onClick={() => { handleApprove(detailRequest.id, 'approved'); setDetailRequest(null); }}
                                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-bold shadow-sm transition-all flex items-center gap-1"
                                    >
                                        <Check size={13} /> 승인
                                    </button>
                                    <button
                                        onClick={() => { handleApprove(detailRequest.id, 'rejected'); setDetailRequest(null); }}
                                        className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded font-bold shadow-sm transition-all flex items-center gap-1"
                                    >
                                        <X size={13} /> 반려
                                    </button>
                                </>
                            )}
                            {((currentUser.id === detailRequest.userId) || ['2', '5'].includes(currentUser.id)) && (
                                <>
                                    <button
                                        onClick={() => {
                                            setEditingRequest(detailRequest);
                                            setLeaveType(detailRequest.type);
                                            setStartDate(detailRequest.startDate);
                                            setEndDate(detailRequest.endDate);
                                            setLeaveDays(detailRequest.days);
                                            setShowModal(true);
                                            setDetailRequest(null);
                                        }}
                                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded font-bold transition-colors"
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const isSameDay = new Date(detailRequest.requestDate).toDateString() === new Date().toDateString();
                                            const confirmMsg = (isSameDay || ['2', '5'].includes(currentUser.id))
                                                ? '이 내역을 삭제하시겠습니까?'
                                                : '연차 삭제를 요청하시겠습니까? (관리자 승인 필요)';
                                            if (window.confirm(confirmMsg)) {
                                                await MockServer.deleteLeaveRequest(detailRequest.id, currentUser.id);
                                                setDetailRequest(null);
                                                loadRequests();
                                            }
                                        }}
                                        className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded font-bold transition-colors"
                                    >
                                        삭제
                                    </button>
                                </>
                            )}
                        </div>
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
                                <h3 className="text-xl font-bold text-slate-800">{isPartTime ? (editingRequest ? '근무 내역 수정' : '근무 등록') : (editingRequest ? '연차 내역 수정' : '연차 신청')}</h3>
                            </div>
                            <button onClick={() => { setShowModal(false); setEditingRequest(null); }} className="text-slate-400 hover:text-slate-800">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">{isPartTime ? '근무 구분' : '연차 종류'}</label>
                                    <div className={`grid gap-2 ${isPartTime ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                        {(isPartTime ? ['work', 'dayoff'] : ['annual', 'morning_half', 'afternoon_half', 'sick', 'event', 'family']).map((t) => (
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
                                                className={`py-2 px-1 text-sm rounded-lg border font-medium transition-all ${leaveType === t
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
                                        <Calendar size={18} className="mr-2" />
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