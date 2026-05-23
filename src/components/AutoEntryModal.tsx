import React from 'react';
import { X, Upload, Sparkles, FileText, Loader2, CheckCircle2, AlertTriangle as AlertTriangleIcon, Scroll, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnalysisCase, User } from '../types';
import * as dataService from '../lib/dataService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSuccess: () => void;
}

export default function AutoEntryModal({ isOpen, onClose, user, onSuccess }: Props) {
  const [text, setText] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successData, setSuccessData] = React.useState<any | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        const content = utf8Decoder.decode(buffer);
        setText(content);
      } catch (err) {
        const gbkDecoder = new TextDecoder('gbk');
        const content = gbkDecoder.decode(buffer);
        setText(content);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processAI = async () => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setError(null);
    setSuccessData(null);

    try {
      const prompt = `你是一个资深游戏生态运营知识库管理员。你的任务是从杂乱的运营复盘文档中，萃取出对 RAG 检索最有价值的结构化经验。

提炼原则：极其精简，去掉废话；保留案例中的【玩家心理画像】、【GS具体操作话术】和【可复用策略】。

输入文本：
${text}

必须严格返回 JSON 对象（不要 markdown 包裹），包含字段：
- title: 案例一句话简述（15字内）
- merge_stage: 从文本中提取合服阶段（如新服、双合、三合、多合），无法提取则填""
- case_background: 从文本中提取案例背景（3-5句话，无则填""）
- core_scenario: 触发事件的核心场景或玩家语录（即负面触发点）
- player_portrait: 玩家心理剖析
- gs_discourse: GS的具体介入身份与话术（即具体处置动作，分步骤描述）
- reusable_strategy: 可复用策略总结（即处置策略）`;

      const res = await fetch('/api/gemini/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) throw new Error(`AI 接口异常: ${res.status}`);
      const data = await res.json();
      const jsonText = data.choices?.[0]?.message?.content;
      if (!jsonText) throw new Error('AI 未返回有效数据');

      const result = JSON.parse(jsonText);
      setSuccessData(result);

      const toStr = (v: any): string => typeof v === 'string' ? v : (v != null ? JSON.stringify(v) : '');

      // Map result to AnalysisCase and save
      const id = `case_auto_${Date.now()}`;
      const newCase: AnalysisCase = {
        id,
        title: toStr(result.title),
        tags: ['系统自动提取'],
        serverName: '批量录入',
        gsName: 'AI 专家',
        playerName: '案例玩家',
        mergeStage: toStr(result.merge_stage),
        caseBackground: toStr(result.case_background),
        outburstReason: toStr(result.core_scenario),
        triggerPoint: toStr(result.player_portrait),
        context: [],
        gsAction: toStr(result.gs_discourse),
        disposalPlan: toStr(result.reusable_strategy),
        caseResult: '已归档',
        timestamp: new Date().toISOString(),
        views: 0,
        likes: 0,
        votedUserIds: [],
        isPublic: false,
        ownerId: user.id
      };

      await dataService.saveManualCase(newCase);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '处理过程中发生错误');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-stone-800/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Scroll className="w-6 h-6 text-indigo-600 adventure-icon" />
              自动化优秀案例录入
            </h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">AI-Powered Experience Extraction</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-6">
          {!successData ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black text-slate-700">粘贴复盘文本或上传文件</label>
                  <label className="cursor-pointer px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    上传 TXT
                    <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="在此输入您的运营复盘长文本、实战记录或微信对谈摘录..."
                  className="w-full h-64 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-sm focus:outline-none focus:border-indigo-500 transition-all resize-none font-medium leading-relaxed"
                />
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold animate-in fade-in slide-in-from-top-2">
                  <AlertTriangleIcon className="w-5 h-5 shrink-0 adventure-icon" />
                  {error}
                </div>
              )}

              <button
                onClick={processAI}
                disabled={!text.trim() || isProcessing}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center justify-center gap-3 group"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    AI 正在深度清洗提炼中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    <Sparkles className="w-6 h-6 group-hover:animate-pulse" />
                    一键智能录入案例
                  </span>
                )}
              </button>
            </>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-emerald-50">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-slate-900">录取成功！</h4>
                <p className="text-slate-500 font-medium">AI 已为您从原文中精准萃取核心经验</p>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">提炼标题</span>
                  <p className="text-sm font-black text-slate-800">{successData.title}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">核心场景</span>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{successData.core_scenario}</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => { setSuccessData(null); setText(''); }}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  继续录入
                </button>
                <button
                  onClick={() => { onSuccess(); onClose(); }}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  查看案例库
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
