import React, { useState, useMemo, useEffect } from 'react';
import { Scroll, FileText, Search, Sparkles, ChevronRight, AlertTriangle, Package, Zap, Edit2, Check, X, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
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
    activity: '充值排行榜',
    time: '开服第1天起',
    price: '充值榜专属奖励',
    review: '全服顶级控制神器，PK场决定性装备，超R/大R必争之物。',
    boost: '攻击时一定几率使目标陷入麻痹状态，持续数秒无法行动，战场上拥有则掌握节奏。',
    planSuperR: '冲刺充值排行榜第一，全额拿到，开服前三天是关键窗口期。',
    planBigR: '保持充值排行前三，至少争取前五有概率获得，配合节点礼包补充战力差距。',
    planMidR: '无法直接竞争排行榜，建议主攻累计充值活动缓慢积累材料，等待返场机会。',
    planSmallR: '不建议为该道具专门氪金，等满月/百天庆典返场活动碰运气。',
    gsApplication: '行会混战、劫镖护镖、沙巴克攻城时，该戒指的控制效果直接决定战局走向，是引导大R竞争的核心话题点。',
    gsTier: '超R/大R最高优先级追求，拥有即为服内顶级战力标志。',
    keywords: ['控制', '麻痹', 'PK', '胜率', '戒指', '排行榜']
  },
  {
    name: '圣灵披风',
    activity: '特权返场 · 神技宝库',
    time: '开服第30天起周期返场',
    price: '1998元宝（单件）/ 礼包价格浮动',
    review: '顶级防御披风，前排坦克核心装备，大幅提升战场生存能力。',
    boost: '防御属性大幅提升，血量上限显著增加，使穿戴者在高强度对抗中更耐打。',
    planSuperR: '直接购买完整返场礼包，同步锁定附属套装加成，最大化性价比。',
    planBigR: '优先购买披风本体，配合日常活动补充其余套装件。',
    planMidR: '关注后续特价礼包，返场期间价格通常会有折扣窗口，把握时机。',
    planSmallR: '暂无推荐方案，该道具价位对小R不友好，建议关注低价防御类替代品。',
    gsApplication: '适合引导需要提升生存能力的前排玩家，尤其在资源争夺战（Boss点位/沙城外围）话术中重点推荐。',
    gsTier: '中R及以上必购，前排战士/法师职业优先，性价比高于同价位攻击类装备。',
    keywords: ['披风', '防御', '生存', '肉', '坦克', '血量', '圣灵']
  },
  {
    name: '屠龙刀',
    activity: '开服首充 / 战力排行榜',
    time: '开服第1天',
    price: '首充礼包 / 排行榜专属',
    review: '传奇服标志性武器，攻击力天花板，服内拥有者即为战力顶标。',
    boost: '攻击属性大幅领先同级武器，附带特殊光效，区服内具有极高的社交展示价值。',
    planSuperR: '开服首日冲刺充值排行第一，直接获取，是超R的身份标配。',
    planBigR: '竞争充值榜前三，或通过节点累充活动稳定推进获取进度。',
    planMidR: '参与各类副本和竞技活动积累材料，走分解合成路线，周期较长但可实现。',
    planSmallR: '专注日常任务爆材料，长线合成，不建议为此大额充值。',
    gsApplication: '区服最强攻击符号，是大R玩家最重要的社交资本，GS可在行会频道主动提及战力榜，刺激竞争欲望。',
    gsTier: '超R最高优先级，服内标杆性道具，影响整体战力格局。',
    keywords: ['屠龙', '屠龙刀', '武器', '攻击', '排行榜', '第一', '战力']
  },
  {
    name: '霸王神兽',
    activity: '神兽活动 / 坐骑礼包',
    time: '开服第7天起',
    price: '礼包价格浮动（598-1998元不等）',
    review: '顶级坐骑神兽，属性加成全面，视觉效果震撼，是区服内的稀有展示品。',
    boost: '骑乘速度、攻击、防御全属性加成，部分版本附带神兽技能（如召唤辅助攻击）。',
    planSuperR: '直接购买顶级神兽礼包，附带限定称号和专属技能，完整体验最优。',
    planBigR: '购买中级礼包获得基础版本，后续升级，控制单次消费但长期投入。',
    planMidR: '参与神兽碎片活动缓慢积累，等候免费/低价合成机会。',
    planSmallR: '关注开服签到、活跃任务中的神兽碎片奖励，主打免费路线。',
    gsApplication: '神兽在全服可见，视觉冲击力强，适合在大R玩家发布全服公告时配合推荐，营造氛围感。',
    gsTier: '大R以上优先追求，中R可选基础款，视觉展示价值高于战力价值。',
    keywords: ['神兽', '坐骑', '霸王', '宠物', '骑乘', '展示']
  },
  {
    name: '魔龙套装',
    activity: '副本挑战 / 限时打造活动',
    time: '开服第15天起',
    price: '材料可通过副本获取，打造费用约500-2000元宝',
    review: '中高端套装，属性均衡，适合中期过渡到后期核心战力的关键装备。',
    boost: '攻防属性均衡提升，穿戴套装后触发额外套装效果（攻击速度/暴击几率提升）。',
    planSuperR: '直接购买套装礼包一次性成型，省略材料收集阶段，快速建立战力优势。',
    planBigR: '购买核心套件+材料礼包，7天内完成套装，性价比最优路线。',
    planMidR: '日常副本刷材料，配合每日免费打造次数，约30天可完整获取。',
    planSmallR: '纯副本免费路线，耗时较长，建议优先完成高性价比单件。',
    gsApplication: '副本开放初期是推广时机，鼓励玩家组队参与，可引导行会统一目标，增强凝聚力同时带动消费。',
    gsTier: '全档玩家均可参与，中R以上建议走付费加速路线，小R适合纯免费慢慢打。',
    keywords: ['魔龙', '套装', '副本', '打造', '材料', '套装效果']
  },
  {
    name: '金翅大鹏',
    activity: '坐骑竞速 / 周年庆活动',
    time: '开服第30天或特殊活动期间',
    price: '活动期间礼包约1998-3998元',
    review: '传说级坐骑，速度属性冠绝全服，配合限定外观，社交展示价值极高。',
    boost: '移动速度提升30%以上，野外战场中具有追击和逃脱的决定性优势，部分版本附带飞行模式。',
    planSuperR: '活动首发直接购买完整礼包，拿到全服唯一或稀缺限定称号。',
    planBigR: '购买活动进度礼包，解锁坐骑本体，放弃限定附属增强件。',
    planMidR: '参与坐骑碎片活动慢慢积累，预计需2-3个活动周期才能合成。',
    planSmallR: '不建议为此消费，速度类坐骑对小R战力提升有限，性价比低。',
    gsApplication: '坐骑活动期间可在全服制造话题，大R玩家骑乘展示时GS及时配合吹捧，刺激其他玩家跟进消费。',
    gsTier: '超R/大R的展示性消费，对实战有加成但非必须，社交价值是核心卖点。',
    keywords: ['金翅', '大鹏', '坐骑', '速度', '飞行', '追击', '限定']
  },
  {
    name: '玄冥铠甲',
    activity: '锻造大赛 / 充值累计活动',
    time: '开服第20天起',
    price: '锻造材料礼包约1298元 / 散件购买',
    review: '顶级防御铠甲，同级护甲中防御上限最高，是重甲职业的核心竞争力来源。',
    boost: '物理防御和魔法防御双维度大幅提升，穿戴后在PvP中承伤比例明显降低。',
    planSuperR: '一次性购买完整锻造礼包，直接成型，不参与材料竞争。',
    planBigR: '分批购买核心材料，配合日常锻造积分，约14天内完成。',
    planMidR: '锻造大赛期间集中冲刺，利用积分奖励抵消部分消费。',
    planSmallR: '锻造积分日常任务慢慢推进，免费路线约需45天。',
    gsApplication: '适合在服内爆发较多PK纠纷时作为推荐话题，引导受伤玩家提升防御解决痛点，从负面情绪转化为消费动力。',
    gsTier: '中R以上战士/法师优先，是后期防御体系的核心。',
    keywords: ['玄冥', '铠甲', '防御', '重甲', '护甲', '锻造', '物防', '魔防']
  },
  {
    name: '神龙祝福',
    activity: '节日庆典 / 神龙召唤活动',
    time: '开服特定节点（如满月/百天）',
    price: '活动专属，礼包约698-1998元',
    review: '全服BUFF类道具，开启后为全服玩家提供属性加成，超R用于刷存在感的利器。',
    boost: '激活后触发全服广播，同时为全服在线玩家提供一定时间的属性加成（经验/掉宝率/攻击加成）。',
    planSuperR: '节日期间主动激活，借助全服广播刷存在感，维持服内影响力，消费本身就是目的。',
    planBigR: '可选择性购买，主要看该节点有无竞争大R，避免被比下去。',
    planMidR: '不建议主动购买，坐享超R/大R激活的BUFF收益即可。',
    planSmallR: '免费享受全服BUFF，合理利用加成时段刷副本/爆宝。',
    gsApplication: '激活时GS应立即在频道配合渲染氛围（"xxx太豪了！"/"大家快抓住BUFF时间刷副本！"），让激活者获得充分的正向反馈，巩固大R的消费意愿。',
    gsTier: '超R专属体验，社交货币价值远大于战力价值，是维系顶级玩家荣誉感的工具。',
    keywords: ['神龙', '祝福', 'BUFF', '全服', '广播', '节日', '加成', '经验']
  },
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
      logUsage('calendar_edit', `Updated calendar day ${id}`);
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
      const cozeHit = result && result !== '未找到数据' && !result.includes('暂时不可用');
      if (localResults.length > 0 || cozeHit) {
        logUsage('kb_search_hit', searchQuery);
      } else {
        logUsage('kb_search_miss', searchQuery);
      }
    } catch (err) {
      setCozeResult('检索服务暂时不可用，请稍后重试');
      if (localResults.length === 0) {
        logUsage('kb_search_miss', searchQuery);
      } else {
        logUsage('kb_search_hit', searchQuery);
      }
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
    </div>
  );
}

function ItemResultCard({ item }: { item: ItemData }) {
  const [kbRating, setKbRating] = useState<'yes' | 'no' | null>(null);

  const rateKbItem = (rating: 'yes' | 'no') => {
    if (kbRating) return;
    setKbRating(rating);
    logUsage('kb_item_rating', JSON.stringify({ itemName: item.name, rating }));
  };

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

      <div className="p-10">
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

