import React from 'react';
import {
  Crown, LogOut, LayoutGrid, Monitor, CheckSquare, Archive, BarChart2,
  ChevronDown, ChevronRight, Sparkles, Loader2, AlertTriangle, FileText,
  Image as ImageIcon, CheckCircle2, Clock, User, Server, RefreshCw,
} from 'lucide-react';
import { User as UserType, ExecutionRecord, LeaderReview, HistoryRecord, ServerProfile, AnalysisCase } from '../types';
import * as dataService from '../lib/dataService';
import { qualityCheckExecution } from '../lib/gemini';

interface Props {
  user: UserType;
  onSwitchPortal: () => void;
  onLogout: () => void;
}

type Tab = '大盘监控' | '审批中心' | '案例归档' | '复盘报表';

const TABS: { id: Tab; icon: React.ReactElement }[] = [
  { id: '大盘监控', icon: <Monitor className="w-5 h-5" /> },
  { id: '审批中心', icon: <CheckSquare className="w-5 h-5" /> },
  { id: '案例归档', icon: <Archive className="w-5 h-5" /> },
  { id: '复盘报表', icon: <BarChart2 className="w-5 h-5" /> },
];

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
  const [loading, setLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const [profiles, execs, hist, reviews] = await Promise.all([
      dataService.fetchAllServerProfiles(),
      dataService.fetchAllExecutionRecords(),
      dataService.fetchAllHistory(),
      dataService.fetchLeaderReviews(),
    ]);
    setAllProfiles(profiles);
    setAllExecRecords(execs);
    setAllHistory(hist);
    setLeaderReviews(reviews);
    setLoading(false);
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const pendingReview = allExecRecords.filter(r => r.submissionStatus === '待审核').length;
  const pendingArchive = allExecRecords.filter(r => r.submissionStatus === '待归档').length;

  return (
    <div className="min-h-screen bg-white flex font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center">
              <Crown className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">组长工作台</p>
              <p className="text-xs font-bold text-slate-700 truncate">{user.username}</p>
            </div>
          </div>
        </div>
        {/* Pending badges */}
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
        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold ${
                activeTab === t.id
                  ? 'bg-amber-50 text-indigo-600 border border-amber-200/80'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <div className={activeTab === t.id ? 'text-indigo-600' : 'text-slate-400'}>{t.icon}</div>
              {t.id}
            </button>
          ))}
        </nav>
        {/* Footer */}
        <div className="px-3 py-4 border-t border-slate-100 space-y-0.5">
          <button onClick={onSwitchPortal} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-amber-50 hover:text-indigo-600 transition-all text-sm font-semibold">
            <LayoutGrid className="w-4 h-4" /> 切换端口
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all text-sm font-semibold">
            <LogOut className="w-4 h-4" /> 退出登录
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="px-8 py-4 sticky top-0 bg-white/95 backdrop-blur-sm z-40 border-b border-slate-100 flex items-center justify-between">
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
                <DashboardTab profiles={allProfiles} history={allHistory} execRecords={allExecRecords} />
              )}
              {activeTab === '审批中心' && (
                <ApprovalTab
                  execRecords={allExecRecords.filter(r => r.submissionStatus === '待审核')}
                  history={allHistory}
                  leaderReviews={leaderReviews}
                  userId={user.id}
                  onRefresh={loadData}
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Tab 1: Dashboard ───────────────────────────────────────────────────────

function DashboardTab({ profiles, history, execRecords }: {
  profiles: ServerProfile[];
  history: (HistoryRecord & { userId: string })[];
  execRecords: ExecutionRecord[];
}) {
  const gsNames = [...new Set(profiles.map(p => p.gsName).filter(Boolean))] as string[];
  const [selectedGs, setSelectedGs] = React.useState(gsNames[0] ?? '');
  const [expandedServer, setExpandedServer] = React.useState<string | null>(null);

  const gsProfiles = profiles.filter(p => p.gsName === selectedGs);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-xs font-bold text-slate-500">GS 名称：</label>
        <select
          value={selectedGs}
          onChange={e => { setSelectedGs(e.target.value); setExpandedServer(null); }}
          className="px-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {gsNames.length === 0 && <option value="">暂无数据</option>}
          {gsNames.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {gsProfiles.length === 0 ? (
        <EmptyState text="该 GS 暂无上传区服" />
      ) : (
        <div className="space-y-3">
          {gsProfiles.map(profile => {
            const profHistory = history.filter(h => (h.serverConfig as any)?.id === profile.id || (h.serverConfig as any)?.name === profile.name);
            const allOutbursts = profHistory.flatMap(h => h.result?.playerReports?.flatMap(r => r.negativeOutbursts ?? []) ?? []);
            const profExecs = execRecords.filter(r => r.serverProfileName === profile.name);
            const completedExecs = profExecs.filter(r => r.submissionStatus === '已完成').length;
            const portraitCount = Object.keys(profile.persistentPortraits ?? {}).length;
            const keyPlayerCount = profile.keyPlayers?.length ?? 0;
            const isExpanded = expandedServer === profile.id;

            return (
              <div key={profile.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <button
                  onClick={() => setExpandedServer(isExpanded ? null : profile.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
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
                    {/* Stats row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: '玩家活跃度', value: `${profHistory.reduce((s, h) => s + (h.result?.playerReports?.length ?? 0), 0)} 人次` },
                        { label: 'GS 活跃度', value: `${profHistory.length} 次分析` },
                        { label: '画像完成度', value: keyPlayerCount > 0 ? `${portraitCount}/${keyPlayerCount}` : `${portraitCount} 个` },
                        { label: '工单完成率', value: profExecs.length > 0 ? `${completedExecs}/${profExecs.length}` : '暂无工单' },
                      ].map(s => (
                        <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                          <p className="text-sm font-black text-indigo-600 mt-1">{s.value}</p>
                        </div>
                      ))}
                    </div>
                    {/* Ecology */}
                    {profile.serverEcology && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">区服生态总结</p>
                        <p className="text-sm text-slate-600 leading-relaxed bg-white rounded-xl border border-slate-200 p-4">{profile.serverEcology}</p>
                      </div>
                    )}
                    {/* Tickets */}
                    {allOutbursts.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">负面工单 ({allOutbursts.length} 条)</p>
                        <div className="space-y-2">
                          {allOutbursts.slice(0, 10).map((ob, i) => {
                            const exec = profExecs.find(e => e.outburstTitle === ((ob as any).title ?? ob.trigger));
                            const status = exec?.submissionStatus ?? '待处理';
                            return (
                              <div key={i} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status] ?? 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                                  {status}
                                </span>
                                <span className="text-sm text-slate-700 font-medium truncate">{(ob as any).title ?? ob.trigger}</span>
                              </div>
                            );
                          })}
                          {allOutbursts.length > 10 && <p className="text-xs text-slate-400 pl-2">…共 {allOutbursts.length} 条</p>}
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
    </div>
  );
}

// ─── Tab 2: Approval ──────────────────────────────────────────────────────

function ApprovalTab({ execRecords, history, leaderReviews, userId, onRefresh }: {
  execRecords: ExecutionRecord[];
  history: (HistoryRecord & { userId: string })[];
  leaderReviews: LeaderReview[];
  userId: string;
  onRefresh: () => void;
}) {
  const gsNames = [...new Set(execRecords.map(r => r.serverProfileName).filter(Boolean))];
  const [selectedGs, setSelectedGs] = React.useState('全部');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const filtered = selectedGs === '全部' ? execRecords : execRecords.filter(r => r.serverProfileName === selectedGs);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-xs font-bold text-slate-500">筛选区服：</label>
        <select
          value={selectedGs}
          onChange={e => setSelectedGs(e.target.value)}
          className="px-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="全部">全部</option>
          {gsNames.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="text-xs text-slate-400 font-medium">{filtered.length} 条待审</span>
      </div>

      {filtered.length === 0 ? <EmptyState text="暂无待审核工单" /> : (
        <div className="space-y-3">
          {filtered.map(rec => {
            const review = leaderReviews.find(r => r.executionRecordId === rec.id);
            const isExpanded = expandedId === rec.id;
            return (
              <TicketCard
                key={rec.id}
                record={rec}
                review={review}
                history={history}
                isExpanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : rec.id)}
                userId={userId}
                onRefresh={onRefresh}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function TicketCard({ record, review, history, isExpanded, onToggle, userId, onRefresh }: {
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

  // Find original outburst from history
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
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
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
          {/* 1. Execution record content */}
          <Section title="执行记录内容">
            <div className="space-y-3">
              <InfoRow label="分类" value={record.category} />
              <InfoRow label="记录日期" value={record.date} />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">解决过程描述</p>
                <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
                  {record.description || '（无描述）'}
                </p>
              </div>
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

          {/* 2. AI quality check */}
          <Section title="AI 辅助核实">
            {!aiResult ? (
              <button
                onClick={handleAiCheck}
                disabled={aiLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition-all"
              >
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
                  { label: '一致性评估', value: aiResult.consistencyCheck },
                  { label: '合理性评估', value: aiResult.reasonabilityCheck },
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
                    <button
                      key={String(v)}
                      onClick={() => setIsGsCaused(v)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                        isGsCaused === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {v === true ? '是' : v === false ? '否' : '不确定'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">批注与建议</p>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  placeholder="输入组长批注、改进建议..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>
            </div>
          </Section>

          {/* 4. Decision buttons */}
          <div className="flex gap-3 pt-1">
            <button onClick={() => handleDecision('打回')} disabled={saving}
              className="px-5 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-sm font-bold hover:bg-rose-100 disabled:opacity-40 transition-all">
              打回
            </button>
            <button onClick={() => handleDecision('继续推进')} disabled={saving}
              className="px-5 py-2.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-sm font-bold hover:bg-amber-100 disabled:opacity-40 transition-all">
              继续推进
            </button>
            <button onClick={() => handleDecision('结案')} disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-lg shadow-emerald-100">
              结案
            </button>
            {saving && <Loader2 className="w-5 h-5 animate-spin text-slate-400 self-center" />}
          </div>
        </div>
      )}
    </div>
  );
}

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
            <ArchiveCard
              key={rec.id}
              record={rec}
              histRecord={histRecord}
              profile={profile}
              isExpanded={expandedId === rec.id}
              onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
              userId={userId}
              onRefresh={onRefresh}
            />
          );
        })
      )}
    </div>
  );
}

function ArchiveCard({ record, histRecord, profile, isExpanded, onToggle, userId, onRefresh }: {
  record: ExecutionRecord;
  histRecord?: HistoryRecord & { userId: string };
  profile?: ServerProfile;
  isExpanded: boolean;
  onToggle: () => void;
  userId: string;
  onRefresh: () => void;
}) {
  const [aiCase, setAiCase] = React.useState<Partial<AnalysisCase> | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [rating, setRating] = React.useState<'转为优秀案例' | '差案例复盘' | '不收录'>('转为优秀案例');
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

请严格返回JSON对象（不要markdown包裹）：
{
  "title": "案例标题（25字内）",
  "tags": ["标签1", "标签2"],
  "outburstReason": "玩家负面原因（50字内）",
  "triggerPoint": "负面触发点（30字内）",
  "gsAction": "GS处置动作总结（100字内）",
  "disposalPlan": "处置策略总结（80字内）",
  "caseResult": "案例结果评估（50字内）"
}`;

      const res = await fetch('/api/gemini/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }),
      });
      const data = await res.json();
      const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
      setAiCase(raw);
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    if (aiCase && rating !== '不收录') {
      const newCase: AnalysisCase = {
        id: `case_archive_${Date.now()}`,
        title: aiCase.title ?? record.outburstTitle,
        tags: aiCase.tags ?? [],
        serverName: record.serverProfileName,
        gsName: profile?.gsName ?? '',
        playerName: record.playerName,
        mergeStage: profile?.mergeStage,
        outburstReason: aiCase.outburstReason ?? '',
        triggerPoint: aiCase.triggerPoint ?? '',
        context: outburst?.ob.context ?? [],
        gsAction: aiCase.gsAction ?? '',
        disposalPlan: aiCase.disposalPlan ?? '',
        caseResult: aiCase.caseResult ?? '',
        timestamp: new Date().toISOString(),
        views: 0,
        likes: 0,
        votedUserIds: [],
        isPublic: rating === '转为优秀案例',
        ownerId: userId,
      };
      await dataService.saveManualCase(newCase);
    }
    await dataService.updateExecutionRecord(record.id, { submissionStatus: '已完成' });
    setArchived(true);
    setArchiving(false);
    onRefresh();
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
          {/* Execution summary */}
          <Section title="执行记录">
            <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
              {record.description || '（无描述）'}
            </p>
          </Section>

          {/* AI generate */}
          <Section title="AI 生成完整案例">
            {!aiCase ? (
              <button onClick={handleGenerateCase} disabled={aiLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition-all">
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI 生成案例摘要
              </button>
            ) : (
              <div className="space-y-3">
                {Object.entries(aiCase).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{k}</p>
                    <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2.5">{Array.isArray(v) ? v.join('、') : String(v)}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Rating + Archive */}
          <Section title="案例定级">
            <div className="space-y-3">
              <select
                value={rating}
                onChange={e => setRating(e.target.value as any)}
                className="px-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="转为优秀案例">转为优秀案例（公开）</option>
                <option value="差案例复盘">差案例复盘（私有）</option>
                <option value="不收录">不收录</option>
              </select>
              <button onClick={handleArchive} disabled={archiving || (!aiCase && rating !== '不收录')}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-lg shadow-emerald-100">
                {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                确认归档
              </button>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

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
      gsProfileIds.includes((h.serverConfig as any)?.id) ||
      gsProfileNames.includes((h.serverConfig as any)?.name)
    );
    const found = profHistory.reduce((s, h) => s + (h.result?.playerReports?.reduce((ss, r) => ss + (r.negativeOutbursts?.length ?? 0), 0) ?? 0), 0);

    const gsExecs = execRecords.filter(r => gsProfileNames.includes(r.serverProfileName));
    const executed = gsExecs.filter(r => r.category === '已解决').length;
    const closed = gsExecs.filter(r => r.submissionStatus === '已完成').length;

    const relatedReviews = leaderReviews.filter(rv =>
      gsExecs.some(e => e.id === rv.executionRecordId) && rv.decision !== null
    );

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
                  <td className="px-4 py-4">
                    <span className="text-lg font-black text-indigo-600">{s.found}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-lg font-black text-emerald-600">{s.executed}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <span className="text-lg font-black text-blue-600">{s.closed}</span>
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">{rate}% 结案率</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-lg font-black text-amber-600">{s.followed}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
