import React from 'react';
import {
  Crown, LogOut, LayoutGrid, Monitor, CheckSquare, Archive, BarChart2, UserCircle,
  ChevronDown, ChevronRight, Sparkles, Loader2, AlertTriangle, FileText,
  CheckCircle2, Clock, Server, RefreshCw, MessageSquare, Zap, Activity,
  Shield, Users, Check, X, ThumbsDown,
} from 'lucide-react';
import { User as UserType, ExecutionRecord, LeaderReview, HistoryRecord, ServerProfile, AnalysisCase, PlayerBehaviorReport } from '../types';
import * as dataService from '../lib/dataService';
import { logUsage } from '../services/analyticsService';
import PortraitTableCard from './PortraitTableCard';
import { qualityCheckExecution } from '../lib/gemini';

interface Props {
  user: UserType;
  onSwitchPortal: () => void;
  onLogout: () => void;
}

type Tab = '大盘监控' | '审批中心' | '案例归档' | '复盘报表' | '个人中心';

const TABS: { id: Tab; icon: React.ReactElement }[] = [
  { id: '大盘监控', icon: <Monitor className="w-5 h-5" /> },
  { id: '审批中心', icon: <CheckSquare className="w-5 h-5" /> },
  { id: '案例归档', icon: <Archive className="w-5 h-5" /> },
  { id: '复盘报表', icon: <BarChart2 className="w-5 h-5" /> },
  { id: '个人中心', icon: <UserCircle className="w-5 h-5" /> },
];

const PRESET_GROUPS = ['杭州三组', '杭州五组', '杭州对抗组', '山东一组', '山东对抗组', '山东对抗二组', '山东二组', '山东九组', '山东三组'];

const STATUS_STYLE: Record<string, string> = {
  '待审核': 'bg-blue-50 text-blue-600 border-blue-200',
  '待归档': 'bg-violet-50 text-violet-600 border-violet-200',
  '已完成': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  '草稿': 'bg-slate-100 text-slate-500 border-slate-200',
  '待推进': 'bg-amber-50 text-amber-600 border-amber-200',
};

