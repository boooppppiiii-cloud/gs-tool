/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Shield,
  Menu,
  X as CloseIcon,
  Zap,
  Hammer,
  Sword,
  Scroll,
  Settings,
  LogOut,
  ChevronRight,
  Crown,
  PlayCircle,
  AlertTriangle as AlertTriangleIcon,
  LayoutGrid
} from 'lucide-react';
import ServerConfig from './components/ServerConfig';
import ExcelUpload from './components/ExcelUpload';
import AnalysisReport from './components/AnalysisReport';
import HistoryView from './components/HistoryView';
import CaseGallery from './components/CaseGallery';
import HomeView from './components/HomeView';
import KnowledgeBase from './components/KnowledgeBase';
import ProfileView from './components/ProfileView';
import Login from './components/Login';
import AdminPortal from './components/AdminPortal';
import PortalSelector from './components/PortalSelector';
import LeaderPortal from './components/LeaderPortal';
import { ServerProfile, ChatRecord, RechargeRecord, AnalysisResult, MonthHistory, HistoryRecord, AnalysisCase, User, ExecutionRecord, LeaderReview, CrawlerChatRecord } from './types';
import { analyzeGameEcology } from './lib/gemini';

import { auth } from './lib/firebase';
import * as dataService from './lib/dataService';
import { syncFromCloud } from './lib/dataService';
import { logUsage, initAnalyticsUser, setAnalyticsGroup } from './services/analyticsService';

const ADMIN_EMAIL = '1463432441@qq.com';

