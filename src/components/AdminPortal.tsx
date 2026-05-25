import React from 'react';
import { Shield, LayoutGrid, LogOut, Crown } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import { User } from '../types';

interface Props {
  user: User;
  onSwitchPortal: () => void;
  onLogout: () => void;
}

export default function AdminPortal({ user, onSwitchPortal, onLogout }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <span className="font-black text-base tracking-tight text-slate-800">管理员控制台</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Admin Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-xl">
            <Crown className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-xs font-black text-rose-600">{user.username}</span>
          </div>
          <button
            onClick={onSwitchPortal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            切换端口
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-rose-500 border border-rose-100 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            退出
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 pt-8 pb-16 overflow-y-auto">
        <AdminDashboard />
      </main>
    </div>
  );
}
