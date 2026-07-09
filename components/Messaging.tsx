import React from 'react';
import { User, Message } from '../types';
import { MockServer } from '../services/mockServer';
import { Send, Search, ArrowLeft, MessageSquare, CheckCheck, Check, Paperclip, Download, X } from 'lucide-react';

interface MessagingProps {
    currentUser: User;
}

export const Messaging: React.FC<MessagingProps> = ({ currentUser }) => {
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [users, setUsers] = React.useState<User[]>([]);
    const [onlineIds, setOnlineIds] = React.useState<string[]>([]);
    const [activeId, setActiveId] = React.useState<string>('');
    const [draft, setDraft] = React.useState('');
    const [search, setSearch] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [attach, setAttach] = React.useState<{ name: string; data: string } | null>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const fileRef = React.useRef<HTMLInputElement>(null);

    // 파일 첨부 (2MB 제한 — localStorage 기반 스토리지 보호)
    const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) { alert('파일은 2MB 이하만 전송할 수 있습니다.'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = () => setAttach({ name: f.name, data: String(reader.result) });
        reader.readAsDataURL(f);
        e.target.value = '';
    };

    const refresh = React.useCallback(async () => {
        const [msgs, online] = await Promise.all([
            MockServer.getMessages(currentUser.id),
            MockServer.getOnlineUsers(),
        ]);
        setMessages(msgs);
        setOnlineIds(online);
    }, [currentUser.id]);

    React.useEffect(() => {
        (async () => {
            const usrs = await MockServer.getUsers();
            setUsers(usrs.filter(u => u.id !== currentUser.id));
            await refresh();
        })();
        const t = setInterval(refresh, 3000); // 실시간 폴링
        return () => clearInterval(t);
    }, [currentUser.id, refresh]);

    // 대화별 마지막 메시지 / 미읽음
    const convMeta = React.useMemo(() => {
        const map: Record<string, { last?: Message; unread: number }> = {};
        for (const m of messages) {
            const other = m.senderId === currentUser.id ? m.receiverId : m.senderId;
            if (!map[other]) map[other] = { unread: 0 };
            if (!map[other].last || m.timestamp > map[other].last!.timestamp) map[other].last = m;
            if (m.receiverId === currentUser.id && m.senderId === other && !m.isRead) map[other].unread++;
        }
        return map;
    }, [messages, currentUser.id]);

    // 연락처 정렬: 최근 대화 우선 → 이름
    const contacts = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return users
            .filter(u => !q || u.name.toLowerCase().includes(q) || (u.position || '').toLowerCase().includes(q) || (u.department || '').toLowerCase().includes(q))
            .sort((a, b) => {
                const ta = convMeta[a.id]?.last?.timestamp || 0;
                const tb = convMeta[b.id]?.last?.timestamp || 0;
                if (tb !== ta) return tb - ta;
                return a.name.localeCompare(b.name);
            });
    }, [users, convMeta, search]);

    const activeUser = users.find(u => u.id === activeId);
    const thread = React.useMemo(() =>
        messages
            .filter(m => (m.senderId === currentUser.id && m.receiverId === activeId) || (m.senderId === activeId && m.receiverId === currentUser.id))
            .sort((a, b) => a.timestamp - b.timestamp),
        [messages, activeId, currentUser.id]);

    // 대화 열면 읽음 처리
    React.useEffect(() => {
        if (!activeId) return;
        MockServer.markConversationRead(currentUser.id, activeId).then(refresh);
    }, [activeId, currentUser.id, refresh]);

    // 새 메시지 오면 스크롤 하단
    React.useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [thread.length, activeId]);

    const send = async () => {
        const text = draft.trim();
        if ((!text && !attach) || !activeId || sending) return;
        setSending(true);
        setDraft('');
        const file = attach; setAttach(null);
        try {
            await MockServer.sendMessage(currentUser, activeId, text || (file ? `📎 ${file.name}` : ''), file || undefined);
            await refresh();
        } finally { setSending(false); }
    };

    const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const fmtDay = (ts: number) => new Date(ts).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    const fmtPreview = (ts: number) => {
        const d = new Date(ts), now = new Date();
        if (d.toDateString() === now.toDateString()) return fmtTime(ts);
        return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    };

    return (
        <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] flex gap-0 md:gap-5">
            {/* ── 연락처(조직도) ── */}
            <div className={`w-full md:w-80 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${activeId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                        <MessageSquare size={18} className="text-blue-600" /> 메신저
                    </h2>
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름·부서 검색"
                            className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400/40" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {contacts.map(u => {
                        const meta = convMeta[u.id];
                        const online = onlineIds.includes(u.id);
                        return (
                            <button key={u.id} onClick={() => setActiveId(u.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 ${activeId === u.id ? 'bg-blue-50' : ''}`}>
                                <div className="relative shrink-0">
                                    <img src={u.avatar} alt="" className="w-11 h-11 rounded-full object-cover border border-slate-200" />
                                    {online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-slate-800 text-sm truncate">{u.name} <span className="font-normal text-slate-400 text-xs">{u.position}</span></span>
                                        {meta?.last && <span className="text-[10px] text-slate-400 shrink-0">{fmtPreview(meta.last.timestamp)}</span>}
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <span className="text-xs text-slate-500 truncate">{meta?.last ? (meta.last.senderId === currentUser.id ? '나: ' : '') + meta.last.content : (u.department || '대화를 시작해보세요')}</span>
                                        {meta?.unread > 0 && <span className="shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{meta.unread}</span>}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                    {contacts.length === 0 && <p className="p-6 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>}
                </div>
            </div>

            {/* ── 대화 ── */}
            <div className={`flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${activeId ? 'flex' : 'hidden md:flex'}`}>
                {activeUser ? (
                    <>
                        {/* 헤더 */}
                        <div className="p-3 md:p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/60">
                            <button onClick={() => setActiveId('')} className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-slate-200 text-slate-500"><ArrowLeft size={20} /></button>
                            <div className="relative">
                                <img src={activeUser.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                                {onlineIds.includes(activeUser.id) && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">{activeUser.name} <span className="font-normal text-slate-400 text-xs">{activeUser.position} · {activeUser.department}</span></p>
                                <p className="text-[11px] text-slate-400">{onlineIds.includes(activeUser.id) ? '🟢 접속 중' : '오프라인'}</p>
                            </div>
                        </div>

                        {/* 메시지 */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-slate-50/40">
                            {thread.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                                    <MessageSquare size={40} className="opacity-30" />
                                    <p className="text-sm">{activeUser.name}님과의 첫 대화를 시작하세요</p>
                                </div>
                            )}
                            {thread.map((m, i) => {
                                const mine = m.senderId === currentUser.id;
                                const prev = thread[i - 1];
                                const showDay = !prev || new Date(prev.timestamp).toDateString() !== new Date(m.timestamp).toDateString();
                                const isLastMine = mine && i === thread.length - 1;
                                return (
                                    <React.Fragment key={m.id}>
                                        {showDay && (
                                            <div className="flex justify-center my-3">
                                                <span className="text-[11px] text-slate-500 bg-slate-200/70 px-3 py-1 rounded-full">{fmtDay(m.timestamp)}</span>
                                            </div>
                                        )}
                                        <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                                            {!mine && <img src={activeUser.avatar} alt="" className="w-7 h-7 rounded-full object-cover self-end mb-0.5" />}
                                            <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-[72%]`}>
                                                <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'}`}>
                                                    {m.content}
                                                    {m.fileData && (
                                                        m.fileData.startsWith('data:image/') ? (
                                                            <a href={m.fileData} download={m.fileName || 'image'} title="클릭하여 다운로드" className="block mt-2">
                                                                <img src={m.fileData} alt={m.fileName || ''} className="max-w-[220px] max-h-[220px] rounded-lg border border-black/10" />
                                                            </a>
                                                        ) : (
                                                            <a href={m.fileData} download={m.fileName || 'file'}
                                                                className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${mine ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                                                <Download size={14} /> {m.fileName || '파일 다운로드'}
                                                            </a>
                                                        )
                                                    )}
                                                </div>
                                                <div className={`flex items-center gap-1 mt-0.5 px-1 ${mine ? 'flex-row-reverse' : ''}`}>
                                                    <span className="text-[10px] text-slate-400">{fmtTime(m.timestamp)}</span>
                                                    {isLastMine && (m.isRead
                                                        ? <span className="text-[10px] text-blue-500 flex items-center gap-0.5"><CheckCheck size={12} />읽음</span>
                                                        : <span className="text-[10px] text-slate-400 flex items-center"><Check size={12} /></span>)}
                                                </div>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {/* 입력 */}
                        <div className="border-t border-slate-100">
                            {attach && (
                                <div className="px-3 pt-2 flex items-center gap-2 text-xs">
                                    <span className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1.5 font-bold text-slate-700">
                                        <Paperclip size={12} /> {attach.name}
                                    </span>
                                    <button onClick={() => setAttach(null)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                                </div>
                            )}
                            <div className="p-3 flex items-end gap-2">
                                <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
                                <button onClick={() => fileRef.current?.click()} title="파일 첨부 (2MB 이하)"
                                    className="shrink-0 w-11 h-11 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 hover:text-slate-700 transition-colors">
                                    <Paperclip size={18} />
                                </button>
                                <textarea value={draft} onChange={e => setDraft(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                                    rows={1} placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)"
                                    className="flex-1 resize-none max-h-28 px-4 py-2.5 bg-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-400/40 leading-relaxed" />
                                <button onClick={send} disabled={(!draft.trim() && !attach) || sending}
                                    className="shrink-0 w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:bg-slate-300 transition-colors">
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="hidden md:flex flex-col items-center justify-center h-full text-slate-300 gap-3">
                        <MessageSquare size={52} className="opacity-20" />
                        <p className="font-medium">왼쪽에서 대화 상대를 선택하세요</p>
                    </div>
                )}
            </div>
        </div>
    );
};
