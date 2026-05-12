import React from 'react';
import { Mail, ShieldCheck, KeyRound } from 'lucide-react';
import { User as UserType } from '../types';
import { auth } from '../lib/firebase';

interface Props {
  onLogin: (user: UserType) => void;
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [step, setStep] = React.useState<'email' | 'code'>('email');
  const [verifyFn, setVerifyFn] = React.useState<((p: { token: string }) => Promise<any>) | null>(null);
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await (auth as any).signInWithOtp({ email });
      const fn = result?.data?.verifyOtp;
      if (!fn) throw new Error('验证码发送失败，请稍后重试');
      setVerifyFn(() => fn);
      setStep('code');
    } catch (err: any) {
      const msg = String(err?.message || err?.code || err || '');
      if (msg.includes('not enabled') || msg.includes('OPERATION_FORBIDDEN') || msg.includes('forbidden')) {
        setError('请在 CloudBase 控制台 → 身份认证 → 登录方式 → 开启「邮箱验证码」');
      } else {
        setError(`发送失败：${msg.slice(0, 80)}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !verifyFn) return;
    setIsLoading(true);
    setError('');
    try {
      await verifyFn({ token: code });
      const state = await auth.getLoginState();
      const cbUser = state?.user as any;
      if (cbUser) {
        onLogin({
          id: cbUser.uid ?? '',
          username: cbUser.nickName || email.split('@')[0] || '专家用户',
          email: email || undefined,
        });
      } else {
        setError('验证失败，请重试');
      }
    } catch (err: any) {
      const msg = String(err?.message || err?.code || err || '');
      if (msg.includes('invalid') || msg.includes('expired') || msg.includes('incorrect') || msg.includes('wrong')) {
        setError('验证码错误或已过期，请重新获取');
      } else {
        setError(`验证失败：${msg.slice(0, 80)}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls = 'block w-full pl-14 pr-4 py-4 bg-slate-50 border-0 rounded-2xl ring-1 ring-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:ring-offset-0 outline-none transition-all text-slate-900 font-bold text-sm';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-[40px] shadow-2xl border border-slate-100">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-200">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-8 text-3xl font-black text-slate-900 tracking-tight">传奇专家后台系统</h2>
          <p className="mt-2 text-slate-500 font-medium tracking-tight">
            {step === 'email' ? '输入邮箱，获取验证码登录' : `验证码已发送至 ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <form className="mt-8 space-y-6" onSubmit={handleSendCode}>
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-xs font-bold">
                {error}
              </div>
            )}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Mail className="h-5 w-5" />
              </div>
              <input
                type="email"
                required
                autoFocus
                className={inputCls}
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-5 px-4 border border-transparent rounded-3xl shadow-xl text-sm font-black text-white bg-slate-900 hover:bg-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? '发送中...' : '获取验证码'}
            </button>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-xs font-bold">
                {error}
              </div>
            )}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <KeyRound className="h-5 w-5" />
              </div>
              <input
                type="text"
                required
                autoFocus
                maxLength={8}
                className={inputCls + ' tracking-[0.3em]'}
                placeholder="输入验证码"
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-5 px-4 border border-transparent rounded-3xl shadow-xl text-sm font-black text-white bg-slate-900 hover:bg-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? '验证中...' : '验证登录'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); setError(''); }}
              className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors py-1"
            >
              ← 更换邮箱 / 重新发送
            </button>
          </form>
        )}

        <div className="pt-6 border-t border-slate-50 text-center">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-relaxed">
            首次使用将自动创建账号
          </p>
        </div>
      </div>
    </div>
  );
}
