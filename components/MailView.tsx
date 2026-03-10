import React, { memo, useCallback, useEffect } from 'react';
import { ExternalLink, Mail, RefreshCw, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { User } from '../types';
import { APP_CONFIG } from '../constants/appConfig';
import { MockServer } from '../services/mockServer';
import { errorUtils } from '../utils';

interface MailViewProps {
    currentUser: User;
}

export const MailView: React.FC<MailViewProps> = memo(({ currentUser }) => {
    const [autoLoginStatus, setAutoLoginStatus] = React.useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
    const [errorMessage, setErrorMessage] = React.useState<string>('');

    // 백엔드 자동 로그인만 호출 (HTML 파싱 없음)
    useEffect(() => {
        const login = async () => {
            console.log('[MailView] Backend auto-login called');
            setAutoLoginStatus('pending');
            setErrorMessage('');

            try {
                const result = await MockServer.mailAutoLogin(
                    currentUser.email,
                    currentUser.password || '1',
                    currentUser.id
                );
                setAutoLoginStatus(result.success ? 'success' : 'failed');
                if (!result.success) {
                    setErrorMessage(result.message);
                }
            } catch (error) {
                errorUtils.log('MailView', 'Login error', error);
                setAutoLoginStatus('failed');
                setErrorMessage('자동 로그인 중 오류가 발생했습니다.');
            }
        };

        login();
    }, [currentUser]);

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                    <Mail className="text-blue-600" size={20} />
                    <h2 className="text-lg font-bold text-slate-800">사내 메일 (MailPlug)</h2>
                    <div className="flex items-center space-x-2 ml-4">
                        {autoLoginStatus === 'pending' && (
                            <div className="flex items-center text-xs text-blue-600">
                                <RefreshCw className="animate-spin mr-1" size={14} />
                                <span>백엔드에서 로그인 중...</span>
                            </div>
                        )}
                        {autoLoginStatus === 'success' && (
                            <div className="flex items-center text-xs text-green-600">
                                <CheckCircle className="mr-1" size={14} />
                                <span>백엔드 로그인 완료</span>
                            </div>
                        )}
                        {autoLoginStatus === 'failed' && (
                            <div className="flex items-center text-xs text-orange-500">
                                <AlertCircle className="mr-1" size={14} />
                                <span>로그인 실패</span>
                            </div>
                        )}
                    </div>
                </div>
                <button 
                    onClick={() => window.open(APP_CONFIG.MAIL.URL, '_blank')}
                    className="flex items-center space-x-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm"
                >
                    <ExternalLink size={16}/>
                    <span>메일 열기</span>
                </button>
            </div>
            
            <div className="flex-1 relative bg-white">
                {autoLoginStatus === 'success' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-50">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="text-green-600" size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-green-800">로그인 완료</h3>
                            <p className="text-green-700 text-sm">
                                백엔드에서 메일 로그인이 완료되었습니다.<br/>
                                아래 버튼을 클릭하여 메일을 확인하세요.
                            </p>
                            <button 
                                onClick={() => window.open(APP_CONFIG.MAIL.URL, '_blank')}
                                className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg"
                            >
                                <Mail size={20} className="mr-2" />
                                메일 확인하기
                            </button>
                        </div>
                    </div>
                ) : (
                    <iframe 
                        src={APP_CONFIG.MAIL.URL} 
                        title="Company Mail"
                        className="absolute inset-0 w-full h-full border-none z-10 bg-white"
                        allow="accelerometer; autoplay; camera; encrypted-media; fullscreen; geolocation; gyroscope; magnetometer; microphone; midi; clipboard-read; clipboard-write; script"
                        allowFullScreen
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-top-navigation-by-user-activation"
                    />
                )}
            </div>
        </div>
    );
});

MailView.displayName = 'MailView';
