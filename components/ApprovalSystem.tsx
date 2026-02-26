import React from 'react';
import { User, Approval } from '../types';
import { MockServer } from '../services/mockServer';
import { FileText, Inbox, Edit3, Clock, CheckCircle, Plus, Search, ChevronRight, X, Paperclip } from 'lucide-react';

interface ApprovalSystemProps {
  currentUser: User;
}

type ApprovalView = 'inbox' | 'draft' | 'pending' | 'completed' | 'all';

export const ApprovalSystem: React.FC<ApprovalSystemProps> = ({ currentUser }) => {
  const [approvals, setApprovals] = React.useState<Approval[]>([]);
  const [view, setView] = React.useState<ApprovalView>('inbox');
  const [loading, setLoading] = React.useState(true);
  const [showWriteModal, setShowWriteModal] = React.useState(false);
  const [selectedApproval, setSelectedApproval] = React.useState<Approval | null>(null);

  // Write Form
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [selectedApprover, setSelectedApprover] = React.useState('');
  const [attachment, setAttachment] = React.useState<string | undefined>(undefined);

  const loadApprovals = async () => {
    setLoading(true);
    const data = await MockServer.getApprovals(currentUser.id);
    setApprovals(data);
    setLoading(false);
  };

  React.useEffect(() => {
    loadApprovals();
  }, [currentUser.id]);

  const filteredApprovals = approvals.filter(item => {
    if (view === 'inbox') return item.approverId === currentUser.id && item.status === 'pending';
    if (view === 'draft') return item.requesterId === currentUser.id && item.status === 'draft';
    if (view === 'pending') return item.requesterId === currentUser.id && item.status === 'pending';
    if (view === 'completed') return (item.requesterId === currentUser.id || item.approverId === currentUser.id) && (item.status === 'approved' || item.status === 'rejected');
    return true; // all
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setAttachment(e.target.files[0].name);
      }
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (!title || !selectedApprover) {
        alert("제목과 결재자를 선택해주세요.");
        return;
    }

    await MockServer.createApproval(
        currentUser,
        selectedApprover,
        title,
        content,
        isDraft ? 'draft' : 'pending',
        attachment
    );
    
    setShowWriteModal(false);
    setTitle('');
    setContent('');
    setSelectedApprover('');
    setAttachment(undefined);
    loadApprovals();
    
    // Switch view
    if (isDraft) setView('draft');
    else setView('pending');
  };

  const SidebarItem = ({ id, icon: Icon, label, count }: { id: ApprovalView, icon: any, label: string, count?: number }) => (
    <button 
      onClick={() => setView(id)}
      className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-all ${
        view === id 
        ? 'bg-blue-50 text-blue-700' 
        : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center space-x-3">
        <Icon size={18} />
        <span>{label}</span>
      </div>
      {count !== undefined && count > 0 && (
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-xs font-bold">{count}</span>
      )}
    </button>
  );

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'approved': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs font-bold">승인</span>;
          case 'rejected': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs font-bold">반려</span>;
          case 'pending': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold">진행중</span>;
          case 'draft': return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs font-bold">임시저장</span>;
          default: return null;
      }
  };

  return (
    <div className="animate-fade-in flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] md:h-[calc(100vh-100px)]">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col shrink-0">
          <button 
            onClick={() => setShowWriteModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 mb-6 flex items-center justify-center space-x-2 transition-all"
          >
              <Plus size={18} />
              <span>새 결재 작성</span>
          </button>

          <nav className="space-y-1 flex-1">
              <SidebarItem id="inbox" icon={Inbox} label="결재함" count={approvals.filter(a => a.approverId === currentUser.id && a.status === 'pending').length} />
              <SidebarItem id="draft" icon={Edit3} label="임시저장" count={approvals.filter(a => a.requesterId === currentUser.id && a.status === 'draft').length} />
              <SidebarItem id="pending" icon={Clock} label="진행중" />
              <SidebarItem id="completed" icon={CheckCircle} label="결재완료" />
              <SidebarItem id="all" icon={FileText} label="전체보기" />
          </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                  {view === 'inbox' && '결재함'}
                  {view === 'draft' && '임시저장'}
                  {view === 'pending' && '진행중인 결재'}
                  {view === 'completed' && '결재 완료'}
                  {view === 'all' && '전체 결재 문서'}
              </h2>
              <div className="hidden md:flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-64">
                 <Search size={14} className="text-slate-400 mr-2"/>
                 <input type="text" placeholder="문서 검색..." className="text-sm outline-none bg-transparent w-full"/>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto">
              {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                      <span className="text-sm">로딩 중...</span>
                  </div>
              ) : filteredApprovals.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <Inbox size={48} className="text-slate-200"/>
                      <p className="text-sm font-medium">문서가 없습니다.</p>
                  </div>
              ) : (
                  <div className="divide-y divide-slate-100">
                      {filteredApprovals.map(doc => (
                          <div 
                              key={doc.id} 
                              onClick={() => setSelectedApproval(doc)}
                              className="p-4 hover:bg-slate-50 transition-colors flex items-center cursor-pointer group"
                          >
                              <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                      {getStatusBadge(doc.status)}
                                      <span className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleDateString()}</span>
                                      {doc.attachment && (
                                          <div className="flex items-center text-slate-400 text-xs">
                                              <Paperclip size={12} className="mr-1"/>
                                              {doc.attachment}
                                          </div>
                                      )}
                                  </div>
                                  <h4 className="font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">{doc.title}</h4>
                                  <p className="text-xs text-slate-500">
                                      기안자: {doc.requesterName} | 결재자: {doc.approverName}
                                  </p>
                              </div>
                              <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500"/>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </div>

      {/* Write Modal */}
      {showWriteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowWriteModal(false)}></div>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl relative z-10 animate-fade-in flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-800">새 결재 작성</h3>
                      <button onClick={() => setShowWriteModal(false)} className="text-slate-400 hover:text-slate-800">
                          <X size={24}/>
                      </button>
                  </div>
                  
                  <div className="p-6 flex-1 overflow-y-auto">
                      <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">기안자</label>
                                <input type="text" value={currentUser.name} disabled className="w-full px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">결재자 선택</label>
                                <select 
                                    value={selectedApprover}
                                    onChange={(e) => setSelectedApprover(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none bg-white"
                                >
                                    <option value="">선택하세요</option>
                                    <option value="1">고영관 (CEO)</option>
                                    <option value="2">이선우 (부장)</option>
                                    <option value="5">김봉정 (부장)</option>
                                    <option value="7">이재명 (전무)</option>
                                </select>
                             </div>
                          </div>

                          <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700">제목</label>
                              <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="결재 문서 제목을 입력하세요"
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
                              />
                          </div>

                          <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700">내용</label>
                              <textarea 
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="상세 내용을 입력하세요..."
                                className="w-full px-4 py-4 rounded-lg border border-slate-200 focus:border-blue-500 outline-none h-64 resize-none"
                              />
                          </div>

                          <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700">첨부파일</label>
                              <div className="border border-slate-200 rounded-lg p-2 flex items-center">
                                  <input 
                                    type="file" 
                                    onChange={handleFileChange}
                                    className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                  />
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50 rounded-b-2xl">
                      <button 
                        onClick={() => handleSubmit(true)}
                        className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 transition-colors"
                      >
                          임시저장
                      </button>
                      <button 
                        onClick={() => handleSubmit(false)}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
                      >
                          결재상신
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* View Modal */}
      {selectedApproval && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedApproval(null)}></div>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
                  <div className="bg-blue-600 p-6 text-white relative overflow-hidden shrink-0">
                      <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                          <FileText size={120} />
                      </div>
                      <div className="relative z-10 flex justify-between items-start">
                          <div>
                              <div className="inline-flex items-center space-x-2 bg-blue-700/50 rounded-full px-3 py-1 mb-3 text-xs font-bold border border-blue-500">
                                  <FileText size={12} />
                                  <span>결재 문서</span>
                              </div>
                              <h3 className="text-xl font-bold mb-1">{selectedApproval.title}</h3>
                              <p className="text-blue-100 text-sm">기안자: {selectedApproval.requesterName} | 결재자: {selectedApproval.approverName}</p>
                          </div>
                          <button onClick={() => setSelectedApproval(null)} className="text-blue-200 hover:text-white transition-colors">
                              <X size={24}/>
                          </button>
                      </div>
                  </div>
                  
                  <div className="p-6 bg-white flex-1 overflow-y-auto">
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                          <div className="flex items-center space-x-4">
                              <div>
                                  <p className="text-xs text-slate-500 font-bold mb-1">상태</p>
                                  {getStatusBadge(selectedApproval.status)}
                              </div>
                              <div>
                                  <p className="text-xs text-slate-500 font-bold mb-1">기안일</p>
                                  <p className="text-sm font-medium text-slate-800">{new Date(selectedApproval.createdAt).toLocaleDateString()}</p>
                              </div>
                          </div>
                          {selectedApproval.attachment && (
                              <div className="flex items-center text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                  <Paperclip size={14} className="mr-2"/>
                                  <span className="font-medium">{selectedApproval.attachment}</span>
                              </div>
                          )}
                      </div>

                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 min-h-[200px] whitespace-pre-wrap text-slate-700 text-sm leading-relaxed">
                          {selectedApproval.content || '내용이 없습니다.'}
                      </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3 shrink-0">
                      {selectedApproval.status === 'pending' && selectedApproval.approverId === currentUser.id && (
                          <>
                              <button 
                                  onClick={async () => {
                                      await MockServer.updateApprovalStatus(selectedApproval.id, 'rejected');
                                      setSelectedApproval(null);
                                      loadApprovals();
                                  }}
                                  className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold transition-colors"
                              >
                                  반려
                              </button>
                              <button 
                                  onClick={async () => {
                                      await MockServer.updateApprovalStatus(selectedApproval.id, 'approved');
                                      setSelectedApproval(null);
                                      loadApprovals();
                                  }}
                                  className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold shadow-md shadow-green-600/20 transition-colors"
                              >
                                  승인
                              </button>
                          </>
                      )}
                      <button 
                          onClick={() => setSelectedApproval(null)}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-bold transition-colors"
                      >
                          닫기
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};