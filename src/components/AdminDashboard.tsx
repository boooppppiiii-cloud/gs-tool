import React, { useState, useEffect } from 'react';
import { getAnalyticsLogs } from '../services/analyticsService';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  LineChart, Line,
  PieChart, Pie, Legend,
} from 'recharts';
import { Shield, Activity, Clock, Zap, MousePointer2, TrendingUp, PieChart as PieChartIcon, MessageSquare, AlertTriangle, Users } from 'lucide-react';

interface UsageLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  path: string;
  timestamp: string;
  chatCount?: number;
  negativeCount?: number;
  keyPlayerCount?: number;
  sessionDuration?: number;
}

const ACTION_LABELS: Record<string, string> = {
  session_start: '会话开始',
  login: '用户登录',
  tab_switch: '页面导航',
  analysis_start: '分析启动',
  analysis_complete: '分析完成',
  excel_upload: '数据上传',
  search: '知识库检索',
  simulation_start: '对话模拟',
  simulation_msg: '模拟消息',
  case_vote: '案例点赞',
  case_view: '案例查看',
  delete_case: '案例删除',
  delete_history: '历史删除',
};

const FEATURE_CATEGORIES: Record<string, string> = {
  analysis_start: '区服分析',
  analysis_complete: '区服分析',
  search: '知识库检索',
  simulation_start: '对话模拟',
  simulation_msg: '对话模拟',
  excel_upload: '数据上传',
  case_vote: '案例管理',
  case_view: '案例管理',
  delete_case: '案例管理',
  tab_switch: '导航',
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4'];

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours > 0) return `${hours}小时${remainMins}分`;
  return `${mins}分钟`;
}

export default function AdminDashboard() {
  const [logs, setLogs] = useState<UsageLog[]>([]);

  useEffect(() => {
    setLogs(getAnalyticsLogs());
    const interval = setInterval(() => setLogs(getAnalyticsLogs()), 30000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const activeLogs = logs.filter(l => l.action !== 'session_start');
  const todayActiveLogs = activeLogs.filter(l => l.timestamp.slice(0, 10) === today);

  const totalClicks = activeLogs.length;

  const analysisLogs = logs.filter(l => l.action === 'analysis_complete');
  const totalChatCount = analysisLogs.reduce((sum, l) => sum + (l.chatCount || 0), 0);
  const totalNegativeCount = analysisLogs.reduce((sum, l) => sum + (l.negativeCount || 0), 0);
  const totalKeyPlayerCount = analysisLogs.reduce((sum, l) => sum + (l.keyPlayerCount || 0), 0);

  const todayAllLogs = logs.filter(l => l.timestamp.slice(0, 10) === today);
  let todayDuration = '0分钟';
  if (todayAllLogs.length >= 2) {
    const times = todayAllLogs.map(l => new Date(l.timestamp).getTime());
    todayDuration = formatDuration(Math.max(...times) - Math.min(...times));
  }

  const todayActiveCount = todayActiveLogs.length;

  const getBarData = () => {
    const counts: Record<string, number> = {};
    activeLogs.forEach(l => {
      const label = ACTION_LABELS[l.action] || l.action;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  const getLineData = () => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days.map(day => ({
      date: day.slice(5).replace('-', '/'),
      count: activeLogs.filter(l => l.timestamp.slice(0, 10) === day).length,
    }));
  };

  const getPieData = () => {
    const counts: Record<string, number> = {};
    activeLogs.forEach(l => {
      const category = FEATURE_CATEGORIES[l.action] || '其他';
      counts[category] = (counts[category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const barData = getBarData();
  const lineData = getLineData();
  const pieData = getPieData();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-indigo-500 shadow-lg adventure-icon-active">
            <Shield className="w-6 h-6" />
          </div>
          后台管理打点系统
        </h2>
        <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Real-time Usage Analytics & Tracking</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={<MousePointer2 className="w-5 h-5" />} label="功能点击总次数" value={totalClicks} color="indigo" />
        <StatCard icon={<MessageSquare className="w-5 h-5" />} label="累计分析聊天条数" value={totalChatCount} color="emerald" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="今日使用时长" value={todayDuration} color="amber" />
        <StatCard icon={<Zap className="w-5 h-5" />} label="今日活跃次数" value={todayActiveCount} color="rose" />
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="累计输出负面案例" value={totalNegativeCount} color="orange" />
        <StatCard icon={<Users className="w-5 h-5" />} label="累计重点玩家画像" value={totalKeyPlayerCount} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-indigo-600" />
            功能点击分布
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((_, index) => (
                    <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            近7日活跃趋势
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="count" name="操作次数" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-6">
          <PieChartIcon className="w-5 h-5 text-amber-500" />
          功能使用占比
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((_, index) => (
                  <Cell key={`pie-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            实时流水追踪
          </h3>
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full uppercase tracking-widest animate-pulse">Live</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">时间</th>
                <th className="px-8 py-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">账号</th>
                <th className="px-8 py-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">行为</th>
                <th className="px-8 py-4 text-[10px] uppercase font-black text-slate-400 tracking-widest">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.slice(0, 100).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-8 py-4 whitespace-nowrap">
                    <span className="text-xs font-bold text-slate-500 tabular-nums">{log.timestamp.slice(11, 19)}</span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-100 rounded-md flex items-center justify-center text-[10px] font-black text-slate-400">
                        {(log.username || 'U')[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-black text-slate-700">{log.username}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${getActionColor(log.action)}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-slate-600 truncate max-w-xs">{log.details || '-'}</span>
                      {log.chatCount !== undefined && (
                        <span className="text-[10px] text-emerald-600 font-bold">{log.chatCount} 条聊天</span>
                      )}
                      {(log.negativeCount !== undefined || log.keyPlayerCount !== undefined) && (
                        <span className="text-[10px] text-orange-500 font-bold">
                          {log.negativeCount ?? 0} 个负面案例 · {log.keyPlayerCount ?? 0} 位重点玩家
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };
  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-slate-900 tabular-nums mt-1">{value}</p>
      </div>
    </div>
  );
}

function getActionColor(action: string) {
  if (action.startsWith('analysis')) return 'bg-indigo-100 text-indigo-700';
  if (action === 'login' || action === 'session_start') return 'bg-emerald-100 text-emerald-700';
  if (action === 'tab_switch') return 'bg-slate-100 text-slate-600';
  if (action === 'search') return 'bg-amber-100 text-amber-700';
  if (action.startsWith('delete')) return 'bg-rose-100 text-rose-700';
  if (action.startsWith('simulation')) return 'bg-purple-100 text-purple-700';
  if (action.startsWith('case')) return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}
