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
import { AnalysisResult, PlayerBehaviorReport, ExecutionRecord, GsCommunicationReport, AnalysisCase, LeaderReview, ChatRecord } from '../types';
import ExecutionRecordUpload from './ExecutionRecordUpload';
import CaseGenerationModal from './CaseGenerationModal';
import PortraitTableCard from './PortraitTableCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { logUsage } from '../services/analyticsService';

interface Props {
  result: AnalysisResult;
  executionRecords?: ExecutionRecord[];
  currentHistoryId?: string | null;
  onSaveRecords?: (records: ExecutionRecord[]) => Promise<void>;
  onUpdatePortrait?: (roleName: string, updates: Record<string, string>) => void;
  leaderReviews?: LeaderReview[];
  serverName?: string;
  gsName?: string;
  focusedOutburstIndex?: number | null;
  onClearFocus?: () => void;
  chatData?: ChatRecord[];
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export default function AnalysisReport({ result: rawResult, executionRecords = [], currentHistoryId, onSaveRecords, onUpdatePortrait, leaderReviews = [], serverName, gsName, focusedOutburstIndex = null, onClearFocus, chatData }: Props) {
  const result: AnalysisResult = React.useMemo(() => ({
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rawResult]);

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

  const chatStats = React.useMemo(() => {
    if (!chatData?.length) return null;
    const playerMap = new Map<string, { count: number; firstTime: string; lastTime: string }>();
    for (const r of chatData) {
      if (!playerMap.has(r.roleName)) {
        playerMap.set(r.roleName, { count: 0, firstTime: r.time, lastTime: r.time });
      }
      const e = playerMap.get(r.roleName)!;
      e.count++;
      if (r.time < e.firstTime) e.firstTime = r.time;
      if (r.time > e.lastTime) e.lastTime = r.time;
    }
    return {
      total: chatData.length,
      players: Array.from(playerMap.entries())
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.count - a.count),
    };
  }, [chatData]);

  const [localRecordPatches, setLocalRecordPatches] = useState<Record<number, Partial<ExecutionRecord>>>({});
  const [newRecordDrafts, setNewRecordDrafts] = useState<Record<number, Partial<ExecutionRecord>>>({});
  const [caseGenModal, setCaseGenModal] = useState<{
    outburst: any;
    execRecord: Partial<ExecutionRecord>;
    playerName: string;
    outburstIndex: number;
  } | null>(null);
  const [casePreview, setCasePreview] = useState<Record<number, Partial<AnalysisCase>>>({});

  const handleRecordChange = React.useCallback((index: number, data: Partial<ExecutionRecord>) => {
    setLocalRecordPatches(prev => ({ ...prev, [index]: { ...(prev[index] ?? {}), ...data } }));
  }, []);

  const handleNewRecordChange = React.useCallback((index: number, data: Partial<ExecutionRecord>) => {
    setNewRecordDrafts(prev => ({ ...prev, [index]: { ...(prev[index] ?? {}), ...data } }));
  }, []);

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

  const handleSubmitSingleRecord = React.useCallback(async (
    index: number,
    status: '草稿' | '待审核' | '待归档'
  ) => {
    if (!onSaveRecords || !currentHistoryId) return;
    const ob = allOutbursts[index];
    const outburstRecs = executionRecords
      .filter(r => r.historyRecordId === currentHistoryId && r.outburstIndex === index)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latestRec = outburstRecs[outburstRecs.length - 1];
    const latestReview = latestRec ? leaderReviews.find(r => r.executionRecordId === latestRec.id) : undefined;
    const isNewRound = !!latestRec && latestReview?.decision === '继续推进';
    const now = new Date().toISOString();

    let record: ExecutionRecord;
    if (isNewRound) {
      const draft = newRecordDrafts[index] ?? {};
      if (!draft.description && !draft.category) return;
      record = {
        id: `exec_${Date.now()}_${index}_r${outburstRecs.length + 1}`,
        historyRecordId: currentHistoryId,
        playerName: ob.playerName,
        outburstIndex: index,
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
      };
    } else {
      const patch = localRecordPatches[index] ?? {};
      record = {
        id: latestRec?.id ?? `exec_${Date.now()}_${index}`,
        historyRecordId: currentHistoryId,
        playerName: ob.playerName,
        outburstIndex: index,
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
      };
    }
    if (status === '待归档' && casePreview[index]) {
      (record as any).caseContent = JSON.stringify(casePreview[index]);
    }
    await onSaveRecords([record]);
  }, [onSaveRecords, currentHistoryId, allOutbursts, executionRecords, leaderReviews, newRecordDrafts, localRecordPatches, casePreview]);

  const rateAdvice = React.useCallback((key: string, rating: 'up' | 'down', playerName: string, trigger: string) => {
    if (adviceRatings[key]) return;
    setAdviceRatings(prev => ({ ...prev, [key]: rating }));
    logUsage('advice_rating', JSON.stringify({ playerName, trigger, rating }));
  }, [adviceRatings]);

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
    <div className="space-y-6 pb-20">
      <div className="flex justify-end">
        <button
          onClick={exportToWord}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-colors active:scale-95"
        >
          <FileDown className="w-5 h-5" /> 导出 Word 总结报告
        </button>
      </div>

      {/* 0. 聊天内容总览 */}
      {(chatStats || result.serverEcology || (result.chatTopics ?? []).length > 0) && (
        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              聊天内容总览
            </h3>
            {chatStats && (
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                <Activity className="w-3 h-3 text-indigo-500" />
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">共 {chatStats.total} 条发言</span>
              </div>
            )}
          </div>

          <div className={`grid gap-5 ${chatStats ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {/* 左列：玩家发言统计 */}
            {chatStats && (
              <div className="lg:col-span-2 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <User className="w-3 h-3" /> 发言玩家统计（共 {chatStats.players.length} 人）
                </p>
                <div className="space-y-1">
                  {chatStats.players.slice(0, 15).map(p => {
                    const isKey = result.identifiedKeyPlayers.includes(p.name);
                    const isGs = gsName ? p.name === gsName : false;
                    return (
                      <div key={p.name} className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors">
                        <span className={`font-bold text-sm shrink-0 ${isGs ? 'text-emerald-700' : isKey ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {p.name}
                        </span>
                        {isKey && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-black rounded-full uppercase leading-none shrink-0">重点</span>}
                        {isGs && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-black rounded-full uppercase leading-none shrink-0">GS</span>}
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden mx-1">
                          <div
                            className={`h-full rounded-full ${isGs ? 'bg-emerald-400' : isKey ? 'bg-indigo-400' : 'bg-slate-300'}`}
                            style={{ width: `${Math.round((p.count / chatStats.players[0].count) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-500 shrink-0 w-10 text-right">{p.count} 条</span>
                        <span className="text-[10px] text-slate-400 shrink-0 hidden sm:block">{p.firstTime.slice(0, 11)} — {p.lastTime.slice(0, 11)}</span>
                      </div>
                    );
                  })}
                  {chatStats.players.length > 15 && (
                    <p className="text-[10px] text-slate-400 pl-3 pt-1">…另有 {chatStats.players.length - 15} 位玩家发言较少</p>
                  )}
                </div>
              </div>
            )}

            {/* 右列：生态 + 话题 */}
            <div className="space-y-4">
              {result.serverEcology && (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Gamepad2 className="w-3 h-3" /> 区服生态
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">{result.serverEcology}</p>
                </div>
              )}
              {(result.chatTopics ?? []).length > 0 && (
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-2">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageCircle className="w-3 h-3" /> 本次聊天话题
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(result.chatTopics ?? []).map((topic, i) => (
                      <span key={i} className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 text-[11px] font-semibold rounded-full shadow-sm">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

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
          {result.playerReports.filter(p => p.portraitTable?.isKeyPlayer).length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm font-medium">本次分析未识别到重点玩家（3天内累充 ≥500元）</p>
            </div>
          )}
          {result.playerReports.filter(p => p.portraitTable?.isKeyPlayer).map((player) => (
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
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-500 adventure-icon" />
            爆发负面：深度行为溯源
          </h3>
          {focusedOutburstIndex != null && (
            <button
              onClick={onClearFocus}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors"
            >
              查看完整报告（共 {allOutbursts.length} 条）
            </button>
          )}
        </div>

        <div className="space-y-8 text-neutral-900">
          {allOutbursts
            .filter((_, i) => focusedOutburstIndex == null || i === focusedOutburstIndex)
            .map((ob, renderIdx) => {
              const globalIdx = focusedOutburstIndex != null ? focusedOutburstIndex : renderIdx;
              const outburst = ob.outburst;
              const playerName = ob.playerName;
              const ratingKey = `${playerName}-${globalIdx}`;
              const rated = adviceRatings[ratingKey];
              return (
                <div key={`${playerName}-${globalIdx}`} className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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
                            {outburst.tags.map((tag: string) => (
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
                        <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> 玩家：{playerName}
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
                            {outburst.context.map((msg: { roleName: string; content: string; time: string }, midx: number) => (
                              <div key={midx} className={`flex ${msg.roleName === playerName ? 'justify-start' : 'justify-end'} gap-2 items-start`}>
                                <div className={`max-w-[80%] space-y-0.5 ${msg.roleName === playerName ? '' : 'items-end'}`}>
                                  <div className="flex items-center gap-2 px-1">
                                    <span className="text-[9px] text-slate-400 font-bold">{msg.roleName}</span>
                                    <span className="text-[9px] text-slate-300">{msg.time}</span>
                                  </div>
                                  <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                    msg.roleName === playerName
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
                            onClick={() => rateAdvice(ratingKey, 'up', playerName, outburst.trigger)}
                            className={`p-1 rounded-lg transition-colors ${rated === 'up' ? 'text-emerald-600 bg-emerald-50' : rated ? 'text-slate-200' : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
                            disabled={!!rated}
                            title="这条建议有用"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => rateAdvice(ratingKey, 'down', playerName, outburst.trigger)}
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
                            {outburst.gsAdvice.resultTags.map((tag: string) => (
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
          }
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
              if (focusedOutburstIndex != null && i !== focusedOutburstIndex) return null;

              const outburstRecs = executionRecords
                .filter(r => r.historyRecordId === currentHistoryId && r.outburstIndex === i)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

              // when viewing a historical analysis, only show outbursts that have records
              // ticket-focus mode (focusedOutburstIndex != null) always shows the form to allow new records
              if (currentHistoryId && focusedOutburstIndex == null && outburstRecs.length === 0) return null;

              const latestRec = outburstRecs[outburstRecs.length - 1];
              const latestReview = latestRec ? leaderReviews.find(r => r.executionRecordId === latestRec.id) : undefined;
              const isNewRound = !!latestRec && latestReview?.decision === '继续推进';
              const isDraft = latestRec?.submissionStatus === '草稿';
              const isFinalState = latestRec?.submissionStatus === '待归档';
              const isLeaderClosed = latestRec?.submissionStatus === '已完成';
              const needsInput = !latestRec || isNewRound || isDraft;
              const showNewInput = needsInput && !isFinalState && !isLeaderClosed;
              const showAiButton = !isFinalState;

              return (
                <div key={i} className="space-y-2">
                  {/* Past records (read-only) — drafts stay in edit form */}
                  {outburstRecs.filter(rec => rec.submissionStatus !== '草稿').map((rec, round) => (
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
                        key={`${i}-${isDraft ? latestRec!.id : 'new'}-nr${outburstRecs.filter(rec => leaderReviews.find(r => r.executionRecordId === rec.id)?.decision === '继续推进').length}`}
                        outburstIndex={i}
                        playerName={ob.playerName}
                        outburstTitle={ob.title}
                        existing={isDraft && !isNewRound ? latestRec : undefined}
                        onChange={isNewRound ? handleNewRecordChange : handleRecordChange}
                      />
                    </div>
                  )}

                  {/* AI case generation */}
                  {showAiButton && isLeaderClosed && (
                    <div className="flex justify-end pr-1">
                      <button
                        onClick={() => {
                          const draft = isNewRound ? (newRecordDrafts[i] ?? {}) : (localRecordPatches[i] ?? {});
                          const base = latestRec;
                          setCaseGenModal({
                            outburst: ob.outburst,
                            execRecord: { ...base, ...draft },
                            playerName: ob.playerName,
                            outburstIndex: i,
                          });
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI 辅助整合案例
                      </button>
                    </div>
                  )}

                  {/* Inline case preview */}
                  {casePreview[i] && (
                    <div className="mt-2 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2">
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> AI 整合案例预览
                      </p>
                      <p className="text-sm font-bold text-slate-800">{casePreview[i].title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(casePreview[i].tags ?? []).map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 bg-white border border-indigo-200 text-indigo-600 rounded-full font-bold">{t}</span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{casePreview[i].disposalPlan}</p>
                    </div>
                  )}

                  {/* Per-outburst action buttons */}
                  {!isFinalState && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {!isLeaderClosed && (
                        <>
                          <button
                            onClick={() => handleSubmitSingleRecord(i, '草稿')}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                          >
                            <Save className="w-3.5 h-3.5" /> 暂存草稿
                          </button>
                          <button
                            onClick={() => handleSubmitSingleRecord(i, '待审核')}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" /> 提交核实
                          </button>
                        </>
                      )}
                      {isLeaderClosed && (
                        <button
                          onClick={async () => { await handleSubmitSingleRecord(i, '待归档'); setSuccessToast(true); }}
                          disabled={!casePreview[i]}
                          title={!casePreview[i] ? '请先完成 AI 辅助整合案例' : ''}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" /> 上传案例
                        </button>
                      )}
                    </div>
                  )}
                  {isFinalState && (
                    <div className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 已完成归档
                    </div>
                  )}
                </div>
              );
            })}
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

      {caseGenModal && (
        <CaseGenerationModal
          playerName={caseGenModal.playerName}
          serverName={serverName ?? ''}
          gsName={gsName ?? ''}
          outburst={caseGenModal.outburst}
          execRecord={caseGenModal.execRecord}
          onClose={() => setCaseGenModal(null)}
          onGenerate={async (draft) => {
            setCasePreview(prev => ({ ...prev, [caseGenModal.outburstIndex]: draft }));
            setCaseGenModal(null);
          }}
        />
      )}
    </div>
  );
}

const PastExecutionRecordCard = React.memo(function PastExecutionRecordCard({
  record, roundIndex, review,
}: {
  record: ExecutionRecord;
  roundIndex: number;
  review?: LeaderReview;
}) {
  const [open, setOpen] = useState(true);
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
});


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
