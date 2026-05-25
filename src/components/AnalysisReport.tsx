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
} from 'lucide-react';
import { AnalysisResult, PlayerBehaviorReport, ExecutionRecord } from '../types';
import ExecutionRecordUpload from './ExecutionRecordUpload';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { logUsage } from '../services/analyticsService';

interface Props {
  result: AnalysisResult;
  executionRecords?: ExecutionRecord[];
  currentHistoryId?: string | null;
  onSaveRecords?: (records: ExecutionRecord[]) => Promise<void>;
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export default function AnalysisReport({ result: rawResult, executionRecords = [], currentHistoryId, onSaveRecords }: Props) {
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

  // Flatten all outbursts across player reports for execution record tracking
  const allOutbursts = React.useMemo(() => {
    const flat: { playerName: string; title: string; trigger: string }[] = [];
    result.playerReports.forEach(p => {
      (p.negativeOutbursts ?? []).forEach(o => {
        flat.push({ playerName: p.roleName, title: (o as any).title ?? o.trigger, trigger: o.trigger });
      });
    });
    return flat;
  }, [result]);

  const [localRecordPatches, setLocalRecordPatches] = useState<Record<number, Partial<ExecutionRecord>>>({});

  const handleRecordChange = (index: number, data: Partial<ExecutionRecord>) => {
    setLocalRecordPatches(prev => ({ ...prev, [index]: { ...(prev[index] ?? {}), ...data } }));
  };

  const handleSubmitRecords = async (status: '草稿' | '待审核' | '已完成' | '待归档') => {
    if (!onSaveRecords || !currentHistoryId) return;
    setSaveStatus('saving');
    const now = new Date().toISOString();
    const records: ExecutionRecord[] = allOutbursts.map((ob, i) => {
      const patch = localRecordPatches[i] ?? {};
      const existing = executionRecords.find(r => r.historyRecordId === currentHistoryId && r.outburstIndex === i);
      return {
        id: existing?.id ?? `exec_${Date.now()}_${i}`,
        historyRecordId: currentHistoryId,
        playerName: ob.playerName,
        outburstIndex: i,
        outburstTitle: ob.title,
        serverProfileName: '',
        category: patch.category ?? existing?.category ?? '待推进',
        submissionStatus: status,
        date: existing?.date ?? now.slice(0, 10),
        description: patch.description ?? existing?.description ?? '',
        attachments: patch.attachments ?? existing?.attachments ?? [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ownerId: '',
      };
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {result.playerReports.map((player) => (
            <div key={player.roleName} className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm hover:shadow-xl transition-all group">
              <div className="p-8 bg-gradient-to-br from-indigo-50/50 to-white border-b border-slate-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-amber-50 border border-amber-200/60 rounded-2xl flex items-center justify-center text-indigo-600 shadow-lg shadow-amber-100 adventure-icon-active">
                    <Shield className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-bold text-slate-800">{player.roleName}</h4>
                    </div>
                    <p className="text-sm text-indigo-600 font-medium">专家判定：重点运营对象</p>
                  </div>
                </div>
                <div className="p-4 bg-white/80 border border-indigo-100 rounded-2xl">
                  <p className="text-slate-700 leading-relaxed italic text-sm">
                    “{player.portrait.summary}”
                  </p>
                </div>
              </div>

              <div className="p-6 grid grid-cols-2 gap-4">
                <PortraitDetail title="付费习惯" content={player.portrait.paymentHabits} color="bg-rose-50 text-rose-700" />
                <PortraitDetail title="游戏习惯" content={player.portrait.gameHabits} color="bg-emerald-50 text-emerald-700" />
                <PortraitDetail title="人物性格" content={player.portrait.personality} color="bg-amber-50 text-amber-700" />
                {player.portrait.realLifePersona && (
                  <PortraitDetail title="现实人设" content={player.portrait.realLifePersona} color="bg-indigo-50 text-indigo-700" />
                )}
              </div>
            </div>
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
          <div className="space-y-3">
            {allOutbursts.map((ob, i) => (
              <ExecutionRecordUpload
                key={i}
                outburstIndex={i}
                playerName={ob.playerName}
                outburstTitle={ob.title}
                existing={executionRecords.find(r => r.historyRecordId === currentHistoryId && r.outburstIndex === i)}
                onChange={handleRecordChange}
              />
            ))}
          </div>
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => handleSubmitRecords('草稿')}
              disabled={saveStatus === 'saving' || !onSaveRecords}
              className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 disabled:opacity-40 transition-all"
            >
              <Save className="w-4 h-4" />
              暂存草稿
            </button>
            <button
              onClick={() => handleSubmitRecords('待审核')}
              disabled={saveStatus === 'saving' || !onSaveRecords}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-lg shadow-indigo-100"
            >
              <Send className="w-4 h-4" />
              提交核实
            </button>
            <button
              onClick={() => handleSubmitRecords('待归档')}
              disabled={saveStatus === 'saving' || !onSaveRecords}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-lg shadow-emerald-100"
            >
              <BookmarkPlus className="w-4 h-4" />
              生成案例
            </button>
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

      <FeedbackPanel />
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
