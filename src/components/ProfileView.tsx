import React, { useState } from 'react';
import { User as UserIcon, LogOut, Save, Check, Users, Copy } from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  memberGroup: string;
  groups: string[];
  onGroupChange: (g: string) => void;
  onLogout: () => void;
}

export default function ProfileView({ user, displayName, onDisplayNameChange, memberGroup, groups, onGroupChange, onLogout }: Props) {
  const [nameInput, setNameInput] = useState(displayName);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveName = () => {
    onDisplayNameChange(nameInput.trim() || user.username);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-500">

      {/* Avatar + title */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-md">
          <UserIcon className="w-10 h-10 text-white" />
        </div>
        <div>
          <p className="text-xl font-black text-white">{displayName || user.username}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">{memberGroup}</p>
        </div>
      </div>

      {/* Edit display name */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-black text-slate-800">账户名称</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          建议填写真实姓名，方便组长和队友识别。
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
            placeholder="填写你的真实姓名…"
            className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
          />
          <button
            onClick={handleSaveName}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? '已保存' : '保存'}
          </button>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">账号 ID</p>
            <p className="text-xs font-mono text-slate-600 truncate select-all">{user.id}</p>
          </div>
          <button
            onClick={handleCopy}
            className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              copied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
            }`}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>

      {/* Group selector */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-black text-slate-800">所属组别</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          选择你所在的运营小组，组长会根据此分组查看工作状态。
        </p>
        <div className="flex flex-wrap gap-2">
          {groups.map(g => (
            <button
              key={g}
              onClick={() => onGroupChange(g)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all border ${
                memberGroup === g
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-rose-50 text-rose-600 font-bold text-sm rounded-2xl hover:bg-rose-100 transition-all border border-rose-100"
      >
        <LogOut className="w-4 h-4" />
        退出登录
      </button>
    </div>
  );
}
