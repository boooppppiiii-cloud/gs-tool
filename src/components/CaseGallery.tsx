/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ThumbsUp, 
  Eye, 
  Flame, 
  Calendar, 
  MessageSquare,
  Sparkles,
  Search,
  Globe,
  Lock,
  Edit3,
  Trash2,
  Share2,
  Check,
  X,
  Tag,
  Clock,
  Zap,
  Activity,
  Plus
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
  filter: 'online' | 'my';
  onFilterChange: (filter: 'online' | 'my') => void;
  onVote: (id: string, type: 'like') => void;
  onView: (id: string) => void;
  onUpdate: (id: string, updates: Partial<AnalysisCase>) => void;
  onDelete: (id: string) => void;
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

export default function CaseGallery({ cases, user, filter, onFilterChange, onVote, onView, onUpdate, onDelete, onRefresh }: Props) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [isAutoEntryOpen, setIsAutoEntryOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState({ 
    title: '',
    tags: [] as string[],
    serverName: '',
    gsName: '',
    playerName: '',
    outburstReason: '',
    gsAction: '',
    caseResult: ''
  });

  const sortedCases = [...cases].sort((a, b) => {
    if (a.isHot && !b.isHot) return -1;
    if (!a.isHot && b.isHot) return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const filteredCases = sortedCases.filter(c => {
    const matchesSearch = toStr(c.title).toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.playerName && toStr(c.playerName).toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (c.outburstReason && toStr(c.outburstReason).toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTag = !selectedTag || (c.tags && c.tags.includes(selectedTag));
    const matchesFilter = filter === 'online' ? c.isPublic : c.ownerId === user.id;
    return matchesSearch && matchesTag && matchesFilter;
  });

  const startEdit = (c: AnalysisCase, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditForm({ 
      title: c.title,
      tags: c.tags || [],
      serverName: c.serverName,
      gsName: c.gsName || '',
      playerName: c.playerName || '',
      outburstReason: c.outburstReason || '',
      gsAction: c.gsAction || '',
      caseResult: c.caseResult || ''
    });
  };

  const handleSaveEdit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(id, { ...editForm });
    setEditingId(null);
  };

  const toggleTag = (tag: string) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

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
                   {!c.isPublic && filter === 'my' && <span className="px-2 py-0.5 bg-slate-200 text-slate-500 text-[10px] font-bold rounded-lg uppercase tracking-widest">私有</span>}
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
              
              {editingId === c.id ? (
                <div onClick={e => e.stopPropagation()} className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">标题</p>
                    <input 
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-lg font-black outline-none focus:ring-2 ring-indigo-500"
                      value={editForm.title}
                      onChange={e => setEditForm({...editForm, title: e.target.value})}
                    />
                  </div>
                </div>
              ) : (
                <h3 className={`text-lg font-black text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors ${expandedId === c.id ? 'text-2xl line-clamp-none mb-4' : ''}`}>
                  {c.title}
                </h3>
              )}

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
              {editingId === c.id ? (
                <div onClick={e => e.stopPropagation()} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">区服</p>
                      <input 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 ring-indigo-500"
                        value={editForm.serverName}
                        onChange={e => setEditForm({...editForm, serverName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GS</p>
                      <input 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 ring-indigo-500"
                        value={editForm.gsName}
                        onChange={e => setEditForm({...editForm, gsName: e.target.value})}
                        placeholder="GS角色名"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">玩家</p>
                      <input 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 ring-indigo-500"
                        value={editForm.playerName}
                        onChange={e => setEditForm({...editForm, playerName: e.target.value})}
                        placeholder="玩家角色名"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">案例类型 (多选)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CASE_TAGS.map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all border ${
                              editForm.tags.includes(tag) 
                                ? `${TAG_COLORS[tag] || 'bg-indigo-600 border-indigo-600'} text-white shadow-sm` 
                                : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
                       <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">玩家爆发负面原因 (初步显示的内容)</p>
                       <textarea 
                         className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 ring-rose-500 h-20 resize-none shadow-sm font-medium"
                         value={editForm.outburstReason}
                         onChange={e => setEditForm({...editForm, outburstReason: e.target.value})}
                       />
                    </div>

                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-2">
                       <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">GS 具体处置动作</p>
                       <textarea 
                         className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 ring-indigo-500 h-24 resize-none shadow-sm"
                         value={editForm.gsAction}
                         onChange={e => setEditForm({...editForm, gsAction: e.target.value})}
                       />
                    </div>

                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-2">
                       <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">案例结果</p>
                       <textarea 
                         className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 ring-emerald-500 h-20 resize-none shadow-sm"
                         value={editForm.caseResult}
                         onChange={e => setEditForm({...editForm, caseResult: e.target.value})}
                       />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                      onClick={() => setEditingId(null)} 
                      className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all active:scale-95"
                    >
                      取消修改
                    </button>
                    <button 
                      onClick={(e) => handleSaveEdit(c.id, e)} 
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      提交更新
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary view fields */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest leading-none flex items-center gap-2">
                      <Sparkles className="w-3 h-3" /> 玩家爆发负面原因
                    </p>
                    <div className={`p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-700 font-bold leading-relaxed ${expandedId === c.id ? '' : 'line-clamp-3'}`}>
                      {toStr(c.outburstReason) || '暂无说明'}
                    </div>
                  </div>

                  {/* Expanded fields */}
                  {expandedId === c.id && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100 animate-in slide-in-from-top-4 duration-500">
                      <div className="space-y-6">
                        <section className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">基础信息</h4>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">区服</p>
                                <p className="text-xs font-bold text-slate-800">{c.serverName}</p>
                             </div>
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">GS</p>
                                <p className="text-xs font-bold text-slate-800">{c.gsName || '系统默认'}</p>
                             </div>
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">玩家</p>
                                <p className="text-xs font-bold text-slate-800">{c.playerName || '匿名玩家'}</p>
                             </div>
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">入库时间</p>
                                <p className="text-xs font-bold text-slate-800">{new Date(c.timestamp).toLocaleDateString()}</p>
                             </div>
                          </div>
                        </section>

                        {c.context && c.context.length > 0 && (
                          <section className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center justify-between">
                              溯源上下文
                              <Clock className="w-3 h-3 text-slate-300" />
                            </h4>
                            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-[300px] overflow-y-auto">
                              {c.context.map((msg, midx) => (
                                <div key={midx} className="space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                     <span className={`text-[10px] font-bold ${msg.roleName === c.playerName ? 'text-indigo-600' : 'text-slate-400'}`}>{msg.roleName}</span>
                                     <span className="text-[9px] text-slate-300 font-medium tracking-tighter">{msg.time}</span>
                                  </div>
                                  <div className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.roleName === c.playerName ? 'bg-white border border-slate-200' : 'bg-slate-200/50 text-slate-600'}`}>
                                    {msg.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                      </div>

                      <div className="space-y-6">
                        <section className="space-y-4">
                           <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">分析与处置</h4>
                           <div className="space-y-4">
                             {c.triggerPoint && (
                               <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                                 <p className="text-[10px] font-bold text-orange-400 uppercase mb-2">负面触发点</p>
                                 <p className="text-sm text-orange-900 font-medium leading-relaxed">
                                   {toStr(c.triggerPoint)}
                                 </p>
                               </div>
                             )}
                             <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                               <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2 text-indigo-600 font-black">GS具体处置动作</p>
                               <p className="text-sm text-slate-700 leading-relaxed font-bold">
                                 {toStr(c.gsAction) || '未填写'}
                               </p>
                             </div>
                             {c.disposalPlan && (
                               <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                 <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">GS 处置方案详情</p>
                                 <p className="text-xs text-slate-600 leading-relaxed">
                                   {toStr(c.disposalPlan)}
                                 </p>
                               </div>
                             )}
                             <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                               <p className="text-[10px] font-bold text-emerald-400 uppercase mb-2">案例结果</p>
                               <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                 {toStr(c.caseResult) || '跟进中'}
                               </p>
                             </div>
                           </div>
                        </section>
                      </div>
                    </div>
                  )}

                  {!expandedId && (
                    <div className="pt-4 flex justify-end">
                       <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                         详情全部内容 <Share2 className="w-3 h-3" rotate={90} />
                       </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4 text-slate-400">
                <span className="flex items-center gap-1.5 text-[10px] font-bold">
                  <Eye className="w-3.5 h-3.5" /> {c.views}
                </span>
                {filter === 'my' && editingId !== c.id && (
                  <button 
                    onClick={(e) => startEdit(c, e)}
                    className="p-1 px-3 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                  >
                    编辑案例
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {filter === 'online' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onVote(c.id, 'like'); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-90 border ${
                      c.votedUserIds?.includes(user.id) 
                        ? 'bg-emerald-500 text-white border-emerald-500' 
                        : 'bg-white text-slate-400 border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="text-xs font-black">{c.likes}</span>
                  </button>
                )}
                {filter === 'my' && (
                  <div className="flex items-center gap-2">
                    {!c.isPublic && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onUpdate(c.id, { isPublic: true }); }}
                        className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="上传至公海"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                      className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
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
