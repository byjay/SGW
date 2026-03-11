import React, { useState } from 'react';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { MockServer } from '../services/mockServer';

interface InitialPasswordModalProps {
    isOpen: boolean;
    userId: string;
    skipCount: number;
    onComplete: (changed: boolean) => void;
}

export const InitialPasswordModal: React.FC<InitialPasswordModalProps> = ({ isOpen, userId, skipCount, onComplete }) => {
    const [currentStep, setCurrentStep] = useState<'intro' | 'form'>(isOpen ? 'intro' : 'form');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        if (newPassword.length < 4) {
            setError('비밀번호는 4자리 이상이어야 합니다.');
            return;
        }

        setLoading(true);
        try {
            // Verify current password is correct
            const verifiedUser = await MockServer.login(userId, currentPassword);
            if (!verifiedUser) {
                setError('현재 비밀번호가 일치하지 않습니다.');
                setLoading(false);
                return;
            }

            await MockServer.changePassword(userId, newPassword);
            alert('비밀번호가 성공적으로 변경되었습니다. 보안을 위해 다시 로그인해주세요.');
            onComplete(true);
        } catch (err) {
            setError('비밀번호 변경 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden transform transition-all scale-100 border border-slate-200">
                {currentStep === 'intro' ? (
                    <div className="p-8 text-center">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-amber-100 animate-bounce-subtle">
                            <AlertTriangle size={40} className="text-amber-500" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2 leading-tight">초기 비밀번호<br />보안 알림</h3>
                        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                            현재 초기 비밀번호('1')를 사용 중입니다.<br />
                            보안을 위해 비밀번호를 반드시 변경해야 합니다.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => setCurrentStep('form')}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex justify-center items-center gap-2 group"
                            >
                                <KeyRound size={20} className="group-hover:rotate-12 transition-transform" />
                                <span>비밀번호 변경으로 이동하기</span>
                            </button>

                            {skipCount < 3 && (
                                <button
                                    onClick={async () => {
                                        await MockServer.updatePasswordChangedStatus(userId, skipCount + 1);
                                        onComplete(false);
                                    }}
                                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm mb-2"
                                >
                                    다음에 변경하기 ({3 - skipCount}회 남음)
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white text-center">
                            <h3 className="text-xl font-bold">비밀번호 변경</h3>
                            <p className="text-blue-100 text-xs mt-1 opacity-80">새로운 비밀번호를 입력해주세요</p>
                        </div>

                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs font-medium text-center">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">현재 비밀번호</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <KeyRound size={16} />
                                        </div>
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                            placeholder="기존 비밀번호 입력"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">새 비밀번호</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <KeyRound size={16} />
                                        </div>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                            placeholder="4자리 이상 입력"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">새 비밀번호 확인</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                            <KeyRound size={16} />
                                        </div>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                            placeholder="한번 더 입력"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep('intro')}
                                        className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all"
                                    >
                                        뒤로
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-[2] py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
                                    >
                                        {loading ? '변경 중...' : '변경 완료'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
