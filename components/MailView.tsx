import React from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';

export const MailView: React.FC = () => {
    const MAIL_URL = "https://m193.mailplug.com/member/login";

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-slate-800">사내 메일 (MailPlug)</h2>
                </div>
                <button 
                    onClick={() => window.open(MAIL_URL, '_blank')}
                    className="flex items-center space-x-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <ExternalLink size={16}/>
                    <span>새 창으로 열기</span>
                </button>
            </div>
            
            <div className="flex-1 relative bg-slate-100">
                {/* Fallback Message Layer */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                    <AlertCircle className="text-slate-300 mb-2" size={48}/>
                    <p className="text-slate-400 font-medium">메일 화면이 표시되지 않으면 우측 상단 버튼을 클릭하세요.</p>
                    <p className="text-slate-400 text-xs mt-1">(보안 설정으로 인해 연결이 거부될 수 있습니다)</p>
                </div>

                {/* Iframe */}
                <iframe 
                    src={MAIL_URL} 
                    title="Company Mail"
                    className="absolute inset-0 w-full h-full border-none z-10 bg-white"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
                />
            </div>
        </div>
    );
};
