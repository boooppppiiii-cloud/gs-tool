import React, { useState, useEffect } from 'react';
import { Scroll, FileText, Search, Sparkles, ChevronRight, AlertTriangle, Package, Zap, Edit2, Check, X, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { auth } from '../lib/firebase';
import { cloudFetchAll, cloudSet, cloudUpdate } from '../lib/cloudSync';
import { logUsage } from '../services/analyticsService';
import { searchKnowledgeBase, isNotFound } from '../lib/coze';

const ADMIN_EMAIL = '1463432441@qq.com';

interface ItemData {
  name: string;
}

interface CalendarEvent {
  id?: string;
  day: string;
  activity: string;
  item: string;
  maintenance: string;
  dayNumber?: number;
}

const KB_CATEGORIES: ItemData[] = [
  { name: '神技宝库' },
  { name: '神秘商店' },
  { name: '秘宝商店' },
  { name: '祈愿宝库' },
];

// Generate 60 days of calendar data
const GAME_CALENDAR: CalendarEvent[] = Array.from({ length: 60 }, (_, i) => {
  const day = i + 1;
  let activity = '日常环任务, 经验副本, BOSS挑战';
  let item = '首充礼包/特权卡';
  let maintenance = '监控服务器压力，引导新手玩家入驻行会';

  if (day === 1) {
    activity = '【开服庆典】等级榜开启, 首充返利';
    item = '圣战套装、限时特权卡';
    maintenance = '新区导入, 组织行会成立, 确立GS核心号';
  } else if (day === 3) {
    activity = '【转生开启】首次转生竞赛';
    item = '转生材料包, 高级经验珠';
    maintenance = '重点关注战力前20玩家，引导转生pk';
  } else if (day === 7) {
    activity = '【沙巴克】首次沙城争霸战';
    item = '沙城神装、行会物资礼包';
    maintenance = '组织线下联谊, 处理公会冲突, 刺激行会竞争';
  } else if (day % 7 === 0) {
    activity = '【攻沙复盘】周末沙城决战';
    item = '特惠转生礼、神技宝库开启';
    maintenance = '统计活跃人数，及时合服/关服预警';
  } else if (day === 15) {
    activity = '【合服活动】首次跨服战开启';
    item = '跨服远征礼包, 圣龙装备';
    maintenance = '引导跨服矛盾，制造PK热力点';
  } else if (day === 30) {
    activity = '【满月庆】全服大酬宾, 极品道具返场';
    item = '绝版称号、麻痹戒指(保底)';
    maintenance = '核心玩家电话回访，赠送满月礼包';
  }

  return {
    day: `第 ${day} 天`,
    activity,
    item,
    maintenance
  };
});

interface KnowledgeBaseProps {
  activeTab: 'items' | 'calendar';
  onTabChange: (tab: 'items' | 'calendar') => void;
}

export default function KnowledgeBase({ activeTab, onTabChange }: KnowledgeBaseProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cozeResult, setCozeResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  
  // Dynamic Calendar State
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<CalendarEvent | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    auth.getLoginState().then((state: any) => {
      const email = state?.user?.email || '';
      setIsAdmin(email === ADMIN_EMAIL);
    });
  }, []);

  const loadCalendar = async () => {
    const events = await cloudFetchAll<CalendarEvent>('maintenance_calendar', 'dayNumber');
    if (events.length === 0 && isAdmin) {
      await seedCalendar();
    } else {
      setCalendar(events);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [isAdmin]);

  const seedCalendar = async () => {
    await Promise.all(GAME_CALENDAR.map((event, idx) => {
      const eventId = `day-${idx + 1}`;
      return cloudSet('maintenance_calendar', eventId, { ...event, id: eventId, dayNumber: idx + 1 });
    }));
    logUsage('calendar_seed', 'Seeded initial calendar data');
    await loadCalendar();
  };

  const handleUpdateEvent = async (id: string) => {
    if (!editValues) return;
    await cloudUpdate('maintenance_calendar', id, {
      activity: editValues.activity,
      item: editValues.item,
      maintenance: editValues.maintenance,
    });
    setEditingEventId(null);
    setEditValues(null);
    logUsage('calendar_edit', `Updated calendar day ${id}`);
    await loadCalendar();
  };

  const doSearch = async (query: string) => {
    if (!query.trim()) {
      setCozeResult(null);
      return;
    }

    if (activeTab !== 'items') onTabChange('items');

    setIsSearching(true);
    setCozeResult('');
    try {
      const queryParts = query.trim().split(/[·・\\/\s,，]+/).filter(Boolean);
      let result = await searchKnowledgeBase(query.trim());
      if ((result === '未找到数据' || !result) && queryParts.length > 1) {
        for (const part of queryParts) {
          const partResult = await searchKnowledgeBase(part);
          if (partResult && partResult !== '未找到数据') { result = partResult; break; }
        }
      }
      setCozeResult(result);
      const hit = result && result !== '未找到数据' && !result.includes('暂时不可用');
      logUsage(hit ? 'kb_search_hit' : 'kb_search_miss', query);
    } catch (err) {
      setCozeResult('检索服务暂时不可用，请稍后重试');
      logUsage('kb_search_miss', query);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => doSearch(searchQuery);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 font-sans pt-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 border border-amber-200/60 rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl shadow-amber-100 adventure-icon-active group">
              <Scroll className="w-6 h-6 group-hover:text-amber-500 transition-colors" />
            </div>
            专家知识库
          </h2>
          <p className="text-slate-500 font-medium mt-2">沉淀核心道具数据与运营策略 · 卷轴档案</p>
        </div>
        
        <div className="flex-1 max-w-xl">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索古籍、神兵或攻城指令..." 
              className="w-full pl-16 pr-24 py-5 bg-white border border-slate-200 rounded-3xl shadow-sm focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none transition-all text-sm font-medium placeholder:text-slate-300"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              检索档案
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">

        {activeTab === 'items' && (
          <div className="space-y-8">
            {/* Coze检索结果 */}
            {(isSearching || cozeResult !== null) && (
              <CozeResultCard
                query={searchQuery}
                content={cozeResult ?? ''}
                isStreaming={isSearching}
              />
            )}

            {/* 知识库检索目录 */}
            {cozeResult === null && !isSearching && (
              <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-base font-black text-slate-700 flex items-center gap-2 uppercase tracking-widest">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    知识库检索目录
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">点击分类直接查询 · 或在上方搜索框输入具体道具名称</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {KB_CATEGORIES.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setSearchQuery(cat.name); doSearch(cat.name); }}
                      className="w-full px-8 py-5 flex items-center justify-between hover:bg-slate-50/80 transition-colors group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-amber-50 group-hover:text-indigo-600 transition-all border border-indigo-100">
                          <Scroll className="w-4 h-4" />
                        </div>
                        <span className="text-base font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{cat.name}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="relative pl-8 md:pl-32 py-10">
            {/* Vertical Timeline Line */}
            <div className="absolute left-12 md:left-40 top-0 bottom-0 w-1 bg-slate-200/50" />
            
            <div className="space-y-24">
              {(calendar.length > 0 ? calendar : GAME_CALENDAR).map((event: any, idx) => (
                <div key={idx} className="relative">
                  {/* Day Label with Circle */}
                  <div className="absolute -left-12 md:-left-40 top-0 flex items-center h-full">
                    <div className="flex flex-col items-center">
                      <div className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest z-10 shadow-sm mb-2 border border-indigo-600">
                        {event.day}
                      </div>
                      <div className="w-4 h-4 rounded-full bg-white border-4 border-indigo-600 z-10 shadow-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-left-4 duration-500">
                    {editingEventId === (event.id || idx.toString()) ? (
                      <div className="col-span-full bg-indigo-50/50 p-8 rounded-[40px] border border-indigo-200 space-y-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xl font-black text-indigo-900 uppercase tracking-tight">编辑 {event.day} 运营计划</h4>
                          <div className="flex gap-2">
                             <button 
                               onClick={() => handleUpdateEvent(event.id)}
                               className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all font-black text-xs uppercase"
                             >
                               <Check className="w-4 h-4 inline-block mr-2" /> 保存变更
                             </button>
                             <button 
                               onClick={() => { setEditingEventId(null); setEditValues(null); }}
                               className="p-3 bg-white text-slate-400 rounded-xl border border-slate-200 hover:text-slate-900 transition-all"
                             >
                               <X className="w-4 h-4" />
                             </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">关键活动</label>
                             <textarea 
                                value={editValues?.activity} 
                                onChange={(e) => setEditValues({ ...editValues!, activity: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none h-32 resize-none"
                             />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">关键道具宣导</label>
                             <textarea 
                                value={editValues?.item} 
                                onChange={(e) => setEditValues({ ...editValues!, item: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none h-32 resize-none"
                             />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">维护注意事项</label>
                             <textarea 
                                value={editValues?.maintenance} 
                                onChange={(e) => setEditValues({ ...editValues!, maintenance: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none h-32 resize-none"
                             />
                           </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="relative group/card">
                          <TimelineCard 
                            label="关键活动" 
                            content={event.activity} 
                            icon={<Sparkles className="w-4 h-4 text-rose-500 adventure-icon" />} 
                            color="border-rose-100 hover:border-rose-400"
                          />
                          {isAdmin && (
                            <button 
                              onClick={() => { setEditingEventId(event.id || idx.toString()); setEditValues(event); }}
                              className="absolute top-4 right-4 p-2 bg-slate-100/50 hover:bg-amber-50 text-slate-400 hover:text-indigo-600 rounded-xl opacity-0 group-hover/card:opacity-100 transition-all z-20"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <TimelineCard 
                          label="关键道具宣导" 
                          content={event.item} 
                          icon={<Package className="w-4 h-4 text-amber-500 adventure-icon" />} 
                          color="border-amber-100 hover:border-amber-400"
                        />
                        <TimelineCard 
                          label="维护注意事项" 
                          content={event.maintenance} 
                          icon={<Zap className="w-4 h-4 text-indigo-600 adventure-icon shadow-sm" />} 
                          color="border-indigo-100 hover:border-indigo-400"
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineCard({ label, content, icon, color }: { label: string, content: string, icon: React.ReactNode, color: string }) {
  return (
    <div className={`bg-white p-6 rounded-[28px] border ${color.replace('border-', 'border-')} shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col group relative overflow-hidden`}>
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-150 group-hover:rotate-12 transition-all duration-700">
        {icon}
      </div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-sm font-bold text-slate-800 leading-relaxed">
        {content}
      </p>
    </div>
  );
}

function CozeResultCard({ query, content, isStreaming }: { query: string; content: string; isStreaming: boolean }) {
  const [kbRating, setKbRating] = useState<'yes' | 'no' | null>(null);
  const isEmpty = content.trim().length === 0;
  const notFound = !isEmpty && isNotFound(content);

  const rateKbItem = (rating: 'yes' | 'no') => {
    if (kbRating) return;
    setKbRating(rating);
    logUsage('kb_item_rating', JSON.stringify({ itemName: query, rating }));
  };

  return (
    <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-amber-50/60 px-10 py-8 flex items-center justify-between border-b border-amber-200/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">知识库直查档案</span>
          </div>
          <h3 className="text-3xl font-black tracking-tight text-slate-900">{query}</h3>
        </div>
        <div className="text-right">
          {isStreaming ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span className="text-xs font-black uppercase tracking-widest">检索中</span>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">检索时间</p>
              <p className="text-sm font-black text-indigo-600">{new Date().toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-10">
        {isEmpty ? (
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500 shrink-0" />
            <p className="text-sm font-medium">正在检索知识库，稍候...</p>
          </div>
        ) : notFound ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <AlertTriangle className="w-12 h-12 mb-4 opacity-20 adventure-icon" />
            <p className="text-lg font-bold">知识库中暂未收录该道具的具体数据</p>
            <p className="text-sm mt-1">尝试调整关键词或联系管理员更新表格</p>
          </div>
        ) : (
          <div>
            <SectionHeader icon={<FileText className="w-5 h-5 text-indigo-600" />} title="第一部分：完整道具档案" />
            <div className="mt-8 bg-slate-50/60 rounded-3xl border border-slate-100 p-6">
              <p className="text-sm font-medium text-slate-700 leading-loose whitespace-pre-line">
                {content}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse ml-0.5 rounded-sm align-middle" />
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {!isStreaming && !isEmpty && !notFound && (
        <div className="px-10 py-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-400">这份档案解决你的问题了吗？</p>
          {kbRating ? (
            <span className={`text-xs font-black px-3 py-1 rounded-full ${kbRating === 'yes' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {kbRating === 'yes' ? '已记录：有帮助' : '已记录：未解决'}
            </span>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => rateKbItem('yes')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors"
              >
                <ThumbsUp className="w-3 h-3" /> 有帮助
              </button>
              <button
                onClick={() => rateKbItem('no')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors"
              >
                <ThumbsDown className="w-3 h-3" /> 未解决
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode, title: string }) {
  return (
    <div className="flex items-center gap-3 pb-2 border-b-2 border-indigo-600 w-fit">
      {icon}
      <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase">{title}</h4>
    </div>
  );
}

function TabButton({ active, label, onClick, icon }: { active: boolean, label: string, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
        active 
          ? 'bg-amber-50 text-indigo-600 border border-amber-200 shadow-sm'
          : 'text-slate-400 hover:text-slate-800 hover:bg-white/50'
      }`}
    >
      <div className={active ? 'adventure-icon-active' : ''}>
        {icon}
      </div>
      {label}
    </button>
  );
}

