/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ThumbsUp,
  Eye,
  Flame,
  MessageSquare,
  Sparkles,
  Search,
  Share2,
  X,
  Tag,
  Zap,
} from 'lucide-react';
import { AnalysisCase, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import AutoEntryModal from './AutoEntryModal';

export const CASE_TAGS = [
  '区服矛盾调解',
  '大R负面解决',
  '大R预流失挽回',
  '付费活动引导',
  '系统自动提取',
  '其他价值案例',
  '跨部门协作',
  '1-15天维护思路',
  '对抗号维护思路'
];

interface Props {
  cases: AnalysisCase[];
  user: User;
  onVote: (id: string) => void;
  onView: (id: string) => void;
  onRefresh?: () => void;
}

const TAG_COLORS: { [key: string]: string } = {
  '区服矛盾调解': 'bg-rose-600 shadow-rose-100',
  '大R负面解决': 'bg-indigo-600 shadow-indigo-100',
  '大R预流失挽回': 'bg-amber-600 shadow-amber-100',
  '付费活动引导': 'bg-emerald-600 shadow-emerald-100',
  '系统自动提取': 'bg-slate-600 shadow-slate-100',
  '1-15天维护思路': 'bg-purple-600 shadow-purple-100',
  '对抗号维护思路': 'bg-cyan-600 shadow-cyan-100'
};

const toStr = (v: unknown): string => typeof v === 'string' ? v : (v != null ? JSON.stringify(v) : '');

export default function CaseGallery({ cases, user, onVote, onView, onRefresh }: Props) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [isAutoEntryOpen, setIsAutoEntryOpen] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const sortedCases = [...cases].sort((a, b) => {
    if (a.isHot && !b.isHot) return -1;
    if (!a.isHot && b.isHot) return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const filteredCases = sortedCases.filter(c => {
    if (!c.isPublic) return false;
    const matchesSearch = toStr(c.title).toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.playerName && toStr(c.playerName).toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (c.outburstReason && toStr(c.outburstReason).toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTag = !selectedTag || (c.tags && c.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      onView(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-7 h-7 text-indigo-600" />
                优秀案例库
              </h2>
              <p className="text-sm text-slate-500 font-medium">学习、沉淀、分享优质业务实操</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索关键词..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-80 transition-all font-medium text-sm"
              />
            </div>
            <button 
              onClick={() => setIsAutoEntryOpen(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 group shrink-0"
            >
              <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
              智能提取录入
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
           <button 
             onClick={() => setSelectedTag(null)}
             className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
               !selectedTag ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
             }`}
           >
             全部
           </button>
           {CASE_TAGS.map(tag => (
             <button 
               key={tag}
               onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
               className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                 selectedTag === tag 
                   ? `${TAG_COLORS[tag] || 'bg-indigo-600 shadow-indigo-100'} text-white shadow-md` 
                   : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
               }`}
             >
               <Tag className="w-3 h-3" /> {tag}
             </button>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredCases.map((c) => (
          <div 
            key={c.id} 
            className={`group bg-white border rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-500 flex flex-col cursor-pointer ${
              c.isHot ? 'ring-2 ring-rose-500/20 border-rose-200 shadow-xl shadow-rose-100/50' : 'border-slate-200 shadow-sm'
            } ${expandedId === c.id ? 'col-span-full md:col-span-2 lg:col-span-3 ring-2 ring-indigo-500 border-indigo-200' : ''}`}
            onClick={() => toggleExpand(c.id)}
          >
            {/* Header */}
            <div className={`p-6 border-b border-slate-100 ${c.isHot ? 'bg-rose-50/50' : 'bg-slate-50/50'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                   {expandedId !== c.id && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg uppercase tracking-widest">{c.serverName}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {c.isHot && (
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-500 text-white text-[10px] font-black rounded-full shadow-lg shadow-rose-200">
                      <Flame className="w-3 h-3" /> HOT
                    </div>
                  )}
                  {expandedId === c.id && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <h3 className={`text-lg font-black text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors ${expandedId === c.id ? 'text-2xl line-clamp-none mb-4' : ''}`}>
                {c.title}
              </h3>

              {c.tags && c.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {c.tags.map(t => (
                    <span 
                      key={t} 
                      className={`px-3 py-1 text-white text-[10px] font-black rounded-lg shadow-lg uppercase tracking-tight ${TAG_COLORS[t] || 'bg-indigo-600 shadow-indigo-100'}`}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 flex-1">
              <div className="space-y-5">
                {/* 折叠预览 */}
                {expandedId !== c.id && (
                  <>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest leading-none flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> 负面触发点
                      </p>
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-700 font-bold leading-relaxed line-clamp-3">
                        {toStr(c.outburstReason) || '暂无说明'}
                      </div>
                    </div>
                    <div className="pt-2 flex justify-end">
                      <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        查看完整案例 <Share2 className="w-3 h-3" />
                      </span>
                    </div>
                  </>
                )}

                {/* 展开详情 */}
                {expandedId === c.id && (
                  <div className="space-y-5 pt-2 border-t border-slate-100 animate-in slide-in-from-top-4 duration-500">
                    {/* 基础信息 */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700">
                        区服：{c.serverName}
                      </span>
                      <span className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700">
                        生态：{c.gsName || '系统默认'}
                      </span>
                      <span className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700">
                        玩家：{c.playerName || '匿名'}
                      </span>
                      {c.mergeStage && (
                        <span className="px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-xl font-bold text-amber-700">
                          合服阶段：{c.mergeStage}
                        </span>
                      )}
                      <span className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-400">
                        {new Date(c.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    {/* 案例背景 */}
                    {c.caseBackground && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">案例背景</p>
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-600 leading-relaxed">
                          {toStr(c.caseBackground)}
                        </div>
                      </div>
                    )}

                    {/* 负面触发点 */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">负面触发点</p>
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-sm text-rose-800 font-medium leading-relaxed">
                        {toStr(c.outburstReason) || '暂无说明'}
                      </div>
                      {c.triggerPoint && (
                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl text-sm text-orange-900 font-medium leading-relaxed">
                          {toStr(c.triggerPoint)}
                        </div>
                      )}
                    </div>

                    {/* 溯源上下文 */}
                    {c.context && c.context.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <MessageSquare className="w-3 h-3" /> 溯源上下文
                        </p>
                        <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-60 overflow-y-auto">
                          {c.context.map((msg, midx) => (
                            <div key={midx} className="space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[9px] font-bold ${msg.roleName === c.playerName ? 'text-indigo-600' : 'text-slate-400'}`}>{msg.roleName}</span>
                                <span className="text-[9px] text-slate-300">{msg.time}</span>
                              </div>
                              <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${msg.roleName === c.playerName ? 'bg-white border border-slate-200' : 'bg-slate-200/50 text-slate-600'}`}>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 处置策略 */}
                    {c.disposalPlan && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">处置策略</p>
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-700 leading-relaxed">
                          {toStr(c.disposalPlan)}
                        </div>
                      </div>
                    )}

                    {/* 具体处置动作（重点） */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-3 h-3" /> 具体处置动作
                      </p>
                      <div className="p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl text-sm text-slate-800 font-bold leading-relaxed whitespace-pre-line">
                        {toStr(c.gsAction) || '未填写'}
                      </div>
                    </div>

                    {/* 案例结果评估 */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">案例结果评估</p>
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm text-slate-700 leading-relaxed font-medium">
                        {toStr(c.caseResult) || '跟进中'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                <Eye className="w-3.5 h-3.5" /> {c.views}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onVote(c.id); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-90 border ${
                  c.votedUserIds?.includes(user.id)
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-slate-400 border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span className="text-xs font-black">{c.likes}</span>
              </button>
            </div>
          </div>
        ))}
        {filteredCases.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-[32px]">
            <Sparkles className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">没有找到符合条件的案例</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAutoEntryOpen && (
          <AutoEntryModal 
            isOpen={isAutoEntryOpen}
            onClose={() => setIsAutoEntryOpen(false)}
            user={user}
            onSuccess={() => {
              onRefresh?.();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
