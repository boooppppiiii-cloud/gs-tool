import React, { useState, useEffect } from 'react';
import { getAnalyticsLogs, fetchAllAnalyticsLogs } from '../services/analyticsService';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  LineChart, Line,
  PieChart, Pie, Legend,
} from 'recharts';
import { Shield, Activity, Clock, Zap, MousePointer2, TrendingUp, PieChart as PieChartIcon, MessageSquare, AlertTriangle, Users, ThumbsUp, ThumbsDown, BookOpen } from 'lucide-react';

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
  analysis_feedback: '分析质量反馈',
  advice_rating: '处置建议评分',
  simulation_msg_rating: '模拟回复评分',
  kb_item_rating: '知识库满意度',
  kb_search_hit: '知识库命中',
  kb_search_miss: '知识库未命中',
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
  kb_search_hit: '知识库检索',
  kb_search_miss: '知识库检索',
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
    const load = async () => {
      try {
        const all = await fetchAllAnalyticsLogs();
        setLogs(all.length > 0 ? all : getAnalyticsLogs());
      } catch {
        setLogs(getAnalyticsLogs());
      }
    };
    load();
    const interval = setInterval(load, 30000);
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
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
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

      <FeedbackSummary logs={logs} />

      <KbSearchStats logs={logs} />

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

interface FeedbackEntry {
  accuracy: string;
  usefulness: string;
  comment?: string;
  missedChats?: string;
}

function RatingBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${color}`}>{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color.includes('indigo') ? 'bg-indigo-500' : color.includes('emerald') ? 'bg-emerald-500' : color.includes('amber') ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${(count / total) * 100}%` }} />
      </div>
      <span className="text-xs font-black text-slate-500 tabular-nums w-12 text-right">{count}/{total}</span>
    </div>
  );
}

