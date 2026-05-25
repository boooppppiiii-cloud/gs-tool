import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronRight, ServerCrash, Archive, Layers, BookOpen } from 'lucide-react';
import { ServerProfile, MonthHistory, AnalysisCase, ExecutionRecord } from '../types';

interface Props {
  serverProfiles: ServerProfile[];
  history: MonthHistory[];
  cases: AnalysisCase[];
  executionRecords: ExecutionRecord[];
  dismissedOutbursts?: { historyRecordId: string; outburstIndex: number }[];
  onTicketClick?: (historyRecordId: string) => void;
}

interface FlatTicket {
  historyRecordId: string;
  outburstIndex: number;
  playerName: string;
  title: string;
  serverName: string;
  date: string;
  execRecord?: ExecutionRecord;
}

function getTicketStatus(ticket: FlatTicket): '待处理' | '待审核' | '已完成' {
  if (!ticket.execRecord) return '待处理';
  if (ticket.execRecord.submissionStatus === '已完成') return '已完成';
  if (ticket.execRecord.submissionStatus === '待审核') return '待审核';
  return '待处理';
}

const STATUS_STYLES = {
  '待处理': { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', dot: 'bg-orange-400' },
  '待审核': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', dot: 'bg-blue-400' },
  '已完成': { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', dot: 'bg-emerald-400' },
};

export default function HomeView({ serverProfiles, history, cases, executionRecords, dismissedOutbursts = [], onTicketClick }: Props) {
  const [expandedEcology, setExpandedEcology] = React.useState<string | null>(null);

  const tickets: FlatTicket[] = React.useMemo(() => {
    const flat: FlatTicket[] = [];
    history.forEach(month => {
      month.records.forEach(record => {
        const serverName = (record.serverConfig as any)?.name ?? '未知区服';
        let perRecordIdx = 0;
        (record.result?.playerReports ?? []).forEach(report => {
          (report.negativeOutbursts ?? []).forEach(outburst => {
            const idx = perRecordIdx++;
            if (dismissedOutbursts.some(d => d.historyRecordId === record.id && d.outburstIndex === idx)) return;
            flat.push({
              historyRecordId: record.id,
              outburstIndex: idx,
              playerName: report.roleName,
              title: (outburst as any).title ?? outburst.trigger ?? '未知事件',
              serverName,
              date: record.timestamp,
              execRecord: executionRecords.find(
                r => r.historyRecordId === record.id && r.outburstIndex === idx
              ),
            });
          });
        });
      });
    });
    return flat.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [history, executionRecords, dismissedOutbursts]);

  const pendingCount = tickets.filter(t => getTicketStatus(t) === '待处理').length;
  const reviewCount = tickets.filter(t => getTicketStatus(t) === '待审核').length;
  const doneCount = tickets.filter(t => getTicketStatus(t) === '已完成').length;

  const profilesWithEcology = serverProfiles.filter(p => p.serverEcology);
  const recentCases = cases.slice(0, 6);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-12">

      {/* ── 1. Work Status Banner ── */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">当前工作状态</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '待处理' as const, count: pendingCount, icon: <AlertTriangle className="w-5 h-5" /> },
            { label: '待审核' as const, count: reviewCount, icon: <Clock className="w-5 h-5" /> },
            { label: '已完成' as const, count: doneCount, icon: <CheckCircle2 className="w-5 h-5" /> },
          ].map(({ label, count, icon }) => {
            const style = STATUS_STYLES[label];
            return (
              <div key={label} className={`rounded-2xl border ${style.border} ${style.bg} px-6 py-5 flex items-center justify-between`}>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${style.text}`}>{label}</p>
                  <p className={`text-4xl font-black mt-1 ${style.text}`}>{count}</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">负面工单</p>
                </div>
                <div className={`${style.text} opacity-30`}>{icon}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. Server Ecology Summaries ── */}
      {profilesWithEcology.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ServerCrash className="w-4 h-4 text-indigo-600" />
            <p className="text-sm font-black text-slate-800">全部区服生态总结</p>
            <span className="text-xs text-slate-400 font-medium">({profilesWithEcology.length} 个区服)</span>
          </div>
          <div className="space-y-2">
            {profilesWithEcology.map(profile => (
              <div key={profile.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <button
                  onClick={() => setExpandedEcology(expandedEcology === profile.id ? null : profile.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="text-sm font-bold text-slate-700">{profile.name}</span>
                    {profile.mergeStage && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">{profile.mergeStage}</span>
                    )}
                  </div>
                  {expandedEcology === profile.id
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />
                  }
                </button>
                {expandedEcology === profile.id && (
                  <div className="px-5 pb-4 border-t border-slate-100 bg-slate-50/40">
                    <p className="text-sm text-slate-600 leading-relaxed pt-3">{profile.serverEcology}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Negative Ticket List ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-indigo-600" />
          <p className="text-sm font-black text-slate-800">负面工单</p>
          <span className="text-xs text-slate-400 font-medium">({tickets.length} 条)</span>
        </div>
        {tickets.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">暂无负面工单，完成专家分析后将自动汇聚至此</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket, i) => {
              const status = getTicketStatus(ticket);
              const style = STATUS_STYLES[status];
              const clickable = !!onTicketClick;
              return (
                <div
                  key={i}
                  onClick={() => onTicketClick?.(ticket.historyRecordId)}
                  className={`flex items-center gap-4 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl transition-colors ${
                    clickable ? 'cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30' : 'hover:border-slate-300'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{ticket.title}</p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {ticket.playerName} · {ticket.serverName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400 font-medium hidden sm:block">
                      {new Date(ticket.date).toLocaleDateString('zh-CN')}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                      {status}
                    </span>
                    {clickable && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. Case Archives ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Archive className="w-4 h-4 text-indigo-600" />
          <p className="text-sm font-black text-slate-800">案例沉淀</p>
          <span className="text-xs text-slate-400 font-medium">最新 {recentCases.length} 条</span>
        </div>
        {recentCases.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">暂无案例，前往优秀案例库查看或新建</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentCases.map(c => (
              <div key={c.id} className="px-5 py-4 bg-white border border-slate-200 rounded-2xl hover:border-amber-200 transition-colors">
                <p className="text-sm font-bold text-slate-800 truncate">{c.title}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(c.tags ?? []).slice(0, 3).map(tag => (
                    <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">{tag}</span>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-2">
                  {new Date(c.timestamp).toLocaleDateString('zh-CN')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