const RATING_STYLE: Record<string, string> = {
  '优': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '良': 'bg-blue-50 text-blue-700 border-blue-200',
  '需改进': 'bg-amber-50 text-amber-700 border-amber-200',
  '存在问题': 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function LeaderPortal({ user, onSwitchPortal, onLogout }: Props) {
  const [activeTab, setActiveTab] = React.useState<Tab>('大盘监控');
  const [allProfiles, setAllProfiles] = React.useState<ServerProfile[]>([]);
  const [allExecRecords, setAllExecRecords] = React.useState<ExecutionRecord[]>([]);
  const [allHistory, setAllHistory] = React.useState<(HistoryRecord & { userId: string })[]>([]);
  const [leaderReviews, setLeaderReviews] = React.useState<LeaderReview[]>([]);
  const [dismissedOutbursts, setDismissedOutbursts] = React.useState<{ historyRecordId: string; outburstIndex: number }[]>([]);
  const [allMembers, setAllMembers] = React.useState<{ userId: string; username: string }[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [leaderGroup, setLeaderGroup] = React.useState<string>(() => {
    const saved = localStorage.getItem(`leader_group_${user.id}`);
    return saved && PRESET_GROUPS.includes(saved) ? saved : PRESET_GROUPS[0];
  });
  const handleGroupChange = (g: string) => {
    setLeaderGroup(g);
    localStorage.setItem(`leader_group_${user.id}`, g);
  };

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const [profiles, execs, hist, reviews, dismissed, members] = await Promise.all([
      dataService.fetchAllServerProfilesForLeader(leaderGroup),
      dataService.fetchAllExecutionRecordsForLeader(leaderGroup),
      dataService.fetchAllHistoryForLeader(leaderGroup),
      dataService.fetchLeaderReviews(),
      dataService.fetchDismissedOutbursts(),
      dataService.fetchGroupMembers(leaderGroup),
    ]);
    setAllProfiles(profiles);
    setAllExecRecords(execs);
    setAllHistory(hist);
    setLeaderReviews(reviews);
    setDismissedOutbursts(dismissed);
    setAllMembers(members);
    setLoading(false);
  }, [leaderGroup]);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleDismissOutburst = async (historyRecordId: string, outburstIndex: number) => {
    await dataService.dismissOutburst(historyRecordId, outburstIndex);
    await loadData();
  };

  const pendingReview = allExecRecords.filter(r => r.submissionStatus === '待审核').length;
  const pendingArchive = allExecRecords.filter(r => r.submissionStatus === '待归档').length;

  const enrichedMembers = React.useMemo(() => {
    const map = new Map<string, string>();
    // Prefer cloud-fetched username
    allMembers.forEach(m => { if (m.username) map.set(m.userId, m.username); });
    // Supplement / fallback from profiles (works even when cloud query returns nothing)
    allProfiles.forEach(p => {
      if (p.ownerId && !map.has(p.ownerId)) {
        map.set(p.ownerId, p.gsName || p.ownerId);
      }
    });
    return Array.from(map.entries()).map(([userId, username]) => ({ userId, username }));
  }, [allMembers, allProfiles]);

  return (
    <div className="min-h-screen bg-white flex font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center">
              <Crown className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">组长工作台</p>
              <p className="text-xs font-bold text-slate-700 truncate">{user.username}</p>
              <p className="text-[10px] text-indigo-600 font-semibold">{leaderGroup}</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-b border-slate-100 grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-lg font-black text-blue-600">{pendingReview}</p>
            <p className="text-[9px] font-bold text-blue-400 leading-none">待审工单</p>
          </div>
          <div className="text-center p-2 bg-violet-50 rounded-xl border border-violet-100">
            <p className="text-lg font-black text-violet-600">{pendingArchive}</p>
            <p className="text-[9px] font-bold text-violet-400 leading-none">待审案例</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-semibold ${
                activeTab === t.id ? 'bg-amber-50 text-indigo-600 border border-amber-200/80' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}>
              <div className={activeTab === t.id ? 'text-indigo-600' : 'text-slate-400'}>{t.icon}</div>
              {t.id}
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-100 space-y-0.5">
          <button onClick={onSwitchPortal} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-amber-50 hover:text-indigo-600 transition-colors text-sm font-semibold">
            <LayoutGrid className="w-4 h-4" /> 切换端口
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors text-sm font-semibold">
            <LogOut className="w-4 h-4" /> 退出登录
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="px-8 py-4 sticky top-0 bg-white z-40 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-400">{activeTab}</p>
          <button onClick={loadData} className="p-2 hover:bg-slate-100 rounded-xl transition-colors" title="刷新数据">
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        <div className="px-8 py-8 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载数据中...
            </div>
          ) : (
            <>
              {activeTab === '大盘监控' && (
                <DashboardTab
                  profiles={allProfiles}
                  history={allHistory}
                  execRecords={allExecRecords}
                  dismissedOutbursts={dismissedOutbursts}
                  onDismiss={handleDismissOutburst}
                  members={enrichedMembers}
                />
              )}
              {activeTab === '审批中心' && (
                <ApprovalTab
                  execRecords={allExecRecords.filter(r => r.submissionStatus === '待审核')}
                  history={allHistory}
                  leaderReviews={leaderReviews}
                  userId={user.id}
                  onRefresh={loadData}
                  members={enrichedMembers}
                />
              )}
              {activeTab === '案例归档' && (
                <ArchiveTab
                  execRecords={allExecRecords.filter(r => r.submissionStatus === '待归档')}
                  history={allHistory}
                  profiles={allProfiles}
                  userId={user.id}
                  onRefresh={loadData}
                />
              )}
              {activeTab === '复盘报表' && (
                <ReportTab profiles={allProfiles} history={allHistory} execRecords={allExecRecords} leaderReviews={leaderReviews} />
              )}
              {activeTab === '个人中心' && (
                <ProfileTab user={user} leaderGroup={leaderGroup} groups={PRESET_GROUPS} onGroupChange={handleGroupChange} onLogout={onLogout} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Shared: Outburst Detail Panel ───────────────────────────────────────────

function OutburstPanel({ ob, playerName }: { ob: any; playerName: string }) {
  return (
    <div className="space-y-4 rounded-2xl border border-rose-100 bg-rose-50/30 p-4">
      {/* Title + tags */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <h4 className="text-base font-black text-slate-900 leading-snug">{ob.title ?? ob.trigger}</h4>
        </div>
        {ob.tags && ob.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-6">
            {ob.tags.map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 bg-rose-200 text-rose-700 text-[10px] font-black rounded-full">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Case background */}
      {ob.caseBackground && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">案例背景</p>
          <p className="text-xs text-slate-600 bg-white border border-slate-100 rounded-xl p-3 leading-relaxed">{ob.caseBackground}</p>
        </div>
      )}

      {/* Trigger point */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
          <Activity className="w-3 h-3" /> 负面触发点
        </p>
        <p className="text-xs text-orange-900 bg-orange-50 border border-orange-100 rounded-xl p-3 leading-relaxed font-medium">{ob.triggerPoint || ob.trigger}</p>
      </div>

      {/* Context bubbles */}
      {ob.context && ob.context.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> 溯源上下文
          </p>
          <div className="space-y-2 bg-white border border-slate-100 rounded-xl p-3 max-h-48 overflow-y-auto">
            {ob.context.map((msg: any, i: number) => (
              <div key={i} className={`flex ${msg.roleName === playerName ? 'justify-start' : 'justify-end'} gap-2`}>
                <div className="max-w-[80%] space-y-0.5">
                  <div className="flex items-center gap-1 px-1">
                    <span className="text-[9px] text-slate-400 font-bold">{msg.roleName}</span>
                    <span className="text-[9px] text-slate-300">{msg.time}</span>
                  </div>
                  <div className={`px-2.5 py-1.5 rounded-xl text-xs leading-relaxed ${
                    msg.roleName === playerName ? 'bg-slate-100 text-slate-800' : 'bg-indigo-600 text-white'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GS advice action */}
      {ob.gsAdvice?.action && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1">
            <Zap className="w-3 h-3" /> AI建议处置动作
          </p>
          <p className="text-xs text-slate-800 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed font-medium whitespace-pre-line">{ob.gsAdvice.action}</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab 1: Dashboard ───────────────────────────────────────────────────────

function DashboardTab({ profiles, history, execRecords, dismissedOutbursts, onDismiss, members }: {
  profiles: ServerProfile[];
  history: (HistoryRecord & { userId: string })[];
  execRecords: ExecutionRecord[];
  dismissedOutbursts: { historyRecordId: string; outburstIndex: number }[];
  onDismiss: (historyRecordId: string, outburstIndex: number) => void;
  members: { userId: string; username: string }[];
}) {
  const [selectedMemberId, setSelectedMemberId] = React.useState('全部');
  const [expandedServer, setExpandedServer] = React.useState<string | null>(null);
  const [expandedPortrait, setExpandedPortrait] = React.useState<PlayerBehaviorReport | null>(null);

  const gsProfiles = selectedMemberId === '全部'
    ? profiles
    : profiles.filter(p => p.ownerId === selectedMemberId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-xs font-bold text-slate-500">组员账号：</label>
        <select value={selectedMemberId} onChange={e => { setSelectedMemberId(e.target.value); setExpandedServer(null); }}
          className="px-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="全部">全部</option>
          {members.length === 0 && <option disabled value="">（暂无已注册组员）</option>}
          {members.map(m => <option key={m.userId} value={m.userId}>{m.username}</option>)}
        </select>
      </div>

      {gsProfiles.length === 0 ? <EmptyState text="该 GS 暂无上传区服" /> : (
        <div className="space-y-3">
          {gsProfiles.map(profile => {
            const profHistory = history.filter(h =>
              (h.serverConfig as any)?.id === profile.id || (h.serverConfig as any)?.name === profile.name
            );
            const profExecs = execRecords.filter(r => r.serverProfileName === profile.name);
            const completedExecs = profExecs.filter(r => r.submissionStatus === '已完成').length;
            const portraitCount = Object.keys(profile.persistentPortraits ?? {}).length;
            const keyPlayerCount = profile.keyPlayers?.length ?? 0;

            // Activity metrics based on chat message frequency
            const totalContextMsgs = profHistory.reduce((sum, h) =>
              sum + (h.result?.playerReports?.reduce((s2, r) =>
                s2 + (r.negativeOutbursts?.reduce((s3, ob) => s3 + (ob.context?.length ?? 0), 0) ?? 0), 0) ?? 0), 0);
            const gsActivityCount = profExecs.length;

            // Build flat outburst list for this server (respecting dismissed)
            interface DashTicket {
              historyRecordId: string;
              outburstIndex: number;
              ob: any;
              playerName: string;
            }
            const dashTickets: DashTicket[] = [];
            profHistory.forEach(h => {
              let perRecordIdx = 0;
              (h.result?.playerReports ?? []).forEach(report => {
                (report.negativeOutbursts ?? []).forEach(ob => {
                  const idx = perRecordIdx++;
                  if (!dismissedOutbursts.some(d => d.historyRecordId === h.id && d.outburstIndex === idx)) {
                    dashTickets.push({ historyRecordId: h.id, outburstIndex: idx, ob, playerName: report.roleName });
                  }
                });
              });
            });

            const isExpanded = expandedServer === profile.id;

            return (
              <div key={profile.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <button onClick={() => setExpandedServer(isExpanded ? null : profile.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <Server className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-slate-800">{profile.name}</span>
                    {profile.mergeStage && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">{profile.mergeStage}</span>
                    )}
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-slate-100 p-5 space-y-5 bg-slate-50/30">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: '玩家活跃度', value: `${totalContextMsgs} 条消息` },
                        { label: 'GS 活跃度', value: `${gsActivityCount} 次跟进` },
                        { label: '画像完成度', value: keyPlayerCount > 0 ? `${portraitCount}/${keyPlayerCount}` : `${portraitCount} 个` },
                        { label: '工单完成率', value: profExecs.length > 0 ? `${completedExecs}/${profExecs.length}` : '暂无工单' },
                      ].map(s => (
                        <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                          <p className="text-sm font-black text-indigo-600 mt-1">{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {profile.serverEcology && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">区服生态总结</p>
                        <p className="text-sm text-slate-600 leading-relaxed bg-white rounded-xl border border-slate-200 p-4">{profile.serverEcology}</p>
                      </div>
                    )}

                    {(() => {
                      const latestHistory = profHistory
                        .slice()
                        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
                      const keyPlayerPortraits = (latestHistory?.result?.playerReports ?? [])
                        .filter(p => p.portraitTable?.isKeyPlayer);
                      if (keyPlayerPortraits.length === 0) return null;
                      return (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                            重点玩家画像 ({keyPlayerPortraits.length} 人)
                          </p>
                          <div className="grid grid-cols-1 gap-2">
                            {keyPlayerPortraits.map(p => {
                              const pt = p.portraitTable!;
                              return (
                                <button key={p.roleName} onClick={() => setExpandedPortrait(p)}
                                  className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 space-y-1.5 hover:border-indigo-300 hover:bg-indigo-50/20 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-black text-slate-800 text-sm">{p.roleName}</span>
                                      <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">重点玩家</span>
                                    </div>
                                    <span className="text-xs font-black text-indigo-600">{Math.round(pt.overallCompletion * 100)}%</span>
                                  </div>
                                  <p className="text-xs text-slate-500 line-clamp-2 italic">{p.portrait.summary || '暂无总结'}</p>
                                  <div className="flex items-center gap-4 text-xs">
                                    <span className="text-slate-500">累计充值：<span className="font-bold text-indigo-600">¥{pt.basicData.totalRecharge.toLocaleString()}</span></span>
                                    {pt.basicData.anomalySignals && pt.basicData.anomalySignals !== '无' && (
                                      <span className="text-rose-500 font-medium">⚠ {pt.basicData.anomalySignals}</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {dashTickets.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                          负面工单 ({dashTickets.length} 条)
                        </p>
                        <div className="space-y-2">
                          {dashTickets.map((t, i) => {
                            const exec = profExecs.find(e => e.historyRecordId === t.historyRecordId && e.outburstIndex === t.outburstIndex);
                            const status = exec?.submissionStatus ?? '待处理';
                            return (
                              <DashTicketRow
                                key={i}
                                ticket={t}
                                status={status}
                                onDismiss={onDismiss}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {expandedPortrait && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setExpandedPortrait(null)}>
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <p className="text-lg font-black text-slate-900">玩家画像详情</p>
              <button onClick={() => setExpandedPortrait(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <PortraitTableCard player={expandedPortrait} onUpdatePortrait={undefined} />
          </div>
        </div>
      )}
    </div>
  );
}

const DashTicketRow = React.memo(function DashTicketRow({ ticket, status, onDismiss }: {
  ticket: { historyRecordId: string; outburstIndex: number; ob: any; playerName: string };
  status: string;
  onDismiss: (historyRecordId: string, outburstIndex: number) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [pendingDismiss, setPendingDismiss] = React.useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[status] ?? 'bg-orange-50 text-orange-600 border-orange-200'}`}>
          {status}
        </span>
        <span className="text-sm text-slate-700 font-medium truncate flex-1">{ticket.ob.title ?? ticket.ob.trigger}</span>
        <span className="text-xs text-slate-400 shrink-0">{ticket.playerName}</span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/30">
          <OutburstPanel ob={ticket.ob} playerName={ticket.playerName} />

          {/* Accuracy marking */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">标记识别正确性</p>
            {!pendingDismiss ? (
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-600">
                  <Check className="w-3.5 h-3.5" /> 正确识别
                </div>
                <button
                  onClick={() => setPendingDismiss(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors"
                >
                  <ThumbsDown className="w-3.5 h-3.5" /> 错误识别
                </button>
              </div>
            ) : (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
                <p className="text-sm font-bold text-rose-700">确认将此工单标记为"错误识别"并从组员端同步删除？</p>
                <p className="text-xs text-rose-500">此操作不可撤销，该负面工单将从大盘和组员首页中移除。</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      onDismiss(ticket.historyRecordId, ticket.outburstIndex);
                    }}
                    className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors"
                  >
                    确认删除
                  </button>
                  <button
                    onClick={() => setPendingDismiss(false)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Tab 2: Approval ──────────────────────────────────────────────────────

function ApprovalTab({ execRecords, history, leaderReviews, userId, onRefresh, members }: {
  execRecords: ExecutionRecord[];
  history: (HistoryRecord & { userId: string })[];
  leaderReviews: LeaderReview[];
  userId: string;
  onRefresh: () => void;
  members: { userId: string; username: string }[];
}) {
  const [selectedMemberId, setSelectedMemberId] = React.useState('全部');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const filtered = selectedMemberId === '全部' ? execRecords : execRecords.filter(r => r.ownerId === selectedMemberId);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-xs font-bold text-slate-500">组员账号：</label>
        <select value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)}
          className="px-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="全部">全部</option>
          {members.length === 0 && <option disabled value="">（暂无已注册组员）</option>}
          {members.map(m => <option key={m.userId} value={m.userId}>{m.username}</option>)}
        </select>
        <span className="text-xs text-slate-400 font-medium">{filtered.length} 条待审</span>
      </div>

      {filtered.length === 0 ? <EmptyState text="暂无待审核工单" /> : (
        <div className="space-y-3">
          {filtered.map(rec => {
            const review = leaderReviews.find(r => r.executionRecordId === rec.id);
            const isExpanded = expandedId === rec.id;
            return (
              <TicketCard key={rec.id} record={rec} review={review} history={history}
                isExpanded={isExpanded} onToggle={() => setExpandedId(isExpanded ? null : rec.id)}
                userId={userId} onRefresh={onRefresh} />
            );
          })}
        </div>
      )}
    </div>
  );
}

const TicketCard = React.memo(function TicketCard({ record, review, history, isExpanded, onToggle, userId, onRefresh }: {
  record: ExecutionRecord;
  review?: LeaderReview;
  history: (HistoryRecord & { userId: string })[];
  isExpanded: boolean;
  onToggle: () => void;
  userId: string;
  onRefresh: () => void;
}) {
  const [aiResult, setAiResult] = React.useState<any>(review?.aiCheckResult ? JSON.parse(review.aiCheckResult) : null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [isGsCaused, setIsGsCaused] = React.useState<boolean | null>(review?.isGsCaused ?? null);
  const [comment, setComment] = React.useState(review?.comment ?? '');
  const [saving, setSaving] = React.useState(false);

  const histRecord = history.find(h => h.id === record.historyRecordId);
  const outburst = React.useMemo(() => {
    if (!histRecord) return null;
    let idx = 0;
    for (const report of histRecord.result?.playerReports ?? []) {
      for (const ob of report.negativeOutbursts ?? []) {
        if (idx === record.outburstIndex) return { ob, playerName: report.roleName };
        idx++;
      }
    }
    return null;
  }, [histRecord, record.outburstIndex]);

  const handleAiCheck = async () => {
    setAiLoading(true);
    try {
      const result = await qualityCheckExecution(
        record.outburstTitle,
        outburst?.ob.triggerPoint ?? outburst?.ob.trigger ?? '',
        outburst?.ob.gsAdvice?.action ?? '',
        record.description,
        record.category
      );
      setAiResult(result);
      await dataService.saveLeaderReview({
        id: review?.id ?? `review_${Date.now()}`,
        executionRecordId: record.id,
        isGsCaused,
        comment,
        decision: review?.decision ?? null,
        aiCheckResult: JSON.stringify(result),
        reviewedAt: new Date().toISOString(),
        reviewerId: userId,
        memberUserId: record.ownerId,
      });
      onRefresh();
    } catch (e) { console.error(e); } finally { setAiLoading(false); }
  };

  const handleDecision = async (decision: '打回' | '继续推进' | '结案') => {
    setSaving(true);
    const newStatus = decision === '打回' ? '草稿' : decision === '结案' ? '已完成' : '待审核';
    await dataService.saveLeaderReview({
      id: review?.id ?? `review_${Date.now()}`,
      executionRecordId: record.id,
      isGsCaused,
      comment,
      decision,
      aiCheckResult: aiResult ? JSON.stringify(aiResult) : review?.aiCheckResult,
      reviewedAt: new Date().toISOString(),
      reviewerId: userId,
      memberUserId: record.ownerId,
    });
    await dataService.updateExecutionRecord(record.id, { submissionStatus: newStatus });
    setSaving(false);
    onRefresh();
  };

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[record.category]}`}>{record.category}</span>
          <span className="font-bold text-slate-800 truncate">{record.playerName}</span>
          <span className="text-sm text-slate-500 truncate hidden sm:block">{record.outburstTitle}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-400">{record.date}</span>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 p-5 space-y-5 bg-slate-50/30">

          {/* 0. Full negative case info */}
          {outburst && (
            <Section title="负面案例详情">
              <OutburstPanel ob={outburst.ob} playerName={outburst.playerName} />
            </Section>
          )}

          {/* 1. Execution record */}
          <Section title="GS执行记录">
            <div className="space-y-3">
              <InfoRow label="分类" value={record.category} />
              <InfoRow label="记录日期" value={record.date} />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">解决过程描述</p>
                <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
                  {record.description || '（无描述）'}
                </p>
              </div>
              {(record as any).reflection && (
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">案例结果与反思</p>
                  <p className="text-sm text-slate-700 bg-emerald-50 border border-emerald-100 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
                    {(record as any).reflection}
                  </p>
                </div>
              )}
              {record.attachments.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">附件 ({record.attachments.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {record.attachments.map((att, i) => (
                      att.type.startsWith('image/') ? (
                        <img key={i} src={att.dataUrl} alt={att.name} className="w-20 h-20 object-cover rounded-xl border border-slate-200" />
                      ) : (
                        <div key={i} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                          <FileText className="w-4 h-4 text-slate-400" />{att.name}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* 2. AI quality check — 3 key areas */}
          <Section title="AI 辅助核实">
            {!aiResult ? (
              <button onClick={handleAiCheck} disabled={aiLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                发起 AI 质检
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-3 py-1 rounded-full border ${RATING_STYLE[aiResult.rating] ?? ''}`}>
                    综合评级：{aiResult.rating}
                  </span>
                  <button onClick={handleAiCheck} disabled={aiLoading} className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                    {aiLoading ? '检测中...' : '重新质检'}
                  </button>
                </div>
                {[
                  { label: '执行摘要', value: aiResult.summary },
                  { label: 'GS执行合理性', value: aiResult.reasonabilityCheck },
                  { label: '疑点与风险', value: aiResult.riskPoints },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                    <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 3. Leader follow-up */}
          <Section title="组长跟进">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">玩家负面是否由 GS 造成</p>
                <div className="flex gap-2">
                  {([true, false, null] as const).map(v => (
                    <button key={String(v)} onClick={() => setIsGsCaused(v)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                        isGsCaused === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}>
                      {v === true ? '是' : v === false ? '否' : '不确定'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">批注与建议</p>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                  placeholder="输入组长批注、改进建议..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
              </div>
            </div>
          </Section>

          {/* 4. Decision */}
          <div className="flex gap-3 pt-1">
            <button onClick={() => handleDecision('打回')} disabled={saving}
              className="px-5 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-sm font-bold hover:bg-rose-100 disabled:opacity-40 transition-colors">
              打回
            </button>
            <button onClick={() => handleDecision('继续推进')} disabled={saving}
              className="px-5 py-2.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-sm font-bold hover:bg-amber-100 disabled:opacity-40 transition-colors">
              继续推进
            </button>
            <button onClick={() => handleDecision('结案')} disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-lg shadow-emerald-100">
              结案
            </button>
            {saving && <Loader2 className="w-5 h-5 animate-spin text-slate-400 self-center" />}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Tab 3: Archive ───────────────────────────────────────────────────────

function ArchiveTab({ execRecords, history, profiles, userId, onRefresh }: {
  execRecords: ExecutionRecord[];
  history: (HistoryRecord & { userId: string })[];
  profiles: ServerProfile[];
  userId: string;
  onRefresh: () => void;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <div className="space-y-3">
      {execRecords.length === 0 ? <EmptyState text="暂无待归档案例，组员点击'生成案例'后将出现在此处" /> : (
        execRecords.map(rec => {
          const histRecord = history.find(h => h.id === rec.historyRecordId);
          const profile = profiles.find(p => p.name === rec.serverProfileName);
          return (
            <ArchiveCard key={rec.id} record={rec} histRecord={histRecord} profile={profile}
              isExpanded={expandedId === rec.id}
              onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
              userId={userId} onRefresh={onRefresh} />
          );
        })
      )}
    </div>
  );
}

const CASE_TAGS = [
  '区服矛盾调解', '大R负面解决', '大R预流失挽回', '付费活动引导',
  '系统自动提取', '其他价值案例', '跨部门协作', '1-15天维护思路', '对抗号维护思路',
];

const CASE_FIELD_LABELS: Record<string, string> = {
  title: '案例标题',
  outburstReason: '玩家负面原因',
  triggerPoint: '负面触发点',
  caseBackground: '案例背景',
  gsAction: 'GS处置动作',
  disposalPlan: '处置方案',
  caseResult: '案例结果',
};

const ArchiveCard = React.memo(function ArchiveCard({ record, histRecord, profile, isExpanded, onToggle, userId, onRefresh }: {
  record: ExecutionRecord;
  histRecord?: HistoryRecord & { userId: string };
  profile?: ServerProfile;
  isExpanded: boolean;
  onToggle: () => void;
  userId: string;
  onRefresh: () => void;
}) {
  const preloadedCase = React.useMemo(() => {
    if (!record.caseContent) return null;
    try { return JSON.parse(record.caseContent) as Partial<AnalysisCase>; } catch { return null; }
  }, [record.caseContent]);

  const [caseData, setCaseData] = React.useState<Partial<AnalysisCase> | null>(preloadedCase);
  const [editTags, setEditTags] = React.useState<string[]>(preloadedCase?.tags ?? []);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [archived, setArchived] = React.useState(false);

  const outburst = React.useMemo(() => {
    if (!histRecord) return null;
    let idx = 0;
    for (const report of histRecord.result?.playerReports ?? []) {
      for (const ob of report.negativeOutbursts ?? []) {
        if (idx === record.outburstIndex) return { ob, playerName: report.roleName };
        idx++;
      }
    }
    return null;
  }, [histRecord, record.outburstIndex]);

  const handleGenerateCase = async () => {
    setAiLoading(true);
    try {
      const prompt = `你是游戏运营案例库管理员，请根据以下运营复盘信息生成一条标准化案例记录。

【负面事件】
标题：${record.outburstTitle}
玩家：${record.playerName}
区服：${record.serverProfileName}
触发点：${outburst?.ob.triggerPoint ?? outburst?.ob.trigger ?? '未知'}
AI建议处置动作：${outburst?.ob.gsAdvice?.action ?? '未知'}

【GS实际执行记录】
分类：${record.category}
描述：${record.description || '无'}
案例结果与反思：${(record as any).reflection || '无'}

请严格返回JSON对象（不要markdown包裹）：
{
  "title": "案例标题（25字内）",
  "tags": ["标签1", "标签2"],
  "outburstReason": "玩家负面原因（50字内）",
  "triggerPoint": "负面触发点（30字内）",
  "caseBackground": "案例背景（100字内，描述事件发生的背景）",
  "gsAction": "GS处置动作总结（100字内）",
  "disposalPlan": "处置策略总结（80字内）",
  "caseResult": "案例结果评估（50字内）"
}`;

      const res = await fetch('/api/gemini/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }),
      });
      const data = await res.json();
      const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
      setCaseData(raw);
      setEditTags(raw.tags ?? []);
    } catch (e) { console.error(e); } finally { setAiLoading(false); }
  };

  const handleArchive = async (asExcellent: boolean) => {
    setArchiving(true);
    if (asExcellent && caseData) {
      const newCase: AnalysisCase = {
        id: `case_archive_${Date.now()}`,
        title: caseData.title ?? record.outburstTitle,
        tags: editTags,
        serverName: record.serverProfileName,
        gsName: profile?.gsName ?? '',
        playerName: record.playerName,
        mergeStage: profile?.mergeStage,
        caseBackground: caseData.caseBackground,
        outburstReason: caseData.outburstReason ?? '',
        triggerPoint: caseData.triggerPoint ?? '',
        context: outburst?.ob.context ?? [],
        gsAction: caseData.gsAction ?? '',
        disposalPlan: caseData.disposalPlan ?? '',
        caseResult: caseData.caseResult ?? '',
        timestamp: new Date().toISOString(),
        views: 0, likes: 0, votedUserIds: [],
        isPublic: true,
        ownerId: userId,
      };
      await dataService.saveManualCase(newCase);
      logUsage('case_saved', `组长归档案例: ${newCase.title}`);
    }
    await dataService.updateExecutionRecord(record.id, { submissionStatus: '已完成' });
    logUsage('ticket_review_complete', `工单结案: ${record.id}`);
    setArchived(true);
    setArchiving(false);
    onRefresh();
  };

  const toggleTag = (tag: string) => {
    setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  if (archived) return null;

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left">
        <div className="flex items-center gap-3 min-w-0">
          <Archive className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="font-bold text-slate-800 truncate">{record.playerName} · {record.outburstTitle}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-400">{record.date}</span>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 p-5 space-y-5 bg-slate-50/30">
          <Section title="执行记录">
            <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
              {record.description || '（无描述）'}
            </p>
          </Section>

          <Section title="整合案例内容">
            {!caseData ? (
              <button onClick={handleGenerateCase} disabled={aiLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI 生成案例摘要
              </button>
            ) : (
              <div className="space-y-3">
                {(Object.keys(CASE_FIELD_LABELS) as (keyof typeof CASE_FIELD_LABELS)[]).map(k => {
                  const v = (caseData as any)[k];
                  if (!v) return null;
                  return (
                    <div key={k}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{CASE_FIELD_LABELS[k]}</p>
                      <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2.5 leading-relaxed">{String(v)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {caseData && (
            <Section title="案例标签">
              <div className="flex flex-wrap gap-2">
                {CASE_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                      editTags.includes(tag)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </Section>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => handleArchive(true)}
              disabled={archiving || !caseData}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-lg shadow-emerald-100"
            >
              {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              转为优秀案例
            </button>
            <button
              onClick={() => handleArchive(false)}
              disabled={archiving}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 disabled:opacity-40 transition-colors"
            >
              不收录
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Tab 4: Report ────────────────────────────────────────────────────────

function ReportTab({ profiles, history, execRecords, leaderReviews }: {
  profiles: ServerProfile[];
  history: (HistoryRecord & { userId: string })[];
  execRecords: ExecutionRecord[];
  leaderReviews: LeaderReview[];
}) {
  const gsNames = [...new Set(profiles.map(p => p.gsName).filter(Boolean))] as string[];

  const stats = gsNames.map(gs => {
    const gsProfileIds = profiles.filter(p => p.gsName === gs).map(p => p.id);
    const gsProfileNames = profiles.filter(p => p.gsName === gs).map(p => p.name);
    const profHistory = history.filter(h =>
      gsProfileIds.includes((h.serverConfig as any)?.id) || gsProfileNames.includes((h.serverConfig as any)?.name)
    );
    const found = profHistory.reduce((s, h) => s + (h.result?.playerReports?.reduce((ss, r) => ss + (r.negativeOutbursts?.length ?? 0), 0) ?? 0), 0);
    const gsExecs = execRecords.filter(r => gsProfileNames.includes(r.serverProfileName));
    const executed = gsExecs.filter(r => r.category === '已解决').length;
    const closed = gsExecs.filter(r => r.submissionStatus === '已完成').length;
    const relatedReviews = leaderReviews.filter(rv => gsExecs.some(e => e.id === rv.executionRecordId) && rv.decision !== null);
    return { gs, found, executed, closed, followed: relatedReviews.length };
  });

  if (gsNames.length === 0) return <EmptyState text="暂无 GS 数据" />;

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {['GS 名称', '发现问题数', 'GS执行完成数', '结案达成数', '管理主动跟进数'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stats.map(s => {
              const rate = s.found > 0 ? Math.round((s.closed / s.found) * 100) : 0;
              return (
                <tr key={s.gs} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 font-bold text-slate-800">{s.gs}</td>
                  <td className="px-4 py-4"><span className="text-lg font-black text-indigo-600">{s.found}</span></td>
                  <td className="px-4 py-4"><span className="text-lg font-black text-emerald-600">{s.executed}</span></td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <span className="text-lg font-black text-blue-600">{s.closed}</span>
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">{rate}% 结案率</p>
                    </div>
                  </td>
                  <td className="px-4 py-4"><span className="text-lg font-black text-amber-600">{s.followed}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 5: Profile ───────────────────────────────────────────────────────

function ProfileTab({ user, leaderGroup, groups, onGroupChange, onLogout }: {
  user: UserType;
  leaderGroup: string;
  groups: string[];
  onGroupChange: (g: string) => void;
  onLogout: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
          <Crown className="w-10 h-10 text-amber-300" />
        </div>
        <div>
          <p className="text-xl font-black text-white">{user.username}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">组长 · {leaderGroup}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-black text-slate-800">所属组别</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          选择你所在的运营小组，系统会根据此分组筛选你负责的下属GS数据。
        </p>
        <div className="flex flex-wrap gap-2">
          {groups.map(g => (
            <button key={g} onClick={() => onGroupChange(g)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold transition-colors border ${
                leaderGroup === g
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <button onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-rose-50 text-rose-600 font-bold text-sm rounded-2xl hover:bg-rose-100 transition-colors border border-rose-100">
        <LogOut className="w-4 h-4" /> 退出登录
      </button>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}
