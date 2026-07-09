import React from 'react';
import { User, Schedule, LeaveRequest } from '../types';
import { MockServer } from '../services/mockServer';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, X, User as UserIcon, List, CalendarDays } from 'lucide-react';

interface CalendarViewProps {
    currentUser: User;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ currentUser }) => {
    const [currentDate, setCurrentDate] = React.useState(new Date());
    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    const [schedules, setSchedules] = React.useState<Schedule[]>([]);
    const [myLeaves, setMyLeaves] = React.useState<LeaveRequest[]>([]); // ★ 본인 연차 (연간 전체, 날짜선택 무관 항상 표시)
    const [loading, setLoading] = React.useState(true);
    const [showModal, setShowModal] = React.useState(false);
    const [viewMode, setViewMode] = React.useState<'calendar' | 'list'>('calendar');

    // Form State
    const [newTitle, setNewTitle] = React.useState('');
    const [newStartDate, setNewStartDate] = React.useState('');
    const [newEndDate, setNewEndDate] = React.useState('');
    const [newType, setNewType] = React.useState<'personal' | 'company'>('personal');

    const loadSchedules = async () => {
        setLoading(true);
        // getSchedules now includes holidays and all approved leaves
        const data = await MockServer.getSchedules(currentUser.id);
        setSchedules(data);
        setLoading(false);
    };

    const loadMyLeaves = async () => {
        const all = await MockServer.getLeaveRequests();
        const mine = all
            .filter(l => l.userId === currentUser.id)
            .sort((a, b) => b.startDate.localeCompare(a.startDate));
        setMyLeaves(mine);
    };

    React.useEffect(() => {
        loadSchedules();
        loadMyLeaves();
    }, [currentUser.id]);

    // Calendar Logic
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];
    // Padding for previous month
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        days.push({ day: prevMonthDays - i, type: 'prev', fullDate: new Date(year, month - 1, prevMonthDays - i) });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, type: 'current', fullDate: new Date(year, month, i) });
    }
    // Padding for next month (to fill 6 rows = 42 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
        days.push({ day: i, type: 'next', fullDate: new Date(year, month + 1, i) });
    }

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const handleToday = () => {
        const now = new Date();
        setCurrentDate(now);
        setSelectedDate(now);
    }

    const isSameDate = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    const getFormatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getDayEvents = (date: Date) => {
        const dateStr = getFormatDate(date);
        return schedules.filter(s => {
            return dateStr >= s.startDate && dateStr <= s.endDate;
        });
    };

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
    };

    const handleAddSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle || !newStartDate || !newEndDate) return;

        const newSchedule: Schedule = {
            id: `sch_${Date.now()}`,
            userId: currentUser.id,
            userName: currentUser.name,
            title: newTitle,
            type: newType,
            startDate: newStartDate,
            endDate: newEndDate,
            isAllDay: true,
            color: newType === 'company' ? 'bg-indigo-500' : 'bg-blue-500'
        };

        await MockServer.createSchedule(newSchedule);
        setShowModal(false);
        setNewTitle('');
        setNewStartDate('');
        setNewEndDate('');
        loadSchedules();
    };

    // Selected Date Info
    const selectedDateStr = getFormatDate(selectedDate);
    const selectedDateEvents = getDayEvents(selectedDate);

    // Find holiday in schedules if exists
    const holidayEvent = selectedDateEvents.find(s => s.type === 'company' && s.color?.includes('holiday-text'));

    return (
        <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] gap-6">

            {/* Top Section: Calendar Grid */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                {/* Calendar Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <h2 className="text-2xl font-bold text-slate-800">
                            {year}년 {month + 1}월
                        </h2>
                        <div className="flex space-x-1">
                            <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft /></button>
                            <button onClick={handleToday} className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-slate-600">오늘</button>
                            <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight /></button>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="hidden md:flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                달력
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                리스트
                            </button>
                        </div>
                        <button
                            onClick={() => {
                                setNewStartDate(selectedDateStr);
                                setNewEndDate(selectedDateStr);
                                setShowModal(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-md shadow-blue-600/20 flex items-center space-x-2 transition-all"
                        >
                            <Plus size={18} />
                            <span className="hidden md:inline">일정 등록</span>
                        </button>
                    </div>
                </div>

                {viewMode === 'calendar' ? (
                    <>
                        {/* Calendar Grid Header */}
                        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                                <div key={day} className={`py-2 text-center text-sm font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid Body */}
                        <div className="flex-1 grid grid-cols-7 grid-rows-6">
                            {days.map((cell, idx) => {
                                const isSunday = cell.fullDate.getDay() === 0;
                                const isSaturday = cell.fullDate.getDay() === 6;
                                const isSelected = isSameDate(cell.fullDate, selectedDate);
                                const isToday = isSameDate(cell.fullDate, new Date());
                                const events = getDayEvents(cell.fullDate);

                                // Check if it's a holiday based on event data
                                const isHoliday = events.some(e => e.color?.includes('holiday-text'));
                                const holidayName = events.find(e => e.color?.includes('holiday-text'))?.title;

                                let textColor = 'text-slate-700';
                                if (cell.type !== 'current') textColor = 'text-slate-300';
                                else if (isHoliday || isSunday) textColor = 'text-red-500';
                                else if (isSaturday) textColor = 'text-blue-500';

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleDateClick(cell.fullDate)}
                                        className={`border-b border-r border-slate-100 p-1 md:p-2 relative hover:bg-blue-50 transition-colors cursor-pointer flex flex-col ${isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-300' : ''}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className={`text-sm font-medium ${textColor} ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center -ml-1 -mt-1' : ''}`}>
                                                {cell.day}
                                            </span>
                                            {isHoliday && cell.type === 'current' && (
                                                <span className="text-[10px] text-red-500 truncate max-w-[60px] hidden md:block">{holidayName}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-hidden mt-1 space-y-1">
                                            {/* Filter out holiday text events for the bubbles to avoid duplication if needed, or keep them */}
                                            {events.filter(e => !e.color?.includes('holiday-text')).slice(0, 3).map(evt => (
                                                <div key={evt.id} className={`text-[10px] md:text-xs truncate px-1 rounded text-white ${evt.color || 'bg-slate-400'}`}>
                                                    {evt.title}
                                                </div>
                                            ))}
                                            {events.filter(e => !e.color?.includes('holiday-text')).length > 3 && (
                                                <div className="text-[10px] text-slate-400 pl-1">+ {events.filter(e => !e.color?.includes('holiday-text')).length - 3}개 더보기</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                        <div className="max-w-3xl mx-auto space-y-6">
                            {days.filter(d => d.type === 'current').map(cell => {
                                const events = getDayEvents(cell.fullDate).filter(e => !e.color?.includes('holiday-text'));
                                if (events.length === 0) return null;

                                const isSunday = cell.fullDate.getDay() === 0;
                                const isSaturday = cell.fullDate.getDay() === 6;
                                const isHoliday = getDayEvents(cell.fullDate).some(e => e.color?.includes('holiday-text'));

                                let textColor = 'text-slate-800';
                                if (isHoliday || isSunday) textColor = 'text-red-500';
                                else if (isSaturday) textColor = 'text-blue-500';

                                return (
                                    <div key={cell.day} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                                            <div className={`text-lg font-bold ${textColor}`}>
                                                {cell.day}일
                                            </div>
                                            <div className="text-sm font-medium text-slate-500">
                                                {cell.fullDate.toLocaleDateString('ko-KR', { weekday: 'long' })}
                                            </div>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {events.map(evt => (
                                                <div key={evt.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                                                    <div className="w-20 shrink-0">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold text-white ${evt.type === 'company' ? 'bg-indigo-500' : evt.type === 'leave' ? 'bg-green-500' : 'bg-blue-500'}`}>
                                                            {evt.type === 'company' ? '사내행사' : evt.type === 'leave' ? '연차' : '개인'}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-800 truncate">{evt.title}</p>
                                                    </div>
                                                    <div className="w-24 shrink-0 flex items-center gap-2 text-sm text-slate-600">
                                                        <UserIcon size={14} />
                                                        <span className="truncate">{evt.userName}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {days.filter(d => d.type === 'current').every(cell => getDayEvents(cell.fullDate).filter(e => !e.color?.includes('holiday-text')).length === 0) && (
                                <div className="text-center py-12 text-slate-400">
                                    <List size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="font-medium">이번 달에 등록된 일정이 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Section: Leave Users & Daily Schedule (Only in Calendar View) */}
            {viewMode === 'calendar' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0" style={{ minHeight: '280px' }}>
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center space-x-3">
                            <CalendarIcon className="text-blue-600" />
                            <h3 className="font-bold text-slate-800">
                                {selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                            </h3>
                            {holidayEvent && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-bold">{holidayEvent.title}</span>}
                        </div>
                    </div>

                    {/* Leave Users Section */}
                    {(() => {
                        const leaveEvents = selectedDateEvents.filter(e => e.type === 'leave');
                        const otherEvents = selectedDateEvents.filter(e => !e.color?.includes('holiday-text') && e.type !== 'leave');

                        return (
                            <div className="flex-1 overflow-y-auto">
                                {/* 연차 사용자 리스트 */}
                                <div className="border-b border-slate-100">
                                    <div className="px-4 py-3 bg-green-50/50 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <span className="text-sm font-bold text-green-800">연차 사용자</span>
                                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{leaveEvents.length}명</span>
                                    </div>
                                    {leaveEvents.length === 0 ? (
                                        <div className="px-4 py-6 text-center text-sm text-slate-400">
                                            해당 날짜에 연차 사용자가 없습니다.
                                        </div>
                                    ) : (
                                        <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {leaveEvents.map(evt => {
                                                const initial = evt.userName.charAt(0);
                                                const leaveTypeLabel = evt.title.includes('반차') ? '반차' : evt.title.includes('병가') ? '병가' : evt.title.includes('경조') ? '경조사' : '연차';
                                                const typeColor = leaveTypeLabel === '반차' ? 'bg-amber-100 text-amber-700'
                                                    : leaveTypeLabel === '병가' ? 'bg-red-100 text-red-700'
                                                        : leaveTypeLabel === '경조사' ? 'bg-purple-100 text-purple-700'
                                                            : 'bg-green-100 text-green-700';
                                                return (
                                                    <div key={evt.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                                                            {initial}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-800 text-sm">{evt.userName}</span>
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${typeColor}`}>
                                                                    {leaveTypeLabel}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                                                                {evt.startDate === evt.endDate ? evt.startDate : `${evt.startDate} ~ ${evt.endDate}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* 기타 일정 */}
                                {otherEvents.length > 0 && (
                                    <div>
                                        <div className="px-4 py-3 bg-blue-50/50 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            <span className="text-sm font-bold text-blue-800">기타 일정</span>
                                            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{otherEvents.length}건</span>
                                        </div>
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                                <tr className="text-xs text-slate-500 border-b border-slate-100">
                                                    <th className="p-3 font-medium w-20">시간</th>
                                                    <th className="p-3 font-medium w-24">구분</th>
                                                    <th className="p-3 font-medium">내용</th>
                                                    <th className="p-3 font-medium w-32">등록자</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 text-sm">
                                                {otherEvents.map(evt => (
                                                    <tr key={evt.id} className="hover:bg-slate-50">
                                                        <td className="p-3 text-slate-500 font-mono">종일</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${evt.type === 'company' ? 'bg-indigo-500' : 'bg-blue-500'}`}>
                                                                {evt.type === 'company' ? '사내행사' : '개인'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-bold text-slate-800">{evt.title}</td>
                                                        <td className="p-3 text-slate-600 flex items-center space-x-2">
                                                            <UserIcon size={14} />
                                                            <span>{evt.userName}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* 모든 이벤트가 없을 때 */}
                                {leaveEvents.length === 0 && otherEvents.length === 0 && (
                                    <div className="hidden">
                                        {/* already handled in leave section */}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ★ 내 연차 (연간 전체 리스트) — 선택 날짜와 무관하게 항상 하단에 표시 */}
            {(() => {
                const yearStr = String(year);
                const yearLeaves = myLeaves.filter(l => l.startDate.startsWith(yearStr));
                const typeLabel: Record<string, string> = {
                    annual: '연차', morning_half: '오전반차', afternoon_half: '오후반차',
                    sick: '병가', event: '경조사', family: '가족돌봄'
                };
                const statusBadge: Record<string, string> = {
                    approved: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700',
                    pending_approval: 'bg-amber-100 text-amber-700', rejected: 'bg-red-100 text-red-700',
                    pending_delete: 'bg-orange-100 text-orange-700', draft: 'bg-slate-100 text-slate-600'
                };
                const statusText: Record<string, string> = {
                    approved: '승인됨', pending: '대기중', pending_approval: '승인대기',
                    rejected: '반려', pending_delete: '삭제대기', draft: '임시'
                };
                return (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0" style={{ minHeight: '220px', maxHeight: '360px' }}>
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <CalendarDays className="text-emerald-600" size={20} />
                                <h3 className="font-bold text-slate-800">내 연차 — {year}년 전체 내역</h3>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{yearLeaves.length}건</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {yearLeaves.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-slate-400">
                                    {year}년 연차 신청 내역이 없습니다.
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                        <tr className="text-xs text-slate-500 border-b border-slate-100">
                                            <th className="p-3 font-medium w-24">상태</th>
                                            <th className="p-3 font-medium w-24">종류</th>
                                            <th className="p-3 font-medium">기간</th>
                                            <th className="p-3 font-medium w-16 text-right">일수</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-sm">
                                        {yearLeaves.map(l => (
                                            <tr key={l.id} className="hover:bg-slate-50">
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusBadge[l.status] || 'bg-slate-100 text-slate-600'}`}>
                                                        {statusText[l.status] || l.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-bold text-slate-700">{typeLabel[l.type] || l.type}</td>
                                                <td className="p-3 text-slate-600">
                                                    {l.startDate === l.endDate ? l.startDate : `${l.startDate} ~ ${l.endDate}`}
                                                </td>
                                                <td className="p-3 text-right font-mono text-slate-700">{l.days}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Add Schedule Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 animate-fade-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800">일정 등록</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddSchedule} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">일정명</label>
                                <input
                                    type="text"
                                    required
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
                                    placeholder="일정 내용을 입력하세요"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">시작일</label>
                                    <input
                                        type="date"
                                        required
                                        value={newStartDate}
                                        onChange={(e) => setNewStartDate(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">종료일</label>
                                    <input
                                        type="date"
                                        required
                                        value={newEndDate}
                                        onChange={(e) => setNewEndDate(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">구분</label>
                                <select
                                    value={newType}
                                    onChange={(e) => setNewType(e.target.value as any)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none bg-white"
                                >
                                    <option value="personal">개인 일정</option>
                                    {currentUser.role === 'admin' || currentUser.role === 'manager' ? (
                                        <option value="company">회사 일정 (공유)</option>
                                    ) : null}
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
                                    등록하기
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
