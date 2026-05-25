import React from 'react';
import { Shield, Crown, Sword, ChevronRight } from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  isAdmin: boolean;
  onSelect: (portal: 'admin' | 'leader' | 'member') => void;
}

const portals: {
  id: 'admin' | 'leader' | 'member';
  label: string;
  icon: React.ReactElement;
  desc: string;
  sub: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    id: 'admin',
    label: '管理员',
    icon: <Shield className="w-8 h-8" />,
    desc: '后台管理与统计',
    sub: '系统数据总览、用户与权限管理',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  {
    id: 'leader',
    label: '组长',
    icon: <Crown className="w-8 h-8" />,
    desc: '团队协调与监督',
    sub: '成员管理、任务分配与绩效追踪',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    id: 'member',
    label: '组员',
    icon: <Sword className="w-8 h-8" />,
    desc: '日常运营工具',
    sub: '专家分析、案例库、知识库、对话模拟',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
];

export default function PortalSelector({ user, isAdmin, onSelect }: Props) {
  const [hovered, setHovered] = React.useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-600 mb-6">
            <Crown className="w-3.5 h-3.5" />
            傲世传奇专家系统
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">
            请选择您的工作端口
          </h1>
          <p className="text-slate-400 font-medium text-sm">
            欢迎回来，{user.username}。您可以随时在侧边栏切换端口。
          </p>
        </div>

        {/* Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((p) => {
            const locked = p.id === 'admin' && !isAdmin;
            return (
              <button
                key={p.id}
                onMouseEnter={() => !locked && setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => !locked && onSelect(p.id)}
                disabled={locked}
                className={`group relative text-left p-8 rounded-[28px] border-2 transition-all duration-200 focus:outline-none ${
                  locked
                    ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                    : hovered === p.id
                    ? `${p.bg} ${p.border} shadow-xl -translate-y-1`
                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-200 ${
                    locked
                      ? 'bg-slate-100 text-slate-300'
                      : hovered === p.id
                      ? `${p.bg} ${p.color}`
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {p.icon}
                </div>

                {/* Text */}
                <div className="space-y-2 mb-6">
                  <h3 className={`text-2xl font-black transition-colors ${locked ? 'text-slate-400' : hovered === p.id ? p.color : 'text-slate-800'}`}>
                    {p.label}
                  </h3>
                  <p className="text-sm font-bold text-slate-500">{locked ? '权限不足' : p.desc}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{locked ? '仅超级管理员可访问此端口' : p.sub}</p>
                </div>

                {/* Arrow */}
                {!locked && (
                  <div
                    className={`flex items-center gap-1 text-xs font-bold transition-all ${
                      hovered === p.id ? `${p.color} translate-x-1` : 'text-slate-300'
                    }`}
                  >
                    进入端口
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}

                {/* Active indicator line */}
                {hovered === p.id && !locked && (
                  <div className={`absolute bottom-0 left-8 right-8 h-0.5 rounded-full ${p.bg} border-b-2 ${p.border}`} />
                )}
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-300 mt-10 font-medium">
          您的选择将在下次登录时自动恢复
        </p>
      </div>
    </div>
  );
}