function FeedbackSummary({ logs }: { logs: UsageLog[] }) {
  // 分析质量反馈
  const feedbackLogs = logs
    .filter(l => l.action === 'analysis_feedback')
    .map(l => { try { return JSON.parse(l.details) as FeedbackEntry; } catch { return null; } })
    .filter((x): x is FeedbackEntry => x !== null);

  // 处置建议评分
  const adviceLogs = logs
    .filter(l => l.action === 'advice_rating')
    .map(l => { try { return JSON.parse(l.details) as { playerName: string; trigger: string; rating: 'up' | 'down' }; } catch { return null; } })
    .filter(Boolean) as { playerName: string; trigger: string; rating: 'up' | 'down' }[];

  // 模拟回复评分
  const simLogs = logs
    .filter(l => l.action === 'simulation_msg_rating')
    .map(l => { try { return JSON.parse(l.details) as { msgIndex: number; rating: 'up' | 'down' }; } catch { return null; } })
    .filter(Boolean) as { msgIndex: number; rating: 'up' | 'down' }[];

  // 知识库满意度
  const kbLogs = logs
    .filter(l => l.action === 'kb_item_rating')
    .map(l => { try { return JSON.parse(l.details) as { itemName: string; rating: 'yes' | 'no' }; } catch { return null; } })
    .filter(Boolean) as { itemName: string; rating: 'yes' | 'no' }[];

  const hasAnyData = feedbackLogs.length > 0 || adviceLogs.length > 0 || simLogs.length > 0 || kbLogs.length > 0;
  if (!hasAnyData) return null;

  // 分析质量反馈统计
  const total = feedbackLogs.length;
  const accuracyCounts: Record<string, number> = {};
  const usefulnessCounts: Record<string, number> = {};
  feedbackLogs.forEach(f => {
    if (f.accuracy) accuracyCounts[f.accuracy] = (accuracyCounts[f.accuracy] || 0) + 1;
    if (f.usefulness) usefulnessCounts[f.usefulness] = (usefulnessCounts[f.usefulness] || 0) + 1;
  });
  const comments = feedbackLogs.filter(f => f.comment?.trim()).map(f => f.comment!).slice(0, 5);
  const missedChatsList = feedbackLogs
    .filter(f => f.missedChats?.trim())
    .map(f => f.missedChats!)
    .slice(0, 10);

  // 处置建议评分统计
  const adviceUp = adviceLogs.filter(l => l.rating === 'up').length;
  const adviceDown = adviceLogs.filter(l => l.rating === 'down').length;
  const adviceTotal = adviceLogs.length;
  const adviceByPlayer: Record<string, { up: number; down: number }> = {};
  adviceLogs.forEach(l => {
    if (!adviceByPlayer[l.playerName]) adviceByPlayer[l.playerName] = { up: 0, down: 0 };
    adviceByPlayer[l.playerName][l.rating]++;
  });

  // 模拟回复统计
  const simUp = simLogs.filter(l => l.rating === 'up').length;
  const simTotal = simLogs.length;

  // 知识库统计
  const kbYes = kbLogs.filter(l => l.rating === 'yes').length;
  const kbTotal = kbLogs.length;
  const kbMissItems = kbLogs.filter(l => l.rating === 'no').map(l => l.itemName);

  const accuracyColors: Record<string, string> = {
    '准确无遗漏': 'bg-emerald-100 text-emerald-700',
    '基本准确，有小错': 'bg-amber-100 text-amber-700',
    '有明显遗漏/误判': 'bg-rose-100 text-rose-700',
  };
  const usefulnessColors: Record<string, string> = {
    '非常有用，会采纳': 'bg-indigo-100 text-indigo-700',
    '部分参考': 'bg-amber-100 text-amber-700',
    '参考价值有限': 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
      <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-emerald-600" />
        内测质量反馈汇总
      </h3>

      {/* 分析质量反馈 */}
      {total > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">分析报告质量（{total} 条）</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">AI 识别准确率</p>
              {Object.entries(accuracyCounts).map(([label, count]) => (
                <RatingBar key={label} label={label} count={count} total={total} color={accuracyColors[label] || 'bg-slate-100 text-slate-600'} />
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">GS 建议实用性</p>
              {Object.entries(usefulnessCounts).map(([label, count]) => (
                <RatingBar key={label} label={label} count={count} total={total} color={usefulnessColors[label] || 'bg-slate-100 text-slate-600'} />
              ))}
            </div>
          </div>
          {missedChatsList.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold text-slate-500">用户补充的漏报聊天（最新 {missedChatsList.length} 条）</p>
              {missedChatsList.map((chat, i) => (
                <div key={i} className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                  <pre className="text-xs text-rose-900 leading-relaxed whitespace-pre-wrap font-mono">{chat}</pre>
                </div>
              ))}
            </div>
          )}
          {comments.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold text-slate-500">补充说明（最新 {comments.length} 条）</p>
              {comments.map((c, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed">"{c}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 处置建议评分 */}
      {adviceTotal > 0 && (
        <div className="space-y-4 border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ThumbsUp className="w-3 h-3" /> 处置建议评分（{adviceTotal} 条）
            </p>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${adviceTotal > 0 && adviceUp / adviceTotal >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              好评率 {adviceTotal > 0 ? Math.round((adviceUp / adviceTotal) * 100) : 0}%
            </span>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <ThumbsUp className="w-4 h-4" />
              <span className="text-lg font-black">{adviceUp}</span>
              <span className="text-xs text-slate-400">有用</span>
            </div>
            <div className="flex items-center gap-2 text-rose-500">
              <ThumbsDown className="w-4 h-4" />
              <span className="text-lg font-black">{adviceDown}</span>
              <span className="text-xs text-slate-400">没用</span>
            </div>
          </div>
          {Object.entries(adviceByPlayer).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-400">按玩家分组</p>
              {Object.entries(adviceByPlayer).map(([name, { up, down }]) => (
                <div key={name} className="flex items-center gap-3 text-xs">
                  <span className="font-bold text-slate-600 w-20 truncate">{name}</span>
                  <span className="text-emerald-600 font-black">👍 {up}</span>
                  <span className="text-rose-500 font-black">👎 {down}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 模拟回复评分 */}
      {simTotal > 0 && (
        <div className="space-y-3 border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">对话模拟回复评分（{simTotal} 条）</p>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${simTotal > 0 && simUp / simTotal >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              好评率 {simTotal > 0 ? Math.round((simUp / simTotal) * 100) : 0}%
            </span>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <ThumbsUp className="w-4 h-4" />
              <span className="text-lg font-black">{simUp}</span>
              <span className="text-xs text-slate-400">有用</span>
            </div>
            <div className="flex items-center gap-2 text-rose-500">
              <ThumbsDown className="w-4 h-4" />
              <span className="text-lg font-black">{simTotal - simUp}</span>
              <span className="text-xs text-slate-400">没用</span>
            </div>
          </div>
        </div>
      )}

      {/* 知识库满意度 */}
      {kbTotal > 0 && (
        <div className="space-y-3 border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-3 h-3" /> 知识库命中率（{kbTotal} 次查阅）
            </p>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${kbTotal > 0 && kbYes / kbTotal >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              命中率 {kbTotal > 0 ? Math.round((kbYes / kbTotal) * 100) : 0}%
            </span>
          </div>
          {kbMissItems.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-400">未解决的查阅（用户说"没帮助"的道具）</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set(kbMissItems)].slice(0, 10).map(name => (
                  <span key={name} className="px-2 py-0.5 bg-amber-50 border border-amber-100 rounded-lg text-[10px] font-black text-amber-700">{name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KbSearchStats({ logs }: { logs: UsageLog[] }) {
  const hitLogs = logs.filter(l => l.action === 'kb_search_hit');
  const missLogs = logs.filter(l => l.action === 'kb_search_miss');
  const totalSearches = hitLogs.length + missLogs.length;
  if (totalSearches === 0) return null;

  const hitRate = Math.round((hitLogs.length / totalSearches) * 100);
  const missTerms = [...new Set(missLogs.map(l => l.details).filter(Boolean))];

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
      <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-indigo-600" />
        知识库搜索命中率
      </h3>

      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-5xl font-black tabular-nums" style={{ color: hitRate >= 70 ? '#10b981' : hitRate >= 40 ? '#f59e0b' : '#ef4444' }}>
            {hitRate}%
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">命中率</p>
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-700 shrink-0">命中</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${hitRate}%` }} />
            </div>
            <span className="text-xs font-black text-slate-500 tabular-nums w-16 text-right">{hitLogs.length}/{totalSearches}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 text-rose-700 shrink-0">未命中</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-rose-400 transition-all" style={{ width: `${100 - hitRate}%` }} />
            </div>
            <span className="text-xs font-black text-slate-500 tabular-nums w-16 text-right">{missLogs.length}/{totalSearches}</span>
          </div>
        </div>
      </div>

      {missTerms.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">未命中搜索词（共 {missTerms.length} 个独立词条）</p>
          <div className="flex flex-wrap gap-2">
            {missTerms.slice(0, 30).map(term => (
              <span key={term} className="px-3 py-1 bg-rose-50 border border-rose-100 rounded-xl text-xs font-black text-rose-600">
                {term}
              </span>
            ))}
          </div>
          {missTerms.length > 30 && (
            <p className="text-[10px] text-slate-400 font-bold">还有 {missTerms.length - 30} 个未显示</p>
          )}
        </div>
      )}
    </div>
  );
}

function getActionColor(action: string) {
  if (action.startsWith('analysis')) return 'bg-indigo-100 text-indigo-700';
  if (action === 'login' || action === 'session_start') return 'bg-emerald-100 text-emerald-700';
  if (action === 'tab_switch') return 'bg-slate-100 text-slate-600';
  if (action === 'search' || action === 'kb_search_hit') return 'bg-amber-100 text-amber-700';
  if (action === 'kb_search_miss') return 'bg-rose-100 text-rose-700';
  if (action.startsWith('delete')) return 'bg-rose-100 text-rose-700';
  if (action.startsWith('simulation')) return 'bg-purple-100 text-purple-700';
  if (action.startsWith('case')) return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}
