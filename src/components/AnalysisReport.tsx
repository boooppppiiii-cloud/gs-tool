/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
  Trash2,
  Shield,
  Sword,
  Scroll,
  Crown
} from 'lucide-react';
import { AnalysisResult, PlayerBehaviorReport } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

interface Props {
  result: AnalysisResult;
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export default function AnalysisReport({ result, onRemovePlayer, onUpdateReport }: Props & { onRemovePlayer: (roleName: string) => void, onUpdateReport?: (newResult: AnalysisResult) => void }) {
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
                  <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-indigo-600 shadow-lg shadow-slate-200 adventure-icon-active">
                    <Shield className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-bold text-slate-800">{player.roleName}</h4>
                      <button 
                        onClick={() => {
                          onRemovePlayer(player.roleName);
                          if (onUpdateReport) {
                            const newResult = {
                              ...result,
                              playerReports: result.playerReports.filter(p => p.roleName !== player.roleName),
                              identifiedKeyPlayers: result.identifiedKeyPlayers.filter(p => p !== player.roleName)
                            };
                            onUpdateReport(newResult);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="从报告中移除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
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
            player.negativeOutbursts.map((outburst, idx) => (
              <div key={`${player.roleName}-${idx}`} className="bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div className="px-8 py-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 adventure-icon" />
                    <span className="font-black text-rose-900 uppercase tracking-tight">{player.roleName} - {outburst.trigger}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-rose-200 text-rose-700 text-[10px] font-bold rounded-full uppercase tracking-tighter shadow-sm">
                      负面状态捕获
                    </span>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-slate-50/50">
                  {/* WeChat Bubbles */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" /> 溯源上下文 (IM 原始记录)
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium italic">最近 3-5 条相关对话回溯</span>
                    </div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                      {outburst.context.map((msg, midx) => (
                        <div key={midx} className={`flex ${msg.roleName === player.roleName ? 'justify-start' : 'justify-end'} gap-3 items-start`}>
                          <div className={`max-w-[85%] space-y-1 ${msg.roleName === player.roleName ? 'items-start' : 'items-end'}`}>
                            <div className="flex items-center gap-2 px-1">
                              <span className="text-[10px] text-slate-400 font-bold tracking-tighter">{msg.time}</span>
                            </div>
                            <div className={`p-4 rounded-3xl text-sm leading-relaxed shadow-sm relative ${
                              msg.roleName === player.roleName 
                                ? 'bg-white border border-slate-100 rounded-tl-none text-slate-800' 
                                : 'bg-indigo-600 text-white rounded-tr-none'
                            }`}>
                              <p>{msg.content}</p>
                              {msg.roleName === player.roleName && (
                                <div className="absolute -left-2 top-0 w-2 h-2 bg-white border-l border-t border-slate-100 -rotate-45" />
                              )}
                              {msg.roleName !== player.roleName && (
                                <div className="absolute -right-2 top-0 w-2 h-2 bg-indigo-600 -rotate-45" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* GS Advice */}
                  <div className="flex flex-col gap-6">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Activity className="w-3 h-3" /> 负面触发点归因
                      </p>
                      <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                         <p className="text-sm text-orange-900 font-medium leading-relaxed">
                           {outburst.triggerPoint}
                         </p>
                      </div>
                    </div>

                    <div className="flex-1 bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">核心动作推荐</span>
                          <Zap className="w-3 h-3 text-indigo-400" />
                        </div>
                        <div className="p-4 bg-indigo-50 border-l-4 border-l-indigo-600 rounded-r-xl text-indigo-800 font-bold">
                          {outburst.gsAdvice.action}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest uppercase">GS 处置方案</span>
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                          <p className="text-sm text-slate-700 leading-relaxed font-bold">
                            {outburst.gsAdvice.disposalPlan}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">专家归因分析</span>
                        <p className="text-sm text-slate-500 leading-relaxed italic">
                          {outburst.gsAdvice.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 3. Recharge & Visualization */}
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