type TabId = 'home' | 'server' | 'analysis' | 'gallery' | 'knowledge' | 'profile';
type NavItem = { id: TabId; label: string; icon: React.ReactElement; children?: { id: string; label: string }[] };

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: '首页', icon: <Zap className="w-5 h-5" /> },
  { id: 'server', label: '区服配置', icon: <Hammer className="w-5 h-5" /> },
  {
    id: 'analysis', label: '专家分析', icon: <Sword className="w-5 h-5" />,
    children: [{ id: 'current', label: '实时分析' }, { id: 'history', label: '历史存档' }]
  },
  { id: 'gallery', label: '优秀案例库', icon: <Crown className="w-5 h-5" /> },
  {
    id: 'knowledge', label: '游戏知识库', icon: <Scroll className="w-5 h-5" />,
    children: [{ id: 'items', label: '道具数据库' }, { id: 'calendar', label: '维护日历' }]
  },
  { id: 'profile', label: '个人中心', icon: <Shield className="w-5 h-5" /> },
];

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [activeTab, setActiveTab] = React.useState<'home' | 'server' | 'analysis' | 'gallery' | 'knowledge' | 'profile'>('home');
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  React.useEffect(() => {
    if (user) {
      logUsage('tab_switch', `Switched to ${activeTab}`);
    }
  }, [activeTab, user]);

  const isAdmin = user?.username === ADMIN_EMAIL || user?.email === ADMIN_EMAIL;

  const [serverProfiles, setServerProfiles] = React.useState<ServerProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = React.useState<string | null>(null);

  const [chatData, setChatData] = React.useState<ChatRecord[]>([]);
  const [rechargeData, setRechargeData] = React.useState<RechargeRecord[]>([]);
  const [analysisResult, setAnalysisResult] = React.useState<AnalysisResult | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = React.useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const [analysisSubTab, setAnalysisSubTab] = React.useState<'current' | 'history'>('current');
  const [galleryFilter, setGalleryFilter] = React.useState<'online' | 'my'>('online');
  const [knowledgeTab, setKnowledgeTab] = React.useState<'items' | 'calendar'>('items');
  const [history, setHistory] = React.useState<MonthHistory[]>([]);
  const [cases, setCases] = React.useState<AnalysisCase[]>([]);
  const [executionRecords, setExecutionRecords] = React.useState<ExecutionRecord[]>([]);
  const [dismissedOutbursts, setDismissedOutbursts] = React.useState<{ historyRecordId: string; outburstIndex: number }[]>([]);
  const [leaderReviews, setLeaderReviews] = React.useState<LeaderReview[]>([]);
  const [crawlerChatLogs, setCrawlerChatLogs] = React.useState<CrawlerChatRecord[]>([]);
  const [activePortal, setActivePortal] = React.useState<'admin' | 'leader' | 'member' | null>(null);
  const [displayName, setDisplayName] = React.useState<string>('');

  const [crawlerStatus, setCrawlerStatus] = React.useState<{ chat: string; recharge: string }>({ chat: 'ok', recharge: 'ok' });
  const [authingBackend, setAuthingBackend] = React.useState<string | null>(null);
  const [isCollecting, setIsCollecting] = React.useState(false);
  const [collectMsg, setCollectMsg] = React.useState<string | null>(null);
  const [crawlServerName, setCrawlServerName] = React.useState<string>('');
  const [crawlLog, setCrawlLog] = React.useState<string | null>(null);
  const [showCrawlLog, setShowCrawlLog] = React.useState(false);
  const [authLog, setAuthLog] = React.useState<string | null>(null);
  const [showAuthLogFor, setShowAuthLogFor] = React.useState<string | null>(null);
  const [focusedOutburstIndex, setFocusedOutburstIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    const check = () => fetch('/api/crawler/session-status').then(r => r.json()).then(setCrawlerStatus).catch(() => {});
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, []);

  const triggerAuth = async (b: 'chat' | 'recharge') => {
    setAuthingBackend(b);
    setShowAuthLogFor(b);
    setAuthLog('正在启动认证进程...');
    await fetch(`/api/crawler/auth/${b}`, { method: 'POST' });
    // Poll every 5s: refresh session status + auth log until restored
    const poll = setInterval(async () => {
      try {
        const [status, logRes] = await Promise.all([
          fetch('/api/crawler/session-status').then(r => r.json()) as Promise<{ chat: string; recharge: string }>,
          fetch(`/api/crawler/auth-log/${b}`).then(r => r.json()).catch(() => ({ log: '' })),
        ]);
        setCrawlerStatus(status);
        if (logRes.log) setAuthLog(logRes.log);
        if (status[b] === 'ok') { clearInterval(poll); setAuthingBackend(null); }
      } catch {}
    }, 5000);
    setTimeout(() => { clearInterval(poll); setAuthingBackend(null); }, 300_000);
  };

  const triggerCollect = async () => {
    if (!crawlServerName) { setCollectMsg('请先选择要爬取的区服'); return; }
    setIsCollecting(true);
    setCollectMsg(null);
    try {
      await fetch('/api/crawler/collect-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverName: crawlServerName, ownerId: user?.id ?? '' }),
      });
      setCollectMsg(`已启动 ${crawlServerName} 区服爬取，结果将在几分钟后写入云端`);
    } catch {
      setCollectMsg('启动失败，请检查服务器');
    }
    setTimeout(() => { setIsCollecting(false); setCollectMsg(null); }, 8000);
  };

  const handleAnalyzeFromCrawl = async (log: import('./types').CrawlerChatRecord) => {
    try {
      const res = await fetch('/api/db/getDoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'chat_csv_files', id: log.csvFileId }),
      });
      const { data } = await res.json();
      if (!data?.content) {
        setCollectMsg('未找到 CSV 数据，请重新爬取');
        setTimeout(() => setCollectMsg(null), 4000);
        return;
      }
      const lines = (data.content as string).split(/\r?\n/).filter((l: string) => l.trim());
      const chatRecords: ChatRecord[] = lines.slice(1).map((line: string) => {
        const cols = line.split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''));
        return { time: cols[2] ?? '', roleName: cols[3] ?? '', type: cols[4] ?? '', content: cols[5] ?? '', target: cols[7] ?? '' };
      }).filter((r: ChatRecord) => r.roleName && r.content);
      setChatData(chatRecords);
      setRechargeData([]);
      setAnalysisResult(null);
      setAnalysisSubTab('current');
    } catch {
      setCollectMsg('加载数据失败，请重试');
      setTimeout(() => setCollectMsg(null), 4000);
    }
  };

  const PRESET_GROUPS = ['杭州三组', '杭州五组', '杭州对抗组', '山东一组', '山东对抗组', '山东对抗二组', '山东二组', '山东九组', '山东三组'];
  const [memberGroup, setMemberGroup] = React.useState<string>(PRESET_GROUPS[0]);
  React.useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`member_group_${user.id}`);
      const group = saved && PRESET_GROUPS.includes(saved) ? saved : PRESET_GROUPS[0];
      setMemberGroup(group);
      setAnalyticsGroup(group);
      // Ensure all existing records are tagged and synced to cloud on login
      dataService.setMemberGroupAndTagRecords(user.id, group, displayName || user.username);
    }
  }, [user?.id]);
  const handleGroupChange = (g: string) => {
    if (!user) return;
    setMemberGroup(g);
    setAnalyticsGroup(g);
    localStorage.setItem(`member_group_${user.id}`, g);
    // Retag all records with new group and push to cloud
    dataService.setMemberGroupAndTagRecords(user.id, g, displayName || user.username);
  };
  const handleDisplayNameChange = (name: string) => {
    if (!user) return;
    setDisplayName(name);
    localStorage.setItem(`member_display_name_${user.id}`, name);
  };

  // Re-publish user profile when display name is confirmed or portal switches to member
  React.useEffect(() => {
    if (user && displayName && activePortal === 'member') {
      dataService.setMemberGroupAndTagRecords(user.id, memberGroup, displayName);
    }
  }, [displayName, user?.id, activePortal]);

  React.useEffect(() => {
    dataService.testConnection();
    auth.getLoginState().then(state => {
      if (state?.user) {
        const cbUser = state.user as any;
        const uid = cbUser.uid || cbUser.openId || '';
        const username = cbUser.nickName || cbUser.email?.split('@')[0] || 'Unknown';
        dataService.setCurrentUser(uid);
        initAnalyticsUser(uid, username);
        setUser({ id: uid, username, email: cbUser.email || undefined });
        setDisplayName(localStorage.getItem(`member_display_name_${uid}`) || username);
        const saved = localStorage.getItem('portal_preference') as 'admin' | 'leader' | 'member' | null;
        setActivePortal(saved ?? null);
      }
    });
    const unsubscribe = auth.onLoginStateChanged((state: any) => {
      if (state?.user) {
        const cbUser = state.user as any;
        const uid = cbUser.uid || cbUser.openId || '';
        const username = cbUser.nickName || cbUser.email?.split('@')[0] || 'Unknown';
        dataService.setCurrentUser(uid);
        initAnalyticsUser(uid, username);
        setUser({ id: uid, username, email: cbUser.email || undefined });
        setDisplayName(localStorage.getItem(`member_display_name_${uid}`) || username);
        const saved = localStorage.getItem('portal_preference') as 'admin' | 'leader' | 'member' | null;
        setActivePortal(saved ?? null);
      } else {
        dataService.setCurrentUser(null);
        setUser(null);
        setDisplayName('');
        setActivePortal(null);
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  React.useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  React.useEffect(() => {
    if (analysisSubTab === 'history' && user) {
      dataService.fetchCrawlerChatLogs(user.id).then(logs => setCrawlerChatLogs(logs));
    }
  }, [analysisSubTab, user?.id]);

  const loadUserData = async () => {
    if (!user) return;
    try {
      await syncFromCloud(user.id);
      const [profiles, historyData, casesData, execData, dismissed, reviewsData, crawlerLogs] = await Promise.all([
        dataService.fetchServerProfiles(user.id),
        dataService.fetchHistory(user.id),
        dataService.fetchCases(user.id),
        dataService.fetchExecutionRecords(user.id),
        dataService.fetchDismissedOutbursts(),
        dataService.fetchLeaderReviewsForUser(user.id),
        dataService.fetchCrawlerChatLogs(user.id),
      ]);
      setServerProfiles(profiles);
      setHistory(historyData);
      setCases(casesData);
      setExecutionRecords(execData);
      setDismissedOutbursts(dismissed);
      setLeaderReviews(reviewsData);
      setCrawlerChatLogs(crawlerLogs);
    } catch (err) {
      console.error('Failed to load user data', err);
    }
  };

  const handleUpdateProfiles = async (newProfiles: ServerProfile[]) => {
    setServerProfiles(newProfiles);
    // Persist individually or in batch. For simplicity, we persist the active one or all?
    // Usually ServerConfig handles editing.
  };

  const handleDataLoaded = (chat: ChatRecord[], recharge: RechargeRecord[], fileName: string) => {
    setChatData(chat);
    setRechargeData(recharge);
    setAnalysisResult(null);

    const matchedProfile = serverProfiles.find(p => 
      fileName.toLowerCase().includes(p.name.toLowerCase()) || 
      p.name.toLowerCase().includes(fileName.toLowerCase())
    );
    if (matchedProfile) {
      setActiveProfileId(matchedProfile.id);
    }
  };

  const buildHistoricalContext = (serverId: string): string => {
    const serverRecords = history
      .flatMap(m => m.records)
      .filter(r => (r.serverConfig as any)?.id === serverId)
      .slice(0, 2);
    if (serverRecords.length === 0) return '';
    return serverRecords.map(r => {
      const reports = r.result?.playerReports ?? [];
      return reports.map(p => {
        const outburstSummaries = (p.negativeOutbursts ?? []).map((o: any) =>
          `  - [${o.trigger}] 关键片段：${(o.context ?? []).slice(0, 3).map((c: any) => `${c.roleName}:${c.content}`).join('；')}`
        ).join('\n');
        return `玩家${p.roleName}（历史画像：${p.portrait?.summary ?? ''}）\n历史负面事件：\n${outburstSummaries || '  无'}`;
      }).join('\n');
    }).join('\n\n---\n\n');
  };

  const startAnalysis = async () => {
    const activeProfile = serverProfiles.find(p => p.id === activeProfileId);
    if (!activeProfile) {
      setError('请先选择或配置一个区服配置');
      setActiveTab('server');
      return;
    }

    if (chatData.length === 0) {
      setError('请先上传包含聊天记录的 Excel 文件');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    logUsage('analysis_start', `Analyzing ${activeProfile.name}`, undefined, undefined, undefined, {
      uploadedChatRows: chatData.length,
      uploadedRechargeRows: rechargeData.length,
    });
    const _analysisStartTime = Date.now();

    try {
      const gsPersonaStr = activeProfile.gsPersona ? 
        `GS人设: [角色名:${activeProfile.gsName || '未设置'}, 年龄:${activeProfile.gsPersona.age || '未知'}, 家乡:${activeProfile.gsPersona.hometown || '未知'}, 职业:${activeProfile.gsPersona.occupation || '未知'}, 家庭:${activeProfile.gsPersona.family || '未知'}, 生活作息:${activeProfile.gsPersona.lifestyle || '未知'}, 其他:${activeProfile.gsPersona.others || '无'}]` 
        : 'GS人设: 未提供';
      
      const ecologyStr = activeProfile.serverEcology ? `区服生态总结: ${activeProfile.serverEcology}` : '区服生态总结: 未提供';
      
      const serverContextStr = `区服: ${activeProfile.name}, 开服日期: ${activeProfile.openingDate}. \n${gsPersonaStr} \n${ecologyStr}`;
      
      const persistentPortraitsStr = activeProfile.persistentPortraits ? 
        Object.entries(activeProfile.persistentPortraits).map(([name, p]) => {
          const portrait = p as any;
          return `玩家[${name}]: ${portrait.summary} (付费习惯:${portrait.paymentHabits}, 性格:${portrait.personality}, 游戏习惯:${portrait.gameHabits}, 现实人设:${portrait.realLifePersona})`;
        }).join('\n') : '';

      const chatSample = chatData.slice(-1000).map(r => 
        `[${r.time}] ${r.roleName}(${r.type}): ${r.content} ${r.target ? `-> ${r.target}` : ''}`
      ).join('\n');
      const rechargeSample = rechargeData.map(r => 
        `${r.roleName}: ${r.amount} (${r.status}, ${r.method})`
      ).join('\n');

      const refCases = cases.slice(0, 10);
      const historicalCtx = buildHistoricalContext(activeProfile.id);
      logUsage('analysis_with_cases', `引用案例数: ${refCases.length}`, undefined, undefined, refCases.length);
      const result = await analyzeGameEcology(serverContextStr, chatSample, rechargeSample, refCases, persistentPortraitsStr, historicalCtx);
      setAnalysisResult(result);
      setCurrentHistoryId(null);
      const negativeCount = result.playerReports?.reduce((sum, r) => sum + (r.negativeOutbursts?.length || 0), 0) ?? 0;
      const keyPlayerCount = result.identifiedKeyPlayers?.length ?? 0;
      logUsage('analysis_complete', `${activeProfile.name} 分析完成`, chatData.length, negativeCount, keyPlayerCount, {
        inputTokens: result._usage?.inputTokens,
        outputTokens: result._usage?.outputTokens,
        apiLatencyMs: Date.now() - _analysisStartTime,
        uploadedChatRows: chatData.length,
        uploadedRechargeRows: rechargeData.length,
      });

      // Update persistent portraits and ecology
      let updatedProfile: ServerProfile | null = null;
      const updatedProfiles = serverProfiles.map(p => {
        if (p.id === activeProfile.id) {
          const newPortraits = { ...(p.persistentPortraits || {}) };
          result.playerReports.forEach(report => {
            newPortraits[report.roleName] = {
              ...report.portrait,
              lastUpdated: new Date().toISOString()
            };
          });
          updatedProfile = { 
            ...p, 
            persistentPortraits: newPortraits,
            serverEcology: result.serverEcology 
          };
          return updatedProfile;
        }
        return p;
      });
      setServerProfiles(updatedProfiles);
      
      if (updatedProfile) {
        await dataService.saveServerProfile(updatedProfile);
      }

      if (user && activeProfile) {
        await dataService.saveAnalysisRecord(activeProfile, result);
        await loadUserData();
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || '分析过程中发生错误，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateCase = async (id: string, updates: Partial<AnalysisCase>) => {
    try {
      await dataService.updateCase(id, updates);
      loadUserData();
    } catch (err) {
      console.error('Update case error', err);
    }
  };

  const handleDeleteCase = async (id: string) => {
    try {
      await dataService.deleteCase(id);
      logUsage('delete_case', `Deleted case ${id}`);
      loadUserData();
    } catch (err) {
      console.error('Delete case error', err);
    }
  };

  const handleVote = async (id: string) => {
    try {
      if (!user) return;
      await dataService.voteOnCase(id, user.id);
      logUsage('case_vote', `Voted on case ${id}`);
      await loadUserData();
    } catch (err) {
      console.error('Vote error', err);
    }
  };

  const handleViewCase = async (id: string) => {
    try {
      await dataService.incrementCaseView(id);
      logUsage('case_view', `Viewed case ${id}`);
      loadUserData();
    } catch (err) {
      console.error('View error', err);
    }
  };

  const handleSelectHistory = (record: HistoryRecord) => {
    setAnalysisResult(record.result);
    setCurrentHistoryId(record.id);
    setAnalysisSubTab('current');
    setActiveTab('analysis');
  };

  const handleDeleteHistory = async (_month: string, id: string) => {
    try {
      await dataService.deleteHistoryRecord(id);
      logUsage('delete_history', `Deleted history ${id}`);
      // If the deleted record is the one currently being viewed, clear it
      if (currentHistoryId === id) {
        setAnalysisResult(null);
        setCurrentHistoryId(null);
      }
      await loadUserData();
    } catch (err) {
      console.error('Delete history error', err);
    }
  };


  const pendingContinueCount = React.useMemo(() => {
    return leaderReviews.filter(r => {
      if (r.decision !== '继续推进') return false;
      const reviewed = executionRecords.find(e => e.id === r.executionRecordId);
      if (!reviewed) return false;
      return !executionRecords.some(e =>
        e.historyRecordId === reviewed.historyRecordId &&
        e.outburstIndex === reviewed.outburstIndex &&
        e.createdAt > reviewed.createdAt
      );
    }).length;
  }, [leaderReviews, executionRecords]);

  const getSubTab = (parentId: string) => {
    if (parentId === 'analysis') return analysisSubTab;
    if (parentId === 'knowledge') return knowledgeTab;
    return null;
  };

  const setSubTab = (parentId: string, childId: string) => {
    if (parentId === 'analysis') setAnalysisSubTab(childId as 'current' | 'history');
    if (parentId === 'knowledge') setKnowledgeTab(childId as 'items' | 'calendar');
  };

  const handleTicketClick = (historyRecordId: string, outburstIndex: number) => {
    const record = history.flatMap(m => m.records).find(r => r.id === historyRecordId);
    if (record) {
      setAnalysisResult(record.result);
      setCurrentHistoryId(record.id);
      setAnalysisSubTab('current');
      setActiveTab('analysis');
      setFocusedOutburstIndex(outburstIndex);
    }
  };

  const handleSelectPortal = (portal: 'admin' | 'leader' | 'member') => {
    localStorage.setItem('portal_preference', portal);
    setActivePortal(portal);
  };

  const handleSwitchPortal = () => setActivePortal(null);

  const handleLogout = () => {
    auth.signOut();
    setUser(null);
    setActivePortal(null);
  };

  if (!user) {
    return <Login onLogin={(u) => {
      dataService.setCurrentUser(u.id);
      initAnalyticsUser(u.id, u.username);
      setUser(u);
      logUsage('login', `User ${u.username} logged in`);
    }} />;
  }

  if (!activePortal) {
    return <PortalSelector user={user} isAdmin={isAdmin} onSelect={handleSelectPortal} />;
  }

  if (activePortal === 'admin') {
    if (!isAdmin) {
      setActivePortal(null);
      return null;
    }
    return <AdminPortal user={user} onSwitchPortal={handleSwitchPortal} onLogout={handleLogout} />;
  }

  if (activePortal === 'leader') {
    return <LeaderPortal user={user} onSwitchPortal={handleSwitchPortal} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-white flex font-sans text-slate-800">
      {/* GM 后台登录过期全局提醒 */}
      {(crawlerStatus.chat === 'expired' || crawlerStatus.recharge === 'expired') && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white text-sm font-bold py-2.5 px-6 flex items-center gap-3 shadow-lg">
          <AlertTriangleIcon className="w-4 h-4 shrink-0" />
          <span>GM 后台登录已过期：{[crawlerStatus.chat === 'expired' ? '聊天后台' : null, crawlerStatus.recharge === 'expired' ? '充值后台' : null].filter(Boolean).join('、')} — 请前往「专家分析 → 实时分析」重新认证</span>
          <button
            onClick={() => { setActiveTab('analysis'); setAnalysisSubTab('current'); setAnalysisResult(null); }}
            className="ml-auto px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-black transition-colors whitespace-nowrap"
          >
            立即前往
          </button>
        </div>
      )}
      {/* Sidebar Navigation */}
      <aside
        className={`bg-white flex flex-col transition-[width] duration-200 z-50 sticky top-0 h-screen border-r border-slate-200 ${
          isSidebarOpen ? 'w-60' : 'w-[72px]'
        }`}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center justify-between overflow-hidden border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-indigo-600" />
            </div>
            {isSidebarOpen && (
              <span className="font-black text-base tracking-tight whitespace-nowrap text-slate-800 leading-none">
                傲世传奇专家
              </span>
            )}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 hover:bg-slate-100 rounded-lg flex transition-colors shrink-0"
          >
            {isSidebarOpen ? <CloseIcon className="w-4 h-4 text-slate-400" /> : <Menu className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        {/* 组员工作台信息 */}
        {isSidebarOpen && (
          <div className="px-4 py-3 border-b border-slate-100 bg-amber-50/40 space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">组员工作台</p>
            <p className="text-xs font-bold text-slate-700 truncate">{displayName || user.username}</p>
            <p className="text-xs text-indigo-600 font-semibold">{memberGroup}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <React.Fragment key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors relative group ${
                  activeTab === item.id
                    ? 'bg-amber-50 text-indigo-600 border border-amber-200/80'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                } ${!isSidebarOpen && 'justify-center'}`}
              >
                <div className={`shrink-0 transition-colors ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'}`}>
                  {item.icon}
                </div>
                {isSidebarOpen && (
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    {item.label}
                    {item.id === 'analysis' && pendingContinueCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-full leading-none">
                        {pendingContinueCount}
                      </span>
                    )}
                  </span>
                )}
                {!isSidebarOpen && (
                  <div className="absolute left-full ml-2 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg z-50">
                    {item.label}
                  </div>
                )}
                {activeTab === item.id && isSidebarOpen && (
                  <div className="absolute right-0 w-0.5 h-5 bg-indigo-600 rounded-l-full" />
                )}
              </button>
              {isSidebarOpen && activeTab === item.id && item.children && (
                <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l-2 border-amber-200 pl-3">
                  {item.children.map((child) => {
                    const isChildActive = getSubTab(item.id) === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => setSubTab(item.id, child.id)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                          isChildActive
                            ? 'bg-amber-50 text-indigo-600'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-1 h-1 rounded-full shrink-0 ${isChildActive ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-slate-100 space-y-0.5">
          <button
            onClick={handleSwitchPortal}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-amber-50 hover:text-indigo-600 transition-colors ${!isSidebarOpen && 'justify-center'}`}
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
            {isSidebarOpen && <span className="text-sm font-semibold">切换端口</span>}
          </button>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors ${!isSidebarOpen && 'justify-center'}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {isSidebarOpen && <span className="text-sm font-semibold">退出登录</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="px-8 py-4 sticky top-0 bg-white/95 backdrop-blur-sm z-40 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
            <span>{NAV_ITEMS.find(i => i.id === activeTab)?.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800 leading-none">{displayName || user.username}</p>
            </div>
            <div className="w-9 h-9 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-indigo-600 font-black text-sm">
              {(displayName || user.username)[0].toUpperCase()}
            </div>
          </div>
        </header>

        <div className="px-8 pb-12 pt-8 overflow-y-auto flex-1">
           {activeTab === 'home' && <HomeView serverProfiles={serverProfiles} history={history} cases={cases} executionRecords={executionRecords} dismissedOutbursts={dismissedOutbursts} onTicketClick={handleTicketClick} />}
           
           {activeTab === 'server' && (
             <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-5 duration-500">
                <ServerConfig 
                  profiles={serverProfiles} 
                  activeProfileId={activeProfileId}
                  onProfilesChange={setServerProfiles}
                  onSelectProfile={setActiveProfileId}
                  onSaveProfile={dataService.saveServerProfile}
                  onDeleteProfile={dataService.deleteServerProfile}
                  onUpdateProfile={dataService.updateServerProfile}
                />
             </div>
           )}

           {activeTab === 'analysis' && (
             <div className="space-y-8 animate-in fade-in duration-500">
               {analysisSubTab === 'history' ? (
                 <HistoryView history={history} crawlerChatLogs={crawlerChatLogs} onSelect={handleSelectHistory} onDelete={handleDeleteHistory} onAnalyze={handleAnalyzeFromCrawl} />
               ) : (
                 <div className="space-y-8">
                   {!analysisResult ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <ExcelUpload onDataLoaded={handleDataLoaded} isAnalyzing={isAnalyzing} crawlerLogs={crawlerChatLogs} />
                        <div className="space-y-6">
                           <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-3">
                              <h4 className="text-base font-black text-slate-800">GM 后台认证</h4>
                              <div className="space-y-2">
                                {(['chat', 'recharge'] as const).map(b => {
                                  const expired = crawlerStatus[b] === 'expired';
                                  const label = b === 'chat' ? '聊天后台' : '充值后台';
                                  return (
                                    <div key={b} className="space-y-1">
                                      <div className={`flex items-center justify-between p-3 rounded-2xl border ${expired ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                                        <span className={`text-sm font-bold flex items-center gap-2 ${expired ? 'text-amber-700' : 'text-slate-600'}`}>
                                          {expired
                                            ? <AlertTriangleIcon className="w-4 h-4" />
                                            : <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />}
                                          {label}
                                          {expired && <span className="text-xs font-bold text-amber-600">已过期</span>}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => triggerAuth(b)}
                                            disabled={authingBackend === b}
                                            className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 ${expired ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                                            {authingBackend === b ? '启动中...' : '重新认证'}
                                          </button>
                                          {showAuthLogFor === b && (
                                            <button
                                              onClick={() => setShowAuthLogFor(showAuthLogFor === b ? null : b)}
                                              className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                                              {showAuthLogFor === b ? '收起' : '日志'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      {showAuthLogFor === b && authLog && (
                                        <pre className="text-[10px] text-slate-500 bg-slate-50 rounded-xl p-3 max-h-32 overflow-auto whitespace-pre-wrap break-all border border-slate-100">
                                          {authLog}
                                        </pre>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="border-t border-slate-100 pt-3 space-y-2">
                                {(() => {
                                  const crawlableServers = serverProfiles.filter(p => /^\d{5}$/.test(p.name));
                                  return (
                                    <>
                                      <select
                                        value={crawlServerName}
                                        onChange={e => setCrawlServerName(e.target.value)}
                                        className="w-full px-3 py-2 text-sm font-bold border border-slate-200 rounded-2xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                      >
                                        <option value="">— 选择爬取区服 —</option>
                                        {crawlableServers.map(p => (
                                          <option key={p.id} value={p.name}>{p.name}</option>
                                        ))}
                                      </select>
                                      {crawlableServers.length === 0 && (
                                        <p className="text-[10px] text-amber-600 font-bold text-center">请先在「区服配置」中添加有效区服（五位数字）</p>
                                      )}
                                      <button
                                        onClick={triggerCollect}
                                        disabled={isCollecting || !crawlServerName}
                                        className="w-full py-2 text-sm font-bold bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 disabled:opacity-50 transition-colors">
                                        {isCollecting ? '爬取进行中...' : '立即爬取（过去10小时）'}
                                      </button>
                                      <button
                                        onClick={async () => {
                                          const r = await fetch('/api/crawler/last-log');
                                          const { log } = await r.json();
                                          setCrawlLog(log);
                                          setShowCrawlLog(v => !v);
                                        }}
                                        className="w-full py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                                        {showCrawlLog ? '收起运行日志' : '查看上次运行日志'}
                                      </button>
                                      {showCrawlLog && crawlLog && (
                                        <pre className="text-[10px] text-slate-500 bg-slate-50 rounded-xl p-3 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                                          {crawlLog}
                                        </pre>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                   <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
                              <h4 className="text-xl font-black text-slate-800">就绪检查</h4>
                              <p className="text-sm text-slate-500 font-medium">在开始深度神经网络分析前，请确保数据源完整。</p>
                              <div className="space-y-3">
                                 <StatusCheck label="已选择分析区服" checked={!!activeProfileId} />
                                 <StatusCheck label="聊天原始记录已提取" checked={chatData.length > 0} />
                                 <StatusCheck label="充值聚合数据已上传" checked={rechargeData.length > 0} />
                              </div>
                              <button
                                onClick={startAnalysis}
                                disabled={!activeProfileId || chatData.length === 0 || isAnalyzing}
                                className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 disabled:hover:translate-y-0 hover:-translate-y-0.5 transition-[background-color,transform] flex items-center justify-center gap-3 group"
                              >
                                {isAnalyzing ? (
                                  <span>大数据模型正在深度演算...</span>
                                ) : (
                                  <span className="flex items-center justify-center gap-3">
                                    <PlayCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                    执行专家全量分析
                                  </span>
                                )}
                              </button>
                           </div>
                           {error && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold">
                              <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                              {error}
                            </div>
                           )}
                        </div>
                     </div>
                   ) : (
                     <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex items-center justify-between">
                           <h2 className="text-3xl font-black text-slate-900 tracking-tight">分析报告已生成</h2>
                           <button onClick={() => { setAnalysisResult(null); setChatData([]); setRechargeData([]); setError(null); setFocusedOutburstIndex(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors">重新分析</button>
                        </div>
                                                 <AnalysisReport
                                   result={analysisResult}
                                   executionRecords={executionRecords}
                                   currentHistoryId={currentHistoryId}
                                   leaderReviews={leaderReviews}
                                   serverName={serverProfiles.find(p => p.id === activeProfileId)?.name}
                                   gsName={serverProfiles.find(p => p.id === activeProfileId)?.gsName}
                                   focusedOutburstIndex={focusedOutburstIndex}
                                   onClearFocus={() => setFocusedOutburstIndex(null)}
                                   onSaveRecords={async (records) => {
                                     for (const rec of records) {
                                       await dataService.saveExecutionRecord({ ...rec, ownerId: user?.id ?? '' });
                                     }
                                     logUsage('ticket_created', `创建工单 ${records.length} 条`);
                                     await loadUserData();
                                   }}
                                   onUpdatePortrait={(roleName, updates) => {
                                     const activeProfile = serverProfiles.find(p => p.id === activeProfileId);
                                     if (!activeProfile) return;
                                     const existing = activeProfile.persistentPortraits?.[roleName] ?? {} as any;
                                     const newPortraits = {
                                       ...(activeProfile.persistentPortraits ?? {}),
                                       [roleName]: { ...existing, ...updates },
                                     };
                                     dataService.updateServerProfile(activeProfile.id, { persistentPortraits: newPortraits });
                                     setServerProfiles(prev => prev.map(p =>
                                       p.id === activeProfile.id ? { ...p, persistentPortraits: newPortraits } : p
                                     ));
                                   }}
                                 />
                     </div>
                   )}
                 </div>
               )}
             </div>
           )}

           {activeTab === 'gallery' && (
              <CaseGallery
                cases={cases}
                user={user}
                onVote={handleVote}
                onView={handleViewCase}
                onRefresh={loadUserData}
              />
           )}

           {activeTab === 'knowledge' && <KnowledgeBase activeTab={knowledgeTab} onTabChange={setKnowledgeTab} />}

           {activeTab === 'profile' && (
              <ProfileView
                user={user}
                displayName={displayName}
                onDisplayNameChange={handleDisplayNameChange}
                memberGroup={memberGroup}
                groups={PRESET_GROUPS}
                onGroupChange={handleGroupChange}
                onLogout={handleLogout}
              />
           )}
        </div>
      </main>

      {collectMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border text-sm font-bold ${
            collectMsg.includes('失败')
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <span>{collectMsg.includes('失败') ? '✕' : '✓'}</span>
            {collectMsg}
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceholderPortal({
  portal,
  user,
  onSwitchPortal,
  onLogout,
}: {
  portal: 'admin' | 'leader';
  user: { username: string };
  onSwitchPortal: () => void;
  onLogout: () => void;
}) {
  const isAdmin = portal === 'admin';
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-8 px-6">
      <div className="text-center space-y-4">
        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto ${isAdmin ? 'bg-rose-50 text-rose-400' : 'bg-amber-50 text-amber-400'}`}>
          {isAdmin ? <Shield className="w-10 h-10" /> : <Crown className="w-10 h-10" />}
        </div>
        <h2 className="text-3xl font-black text-slate-900">{isAdmin ? '管理员端口' : '组长端口'}</h2>
        <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto leading-relaxed">
          此端口功能建设中，敬请期待后续迭代更新。
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onSwitchPortal}
          className="px-6 py-3 bg-amber-50 border border-amber-200 text-indigo-600 rounded-xl font-bold text-sm hover:bg-amber-100 transition-colors flex items-center gap-2"
        >
          <LayoutGrid className="w-4 h-4" />
          切换端口
        </button>
        <button
          onClick={onLogout}
          className="px-6 py-3 bg-rose-50 text-rose-500 rounded-xl font-bold text-sm hover:bg-rose-100 transition-colors flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </div>
  );
}

function StatusCheck({ label, checked }: { label: string, checked: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
       <span className="text-sm font-bold text-slate-600">{label}</span>
       <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${checked ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
          {checked && <Shield className="w-3.5 h-3.5" />}
       </div>
    </div>
  );
}
