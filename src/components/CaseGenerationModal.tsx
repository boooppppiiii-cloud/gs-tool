import React, { useState, useEffect } from 'react';
import { Sparkles, X, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ExecutionRecord, AnalysisCase } from '../types';
import { generateCaseSummary } from '../lib/gemini';

interface OutburstData {
  trigger: string;
  triggerPoint: string;
  context: { roleName: string; content: string; time: string }[];
  gsAdvice: { action: string; disposalPlan: string };
  mergeStage?: string;
  caseBackground?: string;
  tags?: string[];
}

interface Props {
  playerName: string;
  serverName: string;
  gsName: string;
  outburst: OutburstData;
  execRecord: Partial<ExecutionRecord>;
  onClose: () => void;
  onGenerate: (draft: Partial<AnalysisCase>) => Promise<void>;
}

export default function CaseGenerationModal({
  playerName,
  serverName,
  gsName,
  outburst,
  execRecord,
  onClose,
  onGenerate,
}: Props) {
  const contextText = outburst.context
    .map(c => `[${c.time}] ${c.roleName}: ${c.content}`)
    .join('\n');

  const [title, setTitle] = useState('');
  const [outburstReason, setOutburstReason] = useState(outburst.trigger);
  const [contextEdit, setContextEdit] = useState(contextText);
  const [executionText, setExecutionText] = useState(execRecord.description ?? '');
  const [summary, setSummary] = useState('');
  const [reflection, setReflection] = useState(execRecord.reflection ?? '');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const runAi = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await generateCaseSummary({
        playerName,
        outburstTrigger: outburstReason,
        triggerPoint: outburst.triggerPoint,
        contextText: contextEdit,
        executionDescription: executionText,
        executionReflection: reflection,
        disposalPlan: outburst.gsAdvice.disposalPlan,
      });
      if (!title) setTitle(res.title);
      setOutburstReason(res.outburstReason);
      setSummary(res.summary);
      if (!reflection) setReflection(res.reflection);
    } catch (e: any) {
      setAiError(e?.message ?? 'AI 生成失败，请重试');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => { runAi(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    setSaving(true);
    try {
      await onGenerate({
        title: title || `${serverName} - ${playerName} 负面处置`,
        tags: outburst.tags ?? ['AI辅助整合'],
        serverName,
        gsName,
        playerName,
        mergeStage: outburst.mergeStage,
        caseBackground: outburst.caseBackground,
        outburstReason,
        triggerPoint: outburst.triggerPoint,
        context: outburst.context,
        gsAction: executionText,
        disposalPlan: summary,
        caseResult: reflection,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">AI 辅助整合案例</p>
              <p className="text-[10px] text-slate-400 font-medium">玩家：{playerName} · {serverName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

          {/* 案例标题 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">案例标题</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={aiLoading ? 'AI 生成中…' : '输入案例标题'}
              className="w-full px-4 py-2.5 text-sm font-bold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
            />
          </div>

          {/* ① 负面原因 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 text-[9px] font-black flex items-center justify-center">①</span>
              负面原因
            </label>
            <textarea
              value={outburstReason}
              onChange={e => setOutburstReason(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none leading-relaxed"
            />
          </div>

          {/* ② 聊天上下文 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[9px] font-black flex items-center justify-center">②</span>
              聊天上下文
            </label>
            <textarea
              value={contextEdit}
              onChange={e => setContextEdit(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 text-xs font-mono border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none leading-relaxed text-slate-600"
            />
          </div>

          {/* ③ GS 执行记录 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-600 text-[9px] font-black flex items-center justify-center">③</span>
              GS 执行记录
            </label>
            <textarea
              value={executionText}
              onChange={e => setExecutionText(e.target.value)}
              rows={3}
              placeholder="描述本次执行过程、使用的道具、与玩家的沟通情况…"
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none leading-relaxed placeholder:text-slate-300"
            />
          </div>

          {/* ④ 经验总结与反思 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 text-[9px] font-black flex items-center justify-center">④</span>
                经验总结与反思
              </label>
              <button
                onClick={runAi}
                disabled={aiLoading}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                重新生成
              </button>
            </div>
            {aiLoading && !summary ? (
              <div className="flex items-center gap-2 px-4 py-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 正在生成经验总结…
              </div>
            ) : (
              <>
                <textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  rows={2}
                  placeholder="经验总结：本次处置的核心策略与成效…"
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none leading-relaxed placeholder:text-slate-300"
                />
                <textarea
                  value={reflection}
                  onChange={e => setReflection(e.target.value)}
                  rows={2}
                  placeholder="复盘反思：下次遇到类似情况可以改进的点…"
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none leading-relaxed placeholder:text-slate-300"
                />
              </>
            )}
            {aiError && <p className="text-xs text-rose-500 font-medium px-1">{aiError}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors"
          >
            取消
          </button>
          {saved ? (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold">
              <CheckCircle2 className="w-4 h-4" />
              案例已生成
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={saving || aiLoading}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-100"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              确认生成案例
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
