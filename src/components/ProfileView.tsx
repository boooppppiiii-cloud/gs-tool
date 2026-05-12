import React from 'react';
import { User as UserIcon, Settings, LogOut, Shield, Award } from 'lucide-react';
import { User } from '../types';
import AdminDashboard from './AdminDashboard';

const ADMIN_EMAIL = '1463432441@qq.com';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function ProfileView({ user, onLogout }: Props) {
  const isAdmin = user.username === ADMIN_EMAIL || user.email === ADMIN_EMAIL;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 bg-gradient-to-r from-slate-800 to-slate-900 flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center text-white backdrop-blur-md border border-white/20 mb-6 shadow-2xl adventure-icon-active">
            <UserIcon className="w-12 h-12" />
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight">{user.username}</h3>
          <p className="text-slate-400 font-medium">专家账号：{user.id}</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <InfoTile icon={<Shield className="w-5 h-5 text-emerald-500 adventure-icon-active"/>} label="账号状态" value="已实名 / 正常" />
             <InfoTile icon={<Award className="w-5 h-5 text-amber-500 adventure-icon-active"/>} label="专家等级" value="资深生态分析师" />
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
            <div className="flex gap-4">
               <button className="flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-700 font-bold text-sm rounded-2xl hover:bg-slate-100 transition-all">
                  <Settings className="w-4 h-4" /> 账号设置
               </button>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 font-bold text-sm rounded-2xl hover:bg-rose-100 transition-all active:scale-[0.98]"
            >
               <LogOut className="w-4 h-4" /> 退出登录
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-200 rounded-xl flex items-center justify-center text-amber-700 shrink-0">
             <Shield className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-amber-900 mb-1">系统安全性提醒</h5>
            <p className="text-xs text-amber-800 leading-relaxed opacity-80">
                本系统内涉及的玩家充值数据属商业机密，数据均由本地加密后上传至受保护的后端存储，切勿外传分析报告。您的所有操作均会有审计日志。
            </p>
          </div>
      </div>

      {isAdmin && (
        <div className="pt-10 border-t border-slate-200">
           <AdminDashboard />
        </div>
      )}
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4">
      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}
