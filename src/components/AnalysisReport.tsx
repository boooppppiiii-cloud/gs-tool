/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  UserCheck,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Zap,
  CreditCard,
  PieChart as PieIcon,
  User,
  Activity,
  UserMinus,
  CheckCircle2,
  Clock,
  FileDown,
  Shield,
  Sword,
  Scroll,
  Crown,
  ThumbsUp,
  ThumbsDown,
  ClipboardList,
  Save,
  Send,
  BookmarkPlus,
  MessageCircle,
  ArrowUpRight,
  ArrowDownLeft,
  XCircle,
  Gamepad2,
  Coffee,
  AlertCircle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { AnalysisResult, PlayerBehaviorReport, ExecutionRecord, GsCommunicationReport, AnalysisCase, PortraitTable, LeaderReview } from '../types';
import ExecutionRecordUpload from './ExecutionRecordUpload';
import CaseGenerationModal from './CaseGenerationModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { logUsage } from '../services/analyticsService';

interface Props {
  result: AnalysisResult;
  executionRecords?: ExecutionRecord[];
  currentHistoryId?: string | null;
  onSaveRecords?: (records: ExecutionRecord[]) => Promise<void>;
  onSaveCase?: (draft: Partial<AnalysisCase>) => Promise<void>;
  onUpdatePortrait?: (roleName: string, updates: Record<string, string>) => void;
  leaderReviews?: LeaderReview[];
  serverName?: string;
  gsName?: string;
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export default function AnalysisReport({ result: rawResult, executionRecords = [], currentHistoryId, onSaveRecords, onSaveCase, onUpdatePortrait, leaderReviews = [], serverName, gsName }: Props) {
  const result: AnalysisResult = {
    ...rawResult,
    identifiedKeyPlayers: rawResult.identifiedKeyPlayers ?? [],
    playerReports: (rawResult.playerReports ?? []).map((p: any) => ({
      ...p,
      negativeOutbursts: (p.negativeOutbursts ?? []).map((o: any) => ({
        ...o,
        context: o.context ?? [],
      })),
    })),
    rechargeReport: {
      totalPaid: rawResult.rechargeReport?.totalPaid ?? 0,
      totalUnpaid: rawResult.rechargeReport?.totalUnpaid ?? 0,
      playerSummaries: rawResult.rechargeReport?.playerSummaries ?? [],
      paymentProfile: rawResult.rechargeReport?.paymentProfile ?? '',
      rechargeData: rawResult.rechargeReport?.rechargeData ?? [],
    },
    serverEcology: rawResult.serverEcology ?? '',
  };

  const [adviceRatings, setAdviceRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [successToast, setSuccessToast] = useState(false);

  // Flatten all outbursts across player reports for execution record tracking
  const allOutbursts = React.useMemo(() => {
    const flat: { playerName: string; title: string; trigger: string; outburst: any }[] = [];
    result.playerReports.forEach(p => {
      (p.negativeOutbursts ?? []).forEach(o => {
        flat.push({ playerName: p.roleName, title: (o as any).title ?? o.trigger, trigger: o.trigger, outburst: o });
      });
    });
    return flat;
  }, [result]);

  const [localRecordPatches, setLocalRecordPatches] = useState<Record<number, Partial<ExecutionRecord>>>({});
  const [newRecordDrafts, setNewRecordDrafts] = useState<Record<number, Partial<ExecutionRecord>>>({});
  const [caseGenModal, setCaseGenModal] = useState<{
    outburst: any;
    execRecord: Partial<ExecutionRecord>;
    playerName: string;
  } | null>(null);

  const handleRecordChange = (index: number, data: Partial<ExecutionRecord>) => {
    setLocalRecordPatches(prev => ({ ...prev, [index]: { ...(prev[index] ?? {}), ...data } }));
  };

  const handleNewRecordChange = (index: number, data: Partial<ExecutionRecord>) => {
    setNewRecordDrafts(prev => ({ ...prev, [index]: { ...(prev[index] ?? {}), ...data } }));
  };

  // "上传案例" is only available once the leader has closed at least one record for this history
  const canGenerateCase = React.useMemo(() => {
    if (!currentHistoryId) return false;
    return executionRecords.some(r => r.historyRecordId === currentHistoryId && r.submissionStatus === '已完成');
  }, [executionRecords, currentHistoryId]);

  // All records archived = final state, no further editing
  const hasUploaded = React.useMemo(() => {
    if (!currentHistoryId) return false;
    return executionRecords.some(r => r.historyRecordId === currentHistoryId && r.submissionStatus === '待归档');
  }, [executionRecords, currentHistoryId]);

  const handleSubmitRecords = async (status: '草稿' | '待审核' | '已完成' | '待归档') => {
    if (!onSaveRecords || !currentHistoryId) return;
    setSaveStatus('saving');
    const now = new Date().toISOString();
    const records: ExecutionRecord[] = [];

    allOutbursts.forEach((ob, i) => {
      const outburstRecs = executionRecords
        .filter(r => r.historyRecordId === currentHistoryId && r.outburstIndex === i)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const latestRec = outburstRecs[outburstRecs.length - 1];
      const latestReview = latestRec ? leaderReviews.find(r => r.executionRecordId === latestRec.id) : undefined;
      const isNewRound = !!latestRec && latestReview?.decision === '继续推进';

      if (isNewRound) {
        const draft = newRecordDrafts[i] ?? {};
        if (!draft.description && !draft.category) return;
        records.push({
          id: `exec_${Date.now()}_${i}_r${outburstRecs.length + 1}`,
          historyRecordId: currentHistoryId,
          playerName: ob.playerName,
          outburstIndex: i,
          outburstTitle: ob.title,
          serverProfileName: '',
          category: draft.category ?? '待推进',
          submissionStatus: status,
          date: now.slice(0, 10),
          description: draft.description ?? '',
          reflection: draft.reflection ?? '',
          attachments: draft.attachments ?? [],
          createdAt: now,
          updatedAt: now,
          ownerId: '',
        });
      } else {
        const patch = localRecordPatches[i] ?? {};
        records.push({
          id: latestRec?.id ?? `exec_${Date.now()}_${i}`,
          historyRecordId: currentHistoryId,
          playerName: ob.playerName,
          outburstIndex: i,
          outburstTitle: ob.title,
          serverProfileName: '',
          category: patch.category ?? latestRec?.category ?? '待推进',
          submissionStatus: status,
          date: latestRec?.date ?? now.slice(0, 10),
          description: patch.description ?? latestRec?.description ?? '',
          reflection: patch.reflection ?? latestRec?.reflection ?? '',
          attachments: patch.attachments ?? latestRec?.attachments ?? [],
          createdAt: latestRec?.createdAt ?? now,
          updatedAt: now,
          ownerId: '',
        });
      }
    });

    await onSaveRecords(records);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const rateAdvice = (key: string, rating: 'up' | 'down', playerName: string, trigger: string) => {
    if (adviceRatings[key]) return;
    setAdviceRatings(prev => ({ ...prev, [key]: rating }));
    logUsage('advice_rating', JSON.stringify({ playerName, trigger, rating }));
  };

  const exportToWord = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "《傲世传奇》专家分析总结报告",
            heading: HeadingLevel.TITLE,
            alignment: "center",
          }),
          new Paragraph({ text: "" }),
          
          new Paragraph({
            text: "一、 重点玩家画像",
            heading: HeadingLevel.HEADING_1,
          }),
          ...result.playerReports.flatMap(player => [
            new Paragraph({
              children: [
                new TextRun({ text: `角色名：${player.roleName}`, bold: true, size: 28 }),
              ],
              spacing: { before: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "画像总结：", bold: true }),
                new TextRun({ text: player.portrait.summary, italics: true }),
              ],
            }),
            new Paragraph({ text: `付费习惯：${player.portrait.paymentHabits}` }),
            new Paragraph({ text: `游戏习惯：${player.portrait.gameHabits}` }),
            new Paragraph({ text: `现实人设：${player.portrait.realLifePersona || "无"}` }),
          ]),

          new Paragraph({
            text: "二、 负面爆发分析与处置建议",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 800 },
          }),
          ...result.playerReports.flatMap(player => 
            player.negativeOutbursts.map(outburst => [
              new Paragraph({
                children: [
                  new TextRun({ text: `角色名：${player.roleName}`, bold: true }),
                  new TextRun({ text: ` | 负面爆发原因：${outburst.trigger}` }),
                ],
                spacing: { before: 400 },
              }),
              new Paragraph({
                children: [
                   new TextRun({ text: "负面触发点：", bold: true }),
                   new TextRun({ text: (outburst as any).triggerPoint || "未知" }),
                ]
              }),
              new Paragraph({
                children: [
                   new TextRun({ text: "溯源上下文：", bold: true }),
                ]
              }),
              ...outburst.context.map(msg => new Paragraph({
                children: [
                  new TextRun({ text: `[${msg.time}] `, bold: true, color: "666666" }),
                  new TextRun({ text: `${msg.roleName}: ${msg.content}` }),
                ],
              })),
              new Paragraph({
                children: [
                  new TextRun({ text: "GS 专家处置方案：", bold: true, size: 28 }),
                ],
                spacing: { before: 200 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "推荐动作：", bold: true }),
                  new TextRun({ text: outburst.gsAdvice.action, color: "FF0000" }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "专家处置方案详情：", bold: true }),
                  new TextRun({ text: (outburst.gsAdvice as any).disposalPlan || "见下方分析" }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "分析归因：", bold: true }),
                  new TextRun({ text: outburst.gsAdvice.reason }),
                ],
              }),
            ]).flat()
          ),

          new Paragraph({
            text: "三、 充值趋势报告",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 800 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `周期付费合计：¥ ${result.rechargeReport.totalPaid.toLocaleString()}`, bold: true }),
            ],
          }),
          new Paragraph({
            text: `专家画像总结：${result.rechargeReport.paymentProfile}`,
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `傲世传奇_生态分析报告_${new Date().toISOString().slice(0, 10)}.docx`);
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="flex justify-end">
        <button 
          onClick={exportToWord}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
        >
          <FileDown className="w-5 h-5" /> 导出 Word 总结报告
        </button>
      </div>
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-indigo-600 adventure-icon-active" />
            自动识别：重点玩家画像
          </h3>
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100 shadow-sm">
            <Zap className="w-3 h-3 text-indigo-600 animate-pulse adventure-icon-active" />
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest leading-none">AI 自动筛选共 {result.identifiedKeyPlayers?.length ?? 0} 人</span>
          </div>
        </div>

        <div className="space-y-8">
          {result.playerReports.map((player) => (
            <PortraitTableCard
              key={player.roleName}
              player={player}
              serverName={serverName}
              onUpdatePortrait={onUpdatePortrait}
            />
          ))}
        </div>
      </section>

      {/* 2. Negative Outbursts (WeChat Style) */}
      <section className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-rose-500 adventure-icon" />
          爆发负面：深度行为溯源
        </h3>

        <div className="space-y-8 text-neutral-900">
          {result.playerReports.map((player) =>
            player.negativeOutbursts.map((outburst, idx) => {
              const ratingKey = `${player.roleName}-${idx}`;
              const rated = adviceRatings[ratingKey];
              return (
                <div key={`${player.roleName}-${idx}`} className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm hover:shadow-md transition-all">
                  {/* ── 标题 + 标签 ── */}
                  <div className="px-8 py-6 bg-rose-50 border-b border-rose-100">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 adventure-icon" />
                          <h4 className="text-lg font-black text-slate-900 leading-snug">
                            {outburst.title ?? outburst.trigger}
                          </h4>
                        </div>
                        {outburst.tags && outburst.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-6">
                            {outburst.tags.map(tag => (
                              <span key={tag} className="px-2.5 py-0.5 bg-rose-200 text-rose-700 text-[10px] font-black rounded-full uppercase tracking-tight">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="px-3 py-1 bg-rose-200 text-rose-700 text-[10px] font-bold rounded-full uppercase tracking-tighter shadow-sm shrink-0">
                        负面状态捕获
                      </span>
                    </div>
                  </div>

                  <div className="p-8 space-y-6">
                    {/* ── 基础信息 ── */}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> 玩家：{player.roleName}
                      </span>
                      {outburst.mergeStage && outburst.mergeStage !== '未知' && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-xl font-bold text-amber-700">
                          合服阶段：{outburst.mergeStage}
                        </span>
                      )}
                    </div>

                    {/* ── 案例背景 ── */}
                    {outburst.caseBackground && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">案例背景</p>
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                          <p className="text-sm text-slate-600 leading-relaxed">{outburst.caseBackground}</p>
                        </div>
                      </div>
                    )}

                    {/* ── 负面触发点 + 溯源上下文 ── */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-3 h-3" /> 负面触发点
                      </p>
                      <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                        <p className="text-sm text-orange-900 font-medium leading-relaxed">{outburst.triggerPoint}</p>
                      </div>

                      {outburst.context.length > 0 && (
                        <div className="space-y-3 mt-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" /> 溯源上下文
                          </p>
                          <div className="space-y-3 max-h-60 overflow-y-auto bg-slate-50/60 rounded-2xl p-4 border border-slate-100">
                            {outburst.context.map((msg, midx) => (
                              <div key={midx} className={`flex ${msg.roleName === player.roleName ? 'justify-start' : 'justify-end'} gap-2 items-start`}>
                                <div className={`max-w-[80%] space-y-0.5 ${msg.roleName === player.roleName ? '' : 'items-end'}`}>
                                  <div className="flex items-center gap-2 px-1">
                                    <span className="text-[9px] text-slate-400 font-bold">{msg.roleName}</span>
                                    <span className="text-[9px] text-slate-300">{msg.time}</span>
                                  </div>
                                  <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                    msg.roleName === player.roleName
                                      ? 'bg-white border border-slate-100 text-slate-800'
                                      : 'bg-indigo-600 text-white'
                                  }`}>
                                    {msg.content}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── 处置策略 ── */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">处置策略</p>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <p className="text-sm text-slate-700 leading-relaxed">{outburst.gsAdvice.disposalPlan}</p>
                      </div>
                    </div>

                    {/* ── 具体处置动作（重点显示）── */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                          <Zap className="w-3 h-3" /> 具体处置动作
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => rateAdvice(ratingKey, 'up', player.roleName, outburst.trigger)}
                            className={`p-1 rounded-lg transition-colors ${rated === 'up' ? 'text-emerald-600 bg-emerald-50' : rated ? 'text-slate-200' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
                            disabled={!!rated}
                            title="这条建议有用"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => rateAdvice(ratingKey, 'down', player.roleName, outburst.trigger)}
                            className={`p-1 rounded-lg transition-colors ${rated === 'down' ? 'text-rose-600 bg-rose-50' : rated ? 'text-slate-200' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}
                            disabled={!!rated}
                            title="这条建议没用"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl">
                        <p className="text-sm text-slate-800 leading-relaxed font-bold whitespace-pre-line">{outburst.gsAdvice.action}</p>
                      </div>
                    </div>

                    {/* ── 案例结果评估 ── */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">案例结果评估</p>
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-3">
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {outburst.gsAdvice.resultEvaluation ?? outburst.gsAdvice.reason}
                        </p>
                        {outburst.gsAdvice.resultTags && outburst.gsAdvice.resultTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {outburst.gsAdvice.resultTags.map(tag => (
                              <span key={tag} className="px-2.5 py-0.5 bg-emerald-200 text-emerald-800 text-[10px] font-black rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 3. Execution Record Upload */}
      {allOutbursts.length > 0 && (
        <section className="space-y-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            执行记录上传
          </h3>

          {/* 继续推进 banner */}
          {(() => {
            const pending = allOutbursts.filter((_, i) => {
              const recs = executionRecords
                .filter(r => r.historyRecordId === currentHistoryId && r.outburstIndex === i)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
              const latest = recs[recs.length - 1];
              return latest ? leaderReviews.find(r => r.executionRecordId === latest.id)?.decision === '继续推进' : false;
            });
            return pending.length > 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-700 font-bold">
                <RefreshCw className="w-4 h-4 shrink-0" />
                有 {pending.length} 个工单被组长要求继续推进，请填写新一轮执行记录
              </div>
            ) : null;
          })()}

          <div className="space-y-4">
            {allOutbursts.map((ob, i) => {
              const outburstRecs = executionRecords
                .filter(r => r.historyRecordId === currentHistoryId && r.outburstIndex === i)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
              const latestRec = outburstRecs[outburstRecs.length - 1];
              const latestReview = latestRec ? leaderReviews.find(r => r.executionRecordId === latestRec.id) : undefined;
              const isNewRound = !!latestRec && latestReview?.decision === '继续推进';
              const isFinalState = latestRec?.submissionStatus === '待归档';
              const isLeaderClosed = latestRec?.submissionStatus === '已完成';
              const needsInput = !latestRec || isNewRound;
              const showNewInput = needsInput && !isFinalState && !isLeaderClosed;
              const showAiButton = !!onSaveCase && !isFinalState;

              return (
                <div key={i} className="space-y-2">
                  {/* Past records (read-only) */}
                  {outburstRecs.map((rec, round) => (
                    <PastExecutionRecordCard
                      key={rec.id}
                      record={rec}
                      roundIndex={round + 1}
                      review={leaderReviews.find(r => r.executionRecordId === rec.id)}
                    />
                  ))}

                  {/* New round input */}
                  {showNewInput && (
                    <div className="space-y-1.5">
                      {isNewRound && (
                        <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-bold">
                          <RefreshCw className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>
                            组长要求继续推进 — 请填写第 {outburstRecs.length + 1} 轮执行记录
                            {latestReview?.comment && (
                              <span className="font-normal ml-1 text-amber-600">"{latestReview.comment}"</span>
                            )}
                          </span>
                        </div>
                      )}
                      <ExecutionRecordUpload
                        key={`${i}-${isNewRound ? 'new' : 'first'}-${outburstRecs.length}`}
                        outburstIndex={i}
                        playerName={ob.playerName}
                        outburstTitle={ob.title}
                        existing={undefined}
                        onChange={isNewRound ? handleNewRecordChange : handleRecordChange}
                      />
                    </div>
                  )}

                  {/* AI case generation */}
                  {showAiButton && (
                    <div className="flex justify-end pr-1">
                      <button
                        onClick={() => {
                          const draft = isNewRound ? (newRecordDrafts[i] ?? {}) : (localRecordPatches[i] ?? {});
                          const base = latestRec;
                          setCaseGenModal({
                            outburst: ob.outburst,
                            execRecord: { ...base, ...draft },
                            playerName: ob.playerName,
                          });
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI 辅助整合案例
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => handleSubmitRecords('草稿')}
              disabled={saveStatus === 'saving' || !onSaveRecords || canGenerateCase || hasUploaded}
              className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 disabled:opacity-40 transition-all"
            >
              <Save className="w-4 h-4" />
              暂存草稿
            </button>
            <button
              onClick={() => handleSubmitRecords('待审核')}
              disabled={saveStatus === 'saving' || !onSaveRecords || canGenerateCase || hasUploaded}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-lg shadow-indigo-100"
            >
              <Send className="w-4 h-4" />
              提交核实
            </button>
            {hasUploaded ? (
              <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                案例已完成
              </div>
            ) : canGenerateCase ? (
              <button
                onClick={async () => {
                  await handleSubmitRecords('待归档');
                  setSuccessToast(true);
                }}
                disabled={saveStatus === 'saving' || !onSaveRecords}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-lg shadow-emerald-100"
              >
                <BookmarkPlus className="w-4 h-4" />
                上传案例
              </button>
            ) : (
              <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 border border-slate-200 text-slate-300 rounded-2xl font-bold text-sm cursor-not-allowed select-none" title="需组长审核结案后方可上传案例">
                <BookmarkPlus className="w-4 h-4" />
                上传案例
                <span className="text-[10px] font-normal">(待组长结案)</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-600 text-sm font-bold">
                ✓ 已保存
              </span>
            )}
          </div>
        </section>
      )}

      {/* 4. Recharge & Visualization */}
      <section className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            玩家充值与留存报告
          </h3>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1">周期付费合计</p>
              <p className="text-xl font-black text-indigo-600">¥ {result.rechargeReport.totalPaid.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1">未支付合计</p>
              <p className="text-xl font-black text-rose-500">¥ {result.rechargeReport.totalUnpaid.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6 border-t border-slate-100">
          <div className="lg:col-span-2 space-y-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User className="w-3 h-3" /> 重点玩家逐一分析
            </p>
            <div className="grid grid-cols-1 gap-4">
              {result.rechargeReport.playerSummaries.map((summary) => (
                <div key={summary.roleName} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{summary.roleName}</span>
                      <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                        summary.isConverted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {summary.isConverted ? '已转端' : '未转端'}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      依据：{summary.conversionDetails}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-6">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold tracking-wider">付费总额</p>
                      <p className="text-lg font-bold text-indigo-600">¥{summary.totalPaid.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-3 h-3" /> 充值挡位热度分布
            </p>
            <div className="h-64 bg-slate-50 rounded-3xl p-4 border border-slate-100 relative">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={result.rechargeReport.rechargeData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {result.rechargeReport.rechargeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
               <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">专家画像总结</span>
               <p className="text-xs text-indigo-700 font-medium leading-relaxed mt-1">
                 {result.rechargeReport.paymentProfile}
               </p>
            </div>
          </div>
        </div>
      </section>

      {(result.gsCommunicationReports ?? []).length > 0 && (
        <GsCommunicationSection reports={result.gsCommunicationReports!} />
      )}

      <FeedbackPanel />

      {successToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl px-10 py-8 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-black text-slate-900">操作成功</p>
              <p className="text-sm text-slate-500">案例已上传，工单已完成归档</p>
            </div>
            <button
              onClick={() => setSuccessToast(false)}
              className="px-8 py-2.5 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-colors"
            >
              确认
            </button>
          </div>
        </div>
      )}

      {caseGenModal && onSaveCase && (
        <CaseGenerationModal
          playerName={caseGenModal.playerName}
          serverName={serverName ?? ''}
          gsName={gsName ?? ''}
          outburst={caseGenModal.outburst}
          execRecord={caseGenModal.execRecord}
          onClose={() => setCaseGenModal(null)}
          onGenerate={async (draft) => {
            await onSaveCase(draft);
            setCaseGenModal(null);
          }}
        />
      )}
    </div>
  );
}

function PastExecutionRecordCard({
  record, roundIndex, review,
}: {
  record: ExecutionRecord;
  roundIndex: number;
  review?: LeaderReview;
}) {
  const [open, setOpen] = useState(false);
  const decisionStyle: Record<string, string> = {
    '继续推进': 'bg-amber-50 border-amber-200 text-amber-700',
    '打回': 'bg-rose-50 border-rose-200 text-rose-700',
    '结案': 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  const dc = review?.decision ? (decisionStyle[review.decision] ?? 'bg-slate-50 border-slate-200 text-slate-500') : '';

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 text-left transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-black text-slate-500">第 {roundIndex} 次执行</span>
          <span className="text-xs text-slate-400">{record.date}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            record.submissionStatus === '待归档' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
            record.submissionStatus === '已完成' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            record.submissionStatus === '待审核' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
            'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {record.submissionStatus === '待归档' ? '已完成' :
             record.submissionStatus === '已完成' ? '已结案，待总结' :
             record.submissionStatus}
          </span>
          {review?.decision && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dc}`}>
              组长：{review.decision}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 shrink-0">{open ? '收起' : '查看'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-3 bg-slate-50/30">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">执行描述</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{record.description || '（无）'}</p>
          </div>
          {record.reflection && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">反思</p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{record.reflection}</p>
            </div>
          )}
          {review && (
            <div className={`p-3 rounded-xl border ${dc} space-y-1.5`}>
              <p className="text-[10px] font-black uppercase tracking-widest">组长审批意见</p>
              {review.isGsCaused !== null && (
                <p className="text-xs">GS 责任：{review.isGsCaused ? '是' : '否'}</p>
              )}
              {review.comment && (
                <p className="text-xs leading-relaxed">{review.comment}</p>
              )}
              <p className="text-xs font-bold">决定：{review.decision}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PortraitTableCard({
  player,
  onUpdatePortrait,
}: {
  player: PlayerBehaviorReport;
  serverName?: string;
  onUpdatePortrait?: (roleName: string, updates: Record<string, string>) => void;
}) {
  const pt = player.portraitTable;
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');

  const EDITABLE_LABELS = new Set(['职业', '战力排名']);

  const handleEditChange = (label: string, value: string) => {
    setEditValues(prev => ({ ...prev, [label]: value }));
    setSaveState('idle');
  };

  const handleSave = () => {
    if (!onUpdatePortrait) return;
    const updates: Record<string, string> = {};
    if ('职业' in editValues) updates.occupation = editValues['职业'];
    if ('战力排名' in editValues) updates.combatRanking = editValues['战力排名'];
    onUpdatePortrait(player.roleName, updates);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2000);
  };

  if (!pt) {
    return (
      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
        <div className="px-8 py-6 bg-indigo-50 border-b border-indigo-100">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-indigo-500" />
            <h4 className="text-lg font-black text-slate-900">{player.roleName}</h4>
          </div>
          <p className="text-sm text-slate-600 italic mt-2 pl-8 leading-relaxed">{player.portrait.summary}</p>
        </div>
        <div className="p-8 grid grid-cols-2 gap-4">
          <PortraitDetail title="付费习惯" content={player.portrait.paymentHabits} color="bg-emerald-50 text-emerald-700" />
          <PortraitDetail title="性格特征" content={player.portrait.personality} color="bg-violet-50 text-violet-700" />
          <PortraitDetail title="游戏习惯" content={player.portrait.gameHabits} color="bg-blue-50 text-blue-700" />
          <PortraitDetail title="现实人设" content={player.portrait.realLifePersona} color="bg-amber-50 text-amber-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-8 py-6 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Crown className="w-5 h-5 text-indigo-500 shrink-0" />
            <h4 className="text-lg font-black text-slate-900">{player.roleName}</h4>
            {pt.isKeyPlayer && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-black rounded-full">
                <Zap className="w-3 h-3" /> 重点玩家 ≥500元
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">画像完成度</p>
            <p className="text-2xl font-black text-indigo-600">{Math.round(pt.overallCompletion * 100)}%</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 italic mt-2 pl-8 leading-relaxed">{player.portrait.summary}</p>
      </div>

      {/* Basic data */}
      <div className="px-8 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-wrap gap-6 items-start text-sm">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">累计充值</p>
            <p className="font-black text-indigo-600">¥{pt.basicData.totalRecharge.toLocaleString()}</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">近期活跃</p>
            <p className="text-slate-700 text-xs leading-relaxed">{pt.basicData.recentActivity}</p>
          </div>
          {pt.basicData.anomalySignals && pt.basicData.anomalySignals !== '无' && (
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">异常信号</p>
              <p className="text-rose-700 text-xs leading-relaxed">{pt.basicData.anomalySignals}</p>
            </div>
          )}
        </div>
      </div>

      {/* Portrait table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 w-24">维度</th>
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 w-28">信息词条</th>
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200">玩家具体信息</th>
              <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200">信息依据</th>
              <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 w-20">是否获取到</th>
              <th className="px-4 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">画像完成度</th>
            </tr>
          </thead>
          <tbody>
            {pt.dimensions.map(dim =>
              dim.items.map((item, itemIdx) => (
                <tr key={`${dim.name}-${item.label}`} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  {itemIdx === 0 && (
                    <td
                      rowSpan={dim.items.length}
                      className="px-4 py-3 align-middle border-r border-slate-200 bg-slate-50/30"
                    >
                      <span className="inline-block px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black rounded-lg leading-tight text-center">
                        {dim.name.replace(/^维度[一二三四五六七八九十]：/, '')}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 font-bold text-slate-700 border-r border-slate-100">
                    {item.label}
                    {EDITABLE_LABELS.has(item.label) && (
                      <span className="ml-1 text-[8px] text-indigo-400 font-bold align-middle">✎</span>
                    )}
                  </td>
                  <td className="px-4 py-3 border-r border-slate-100">
                    {EDITABLE_LABELS.has(item.label) && onUpdatePortrait ? (
                      <input
                        type="text"
                        value={editValues[item.label] ?? (item.obtained ? item.value : '')}
                        onChange={e => handleEditChange(item.label, e.target.value)}
                        placeholder={item.obtained ? item.value : '手动填写…'}
                        className="w-full px-2 py-1 text-xs border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-indigo-50/30 placeholder:text-slate-300"
                      />
                    ) : (
                      <span className={item.obtained && item.value ? 'text-slate-700' : 'text-slate-300 italic'}>
                        {item.value || '数据中无记录'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 border-r border-slate-100 leading-relaxed">
                    {item.evidence || '—'}
                  </td>
                  <td className="px-4 py-3 text-center border-r border-slate-100">
                    {item.obtained ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black">✓</span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-100 text-slate-400 rounded-full text-[10px]">—</span>
                    )}
                  </td>
                  {itemIdx === 0 && (
                    <td
                      rowSpan={dim.items.length}
                      className="px-4 py-3 text-center align-middle"
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-base font-black text-indigo-600">
                          {Math.round(dim.completionRate * 100)}%
                        </span>
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-400 rounded-full"
                            style={{ width: `${Math.round(dim.completionRate * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Save button for editable fields */}
      {Object.keys(editValues).length > 0 && onUpdatePortrait && (
        <div className="px-8 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
              saveState === 'saved'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {saveState === 'saved' ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> 已保存</>
            ) : (
              <><Save className="w-3.5 h-3.5" /> 保存画像补充</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function PortraitDetail({ title, content, color }: { title: string; content: string; color: string }) {
  return (
    <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-500">
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${color}`}>
        {title}
      </span>
      <p className="text-sm text-slate-600 leading-snug">{content}</p>
    </div>
  );
}

function GsCommunicationSection({ reports }: { reports: GsCommunicationReport[] }) {
  const totalActive = reports.reduce((s, r) => s + r.activeCount, 0);
  const totalPassive = reports.reduce((s, r) => s + r.passiveCount, 0);
  const totalBad = reports.reduce((s, r) => s + r.badCount, 0);
  const totalInGame = reports.reduce((s, r) => s + r.contentTypes.inGame, 0);
  const totalOutGame = reports.reduce((s, r) => s + r.contentTypes.outGame, 0);
  const intervened = reports.filter(r => r.hasIntervened).length;
  const needsIntervention = reports.filter(r => !r.hasIntervened && r.interventionSummary !== '无负面工单').length;

  return (
    <section className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-indigo-600" />
          <h3 className="text-xl font-bold text-slate-800">GS 维护质量分析</h3>
        </div>
        <div className="flex items-center gap-2">
          {needsIntervention > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-black">
              <AlertCircle className="w-3 h-3" /> {needsIntervention} 个负面未介入
            </span>
          )}
          {intervened > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black">
              <CheckCircle2 className="w-3 h-3" /> {intervened} 个已介入
            </span>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/40">
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: '主动沟通', value: totalActive, icon: <ArrowUpRight className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
            { label: '被动沟通', value: totalPassive, icon: <ArrowDownLeft className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
            { label: '不良沟通', value: totalBad, icon: <XCircle className="w-4 h-4" />, color: 'text-rose-600 bg-rose-50 border-rose-200' },
            { label: '游戏内', value: totalInGame, icon: <Gamepad2 className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
            { label: '游戏外', value: totalOutGame, icon: <Coffee className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border ${color}`}>
              {icon}
              <p className="text-2xl font-black tabular-nums">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-player breakdown */}
      <div className="divide-y divide-slate-50">
        {reports.map(r => {
          const hasNegative = r.interventionSummary !== '无负面工单';
          const interventionStatus = !hasNegative
            ? null
            : r.hasIntervened
            ? 'intervened'
            : 'missing';

          return (
            <div key={r.roleName} className="px-8 py-5 flex flex-wrap items-start gap-6">
              {/* Player name + intervention badge */}
              <div className="w-28 shrink-0">
                <p className="text-sm font-black text-slate-800 truncate">{r.roleName}</p>
                {interventionStatus === 'intervened' && (
                  <span className="mt-1 flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> GS已介入
                  </span>
                )}
                {interventionStatus === 'missing' && (
                  <span className="mt-1 flex items-center gap-0.5 text-[10px] font-bold text-rose-500">
                    <AlertCircle className="w-3 h-3" /> 未介入
                  </span>
                )}
              </div>

              {/* Comm type chips */}
              <div className="flex flex-wrap gap-2 flex-1">
                {r.activeCount > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black">
                    <ArrowUpRight className="w-3 h-3" /> 主动 ×{r.activeCount}
                  </span>
                )}
                {r.passiveCount > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black">
                    <ArrowDownLeft className="w-3 h-3" /> 被动 ×{r.passiveCount}
                  </span>
                )}
                {r.badCount > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black">
                    <XCircle className="w-3 h-3" /> 不良 ×{r.badCount}
                  </span>
                )}
                {r.contentTypes.inGame > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black">
                    <Gamepad2 className="w-3 h-3" /> 游戏内 ×{r.contentTypes.inGame}
                  </span>
                )}
                {r.contentTypes.outGame > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black">
                    <Coffee className="w-3 h-3" /> 游戏外 ×{r.contentTypes.outGame}
                  </span>
                )}
                {r.activeCount === 0 && r.passiveCount === 0 && r.badCount === 0 && (
                  <span className="text-[10px] text-slate-400 font-medium italic">无沟通记录</span>
                )}
              </div>

              {/* Intervention summary */}
              {r.interventionSummary && r.interventionSummary !== '无负面工单' && (
                <p className="w-full text-xs text-slate-500 leading-relaxed mt-0.5 italic">
                  {r.interventionSummary}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FeedbackPanel() {
  const [accuracy, setAccuracy] = useState('');
  const [usefulness, setUsefulness] = useState('');
  const [comment, setComment] = useState('');
  const [missedChats, setMissedChats] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    logUsage('analysis_feedback', JSON.stringify({ accuracy, usefulness, comment, missedChats: missedChats.trim() || undefined }));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 text-center">
        <p className="text-emerald-700 font-black text-base">感谢你的反馈！这将帮助我们持续优化 AI 分析质量。</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
      <div>
        <h3 className="text-xl font-black text-slate-800">这次分析结果如何？</h3>
        <p className="text-xs text-slate-400 font-medium mt-1">你的反馈直接影响 AI 模型优化方向</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-600">AI 识别的负面事件和重点玩家，准确率如何？</p>
        <div className="flex gap-2 flex-wrap">
          {['准确无遗漏', '基本准确，有小错', '有明显遗漏/误判'].map(opt => (
            <button
              key={opt}
              onClick={() => setAccuracy(opt)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold border transition-colors ${
                accuracy === opt
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {accuracy === '有明显遗漏/误判' && (
        <div className="space-y-2 animate-in fade-in duration-200">
          <p className="text-sm font-bold text-slate-600">把 AI 漏掉的负面聊天记录粘贴到这里</p>
          <textarea
            value={missedChats}
            onChange={e => setMissedChats(e.target.value)}
            placeholder="直接粘贴聊天截图文字，例如：&#10;[22:13] 张三：这游戏太坑了，活动奖励太少&#10;[22:15] 张三：我要退游了…"
            className="w-full h-32 px-4 py-3 rounded-2xl border border-rose-200 bg-rose-50/30 text-sm resize-none focus:outline-none focus:border-rose-400 text-slate-700 font-mono leading-relaxed"
          />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-600">GS 处置建议的实用性如何？</p>
        <div className="flex gap-2 flex-wrap">
          {['非常有用，会采纳', '部分参考', '参考价值有限'].map(opt => (
            <button
              key={opt}
              onClick={() => setUsefulness(opt)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold border transition-colors ${
                usefulness === opt
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-600">补充说明（可选）：AI 漏掉了什么？哪条建议不准确？</p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="例如：漏掉了张三在5月1号的强烈投诉，或者某条处置建议不适合这个玩家的情况…"
          className="w-full h-20 px-4 py-3 rounded-2xl border border-slate-200 text-sm resize-none focus:outline-none focus:border-indigo-300 text-slate-700"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!accuracy || !usefulness}
        className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm disabled:opacity-40 hover:bg-indigo-700 transition-colors"
      >
        提交反馈
      </button>
    </div>
  );
}

function UserIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SparklesIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M19 17v4" />
        <path d="M3 5h4" />
        <path d="M17 19h4" />
      </svg>
    );
  }
