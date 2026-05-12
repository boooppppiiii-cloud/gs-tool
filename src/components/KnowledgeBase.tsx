import React, { useState, useMemo, useEffect } from 'react';
import { Scroll, FileText, Search, Sparkles, ChevronRight, AlertTriangle, Package, Zap, Edit2, Check, X, Loader2 } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { logUsage } from '../services/analyticsService';
import { searchKnowledgeBase, isNotFound } from '../lib/coze';

const ADMIN_EMAIL = '1463432441@qq.com';

interface ItemData {
  name: string;
  activity: string;
  time: string;
  price: string;
  review: string;
  boost: string;
  planSuperR: string;
  planBigR: string;
  planMidR: string;
  planSmallR: string;
  gsApplication: string;
  gsTier: string;
  keywords: string[]; // For pain points like "control", "survival"
}

interface CalendarEvent {
  id?: string;
  day: string;
  activity: string;
  item: string;
  maintenance: string;
  dayNumber?: number;
}

// Initial structured data based on the new requirements
const ITEM_DATABASE: ItemData[] = [
  {
    name: '麻痹戒指',
    activity: '充值排行 / 这里的活动名称',
    time: '开服第1天',
    price: '暂无数据',
    review: '顶级控制道具，PK必备。',
    boost: '攻击时5%几率使敌方进入麻痹状态，持续3秒。',
    planSuperR: '通过充值榜直接抢占第一。',
    planBigR: '通过累计充值活动获取进度。',
    planMidR: '建议参与循环累充活动缓慢追赶。',
    planSmallR: '日常打宝看运气，不建议强求。',
    gsApplication: '在行会混战或劫镖过程中，该戒指能起到决定性作用。',
    gsTier: '超R/大R核心追求，属性极高。',
    keywords: ['控制', 'PK', '胜率']
  },
  {
    name: '圣灵披风',
    activity: '特权返场 - 神技宝库',
    time: '开服第113天',
    price: '1998 元宝',
    review: '高阶防御装备，防御力惊人。',
    boost: '防御提升20%，血量上限提升15%。',
    planSuperR: '直接购买全套返场礼包。',
    planBigR: '购买核心单品。',
    planMidR: '关注后续特价礼包。',
    planSmallR: '暂无推荐方案。',
    gsApplication: '提高前排生存能力，尤其是在抢夺资源点时。',
    gsTier: '中R及以上必买，性价比较高。',
    keywords: ['肉', '防御', '生存']
  }
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
  const [searchResults, setSearchResults] = useState<ItemData[] | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
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
    try {
      const res = await db.collection('maintenance_calendar').orderBy('dayNumber', 'asc').get();
      const events = (res.data || []) as CalendarEvent[];
      if (events.length === 0 && isAdmin) {
        await seedCalendar();
      } else {
        setCalendar(events);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'maintenance_calendar');
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [isAdmin]);

  const seedCalendar = async () => {
    try {
      await Promise.all(GAME_CALENDAR.map((event, idx) => {
        const eventId = `day-${idx + 1}`;
        return db.collection('maintenance_calendar').doc(eventId).set({ ...event, id: eventId, dayNumber: idx + 1 });
      }));
      logUsage('calendar_seed', 'Seeded initial calendar data');
      await loadCalendar();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'maintenance_calendar');
    }
  };

  const handleUpdateEvent = async (id: string) => {
    if (!editValues) return;
    try {
      await db.collection('maintenance_calendar').doc(id).update({
        activity: editValues.activity,
        item: editValues.item,
        maintenance: editValues.maintenance
      });
      setEditingEventId(null);
      setEditValues(null);
      logUsage('calendar_edit', `Updated calendar day ${id}`, '/knowledge');
      await loadCalendar();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `maintenance_calendar/${id}`);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSelectedItem(null);
      setCozeResult(null);
      return;
    }

    logUsage('search', `Searched for: ${searchQuery}`, '/knowledge');
    if (activeTab !== 'items') onTabChange('items');

    // 先走本地库快速响应（多词拆分 + 8字段加权评分）
    const terms = searchQuery.toLowerCase().split(/[\s,，·・]+/).filter(Boolean);
    const scored = ITEM_DATABASE.map(item => {
      let score = 0;
      // 把复合名称（如"红颜·阿离"）拆成各部分单独索引
      const nameParts = item.name.split(/[·・\\/\s]+/).filter(p => p.length > 0);
      const fields = [
        { text: item.name, w: 10 },
        ...nameParts.map(part => ({ text: part, w: 10 })),
        { text: item.keywords.join(' '), w: 6 },
        { text: item.review, w: 4 },
        { text: item.boost, w: 4 },
        { text: item.gsApplication, w: 3 },
        { text: item.gsTier, w: 3 },
        { text: item.activity, w: 2 },
        { text: item.time, w: 2 },
      ];
      for (const term of terms) {
        for (const { text, w } of fields) {
          if (text?.toLowerCase().includes(term)) score += w;
        }
      }
      return { item, score };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    const localResults = scored.map(r => r.item);
    setSearchResults(localResults);
    setSelectedItem(localResults.length === 1 ? localResults[0] : null);

    // Coze 知识库检索：先用完整词搜，未命中再逐个拆分词搜索
    setIsSearching(true);
    setCozeResult('');
    try {
      const queryParts = searchQuery.trim().split(/[·・\\/\s,，]+/).filter(Boolean);
      let result = await searchKnowledgeBase(searchQuery.trim());
      if ((result === '未找到数据' || !result) && queryParts.length > 1) {
        for (const part of queryParts) {
          const partResult = await searchKnowledgeBase(part);
          if (partResult && partResult !== '未找到数据') { result = partResult; break; }
        }
      }
      setCozeResult(result);
    } catch (err) {
      setCozeResult('检索服务暂时不可用，请稍后重试');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 font-sans pt-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-indigo-600 shadow-xl shadow-slate-200 adventure-icon-active group">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all border border-indigo-600/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
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
            {/* Coze 知识库直查结果卡片 */}
            {(isSearching || cozeResult !== null) && (
              <CozeResultCard
                query={searchQuery}
                content={cozeResult ?? ''}
                isStreaming={isSearching}
              />
            )}

            {searchResults ? (
              searchResults.length > 0 ? (
                <div className="space-y-8">
                  {selectedItem ? (
                    <div 
                      className="space-y-6 cursor-pointer" 
                      onClick={() => setSelectedItem(null)}
                    >
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="cursor-default space-y-6"
                      >
                        <div className="flex items-center justify-between bg-white px-8 py-4 rounded-3xl border border-slate-200 shadow-sm">
                          <p className="text-sm font-bold text-slate-500">
                            已在档案中定位到 {searchResults.length} 条记录，正在查阅：<span className="text-indigo-600 ml-1 underline decoration-indigo-600/30 underline-offset-4">{selectedItem.name}</span>
                          </p>
                          <button 
                            onClick={() => setSelectedItem(null)}
                            className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-indigo-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 transition-all"
                          >
                            {searchResults.length > 1 ? '返回卷轴' : '闭合档案'}
                          </button>
                        </div>
                        <ItemResultCard item={selectedItem} />
                      </div>
                      <div className="py-10 text-center text-slate-300 text-xs font-medium uppercase tracking-[0.2em]">
                        点击空白处收起详情
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-indigo-500 adventure-icon" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          匹配到 {searchResults.length} 个相关道具，请点击查看：
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchResults.map((item, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setSelectedItem(item)}
                            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-indigo-600 transition-all">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{item.name}</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.activity}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ITEM_DATABASE.map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      setSearchQuery(item.name);
                      setSearchResults([item]);
                      setSelectedItem(item);
                    }}
                    className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left group"
                  >
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-indigo-600 transition-all mb-6 border border-slate-200">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h4 className="text-xl font-black text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{item.name}</h4>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{item.activity}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                       {item.keywords.map(k => <span key={k} className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors border border-slate-200">#{k}</span>)}
                    </div>
                  </button>
                ))}
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
                      <div className="bg-slate-900 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest z-10 shadow-lg mb-2 border border-indigo-600/20">
                        {event.day}
                      </div>
                      <div className="w-4 h-4 rounded-full bg-slate-50 border-4 border-slate-900 z-10 shadow-sm" />
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
                              className="absolute top-4 right-4 p-2 bg-slate-900/5 hover:bg-slate-900 text-slate-400 hover:text-white rounded-xl opacity-0 group-hover/card:opacity-100 transition-all z-20"
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
  const isEmpty = content.trim().length === 0;
  const notFound = !isEmpty && isNotFound(content);

  return (
    <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900 px-10 py-8 text-white flex items-center justify-between border-b border-indigo-600/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">知识库直查档案</span>
          </div>
          <h3 className="text-3xl font-black tracking-tight text-slate-50">{query}</h3>
        </div>
        <div className="text-right">
          {isStreaming ? (
            <div className="flex items-center gap-2 text-slate-400">
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
          <div className="relative">
            <p className="text-sm font-medium text-slate-700 leading-loose whitespace-pre-line">
              {content}
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse ml-0.5 rounded-sm align-middle" />
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemResultCard({ item }: { item: ItemData }) {
  return (
    <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="bg-slate-900 px-10 py-8 text-white flex items-center justify-between border-b border-indigo-600/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block">AUTHENTIC ARCHIVE ACTIVE</span>
          </div>
          <h3 className="text-3xl font-black tracking-tight text-slate-50">{item.name}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">鉴定日期</p>
          <p className="text-sm font-black text-indigo-600">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Part 1: Detailed Profile */}
        <div className="p-10 border-r border-slate-100">
          <SectionHeader icon={<FileText className="w-5 h-5 text-indigo-600" />} title="第一部分：完整道具档案" />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mt-8">
            <DataField label="道具名称" value={item.name} />
            <DataField label="所属活动" value={item.activity || '暂无数据'} />
            <DataField label="登场天数" value={item.time || '暂无数据'} />
            <DataField label="评估单价" value={item.price || '暂无数据'} />
            <div className="col-span-full">
              <DataField label="道具深度点评" value={item.review || '暂无数据'} />
            </div>
            <div className="col-span-full">
              <DataField label="战力提升维度" value={item.boost || '暂无数据'} />
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> 各阶玩家购买方案评定
            </p>
            <div className="grid grid-cols-2 gap-4">
              <PlanBox tier="超R" content={item.planSuperR} color="bg-slate-50 text-slate-900 border border-slate-200" />
              <PlanBox tier="大R" content={item.planBigR} color="bg-slate-50 text-slate-900 border border-slate-200" />
              <PlanBox tier="中R" content={item.planMidR} color="bg-slate-50 text-slate-900 border border-slate-200" />
              <PlanBox tier="小R" content={item.planSmallR} color="bg-slate-50 text-slate-900 border border-slate-200" />
            </div>
          </div>
        </div>

        {/* Part 2: GS Recommendations */}
        <div className="p-10 bg-slate-50/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
             <Scroll className="w-64 h-64 rotate-12" />
          </div>
          <SectionHeader icon={<Sparkles className="w-5 h-5 text-indigo-600 adventure-icon" />} title="第二部分：GS 运营决策建议" />
          
          <div className="mt-8 space-y-8 relative z-10">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">核心适配分层</p>
              <p className="text-slate-800 font-bold leading-relaxed text-lg">{item.gsTier}</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">实战场景应用</p>
              <p className="text-slate-700 font-medium leading-relaxed">{item.gsApplication}</p>
            </div>

            <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl border border-indigo-600/30">
               <div className="flex items-center gap-2 mb-4">
                 <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                 <p className="text-xs font-black uppercase tracking-widest text-slate-400">GS 运营话术核心</p>
               </div>
               <p className="text-sm font-medium leading-relaxed text-slate-300">
                 此珍宝于 <span className="text-indigo-600">{item.time}</span> 降世。策略重点应聚焦于 <span className="text-white font-bold">{item.keywords.join('、')}</span> 带来的压制力。针对 <span className="text-white">{item.gsTier.split('/')[0]}</span> 阶层，建议从 <span className="text-indigo-600 underline underline-offset-4 decoration-indigo-600/30">{item.activity}</span> 的稀缺性切入引导。
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode, title: string }) {
  return (
    <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-900 w-fit">
      {icon}
      <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase">{title}</h4>
    </div>
  );
}

function DataField({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col gap-1 group">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">{label}</p>
      <p className={`text-sm font-bold leading-relaxed ${value === '暂无数据' ? 'text-slate-300 italic' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function PlanBox({ tier, content, color }: { tier: string, content: string, color: string }) {
  return (
    <div className={`p-4 rounded-2xl ${color} flex flex-col gap-2 hover:border-indigo-600/30 transition-colors duration-300`}>
      <div className="flex items-center gap-2">
        <div className="w-1 h-1 bg-indigo-600 rounded-full" />
        <span className="text-[10px] font-black opacity-60 uppercase tracking-tighter">{tier}阶购入评定</span>
      </div>
      <p className="text-xs font-black leading-snug">{content || '暂未收录方案'}</p>
    </div>
  );
}

function TabButton({ active, label, onClick, icon }: { active: boolean, label: string, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
        active 
          ? 'bg-slate-900 text-indigo-600 border border-indigo-600/30 shadow-xl shadow-slate-200' 
          : 'text-slate-400 hover:text-slate-900 hover:bg-white/50'
      }`}
    >
      <div className={active ? 'adventure-icon-active' : ''}>
        {icon}
      </div>
      {label}
    </button>
  );
}

