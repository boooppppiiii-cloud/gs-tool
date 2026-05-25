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
import AdminDashboard from './components/AdminDashboard';
import PortalSelector from './components/PortalSelector';
import LeaderPortal from './components/LeaderPortal';
import { ServerProfile, ChatRecord, RechargeRecord, AnalysisResult, MonthHistory, HistoryRecord, AnalysisCase, User, ExecutionRecord } from './types';
import { analyzeGameEcology } from './lib/gemini';

import { auth } from './lib/firebase';
import * as dataService from './lib/dataService';
import { syncFromCloud } from './lib/dataService';
import { logUsage, initAnalyticsUser } from './services/analyticsService';

const ADMIN_EMAIL = '1463432441@qq.com';

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
  const [activePortal, setActivePortal] = React.useState<'admin' | 'leader' | 'member' | null>(null);
  const [displayName, setDisplayName] = React.useState<string>('');

  const PRESET_GROUPS = ['杭州三组', '杭州五组', '杭州对抗组', '山东一组', '山东对抗组', '山东对抗二组', '山东二组', '山东九组', '山东三组'];
  const [memberGroup, setMemberGroup] = React.useState<string>(PRESET_GROUPS[0]);
  React.useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`member_group_${user.id}`);
      const group = saved && PRESET_GROUPS.includes(saved) ? saved : PRESET_GROUPS[0];
      setMemberGroup(group);
      // Ensure all existing records are tagged and synced to cloud on login
      dataService.setMemberGroupAndTagRecords(user.id, group);
    }
  }, [user?.id]);
  const handleGroupChange = (g: string) => {
    if (!user) return;
    setMemberGroup(g);
    localStorage.setItem(`member_group_${user.id}`, g);
    // Retag all records with new group and push to cloud
    dataService.setMemberGroupAndTagRecords(user.id, g);
  };
  const handleDisplayNameChange = (name: string) => {
    if (!user) return;
    setDisplayName(name);
    localStorage.setItem(`member_display_name_${user.id}`, name);
  };

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

  const loadUserData = async () => {
    if (!user) return;
    try {
      await syncFromCloud(user.id);
      const [profiles, historyData, casesData, execData, dismissed] = await Promise.all([
        dataService.fetchServerProfiles(user.id),
        dataService.fetchHistory(user.id),
        dataService.fetchCases(user.id),
        dataService.fetchExecutionRecords(user.id),
        dataService.fetchDismissedOutbursts(),
      ]);
      setServerProfiles(profiles);
      setHistory(historyData);
      setCases(casesData);
      setExecutionRecords(execData);
      setDismissedOutbursts(dismissed);
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
    logUsage('analysis_start', `Analyzing ${activeProfile.name}`);

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
      logUsage('analysis_complete', `${activeProfile.name} 分析完成`, chatData.length, negativeCount, keyPlayerCount);

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

  type TabId = 'home' | 'server' | 'analysis' | 'gallery' | 'knowledge' | 'profile';
  type NavItem = { id: TabId; label: string; icon: React.ReactElement; children?: { id: string; label: string }[] };

  const navItems: NavItem[] = [
    { id: 'home', label: '首页', icon: <Zap className="w-5 h-5 transition-all" /> },
    { id: 'server', label: '区服配置', icon: <Hammer className="w-5 h-5 transition-all" /> },
    {
      id: 'analysis', label: '专家分析', icon: <Sword className="w-5 h-5 transition-all" />,
      children: [{ id: 'current', label: '实时分析' }, { id: 'history', label: '历史存档' }]
    },
    { id: 'gallery', label: '优秀案例库', icon: <Crown className="w-5 h-5 transition-all" /> },
    {
      id: 'knowledge', label: '游戏知识库', icon: <Scroll className="w-5 h-5 transition-all" />,
      children: [{ id: 'items', label: '道具数据库' }, { id: 'calendar', label: '维护日历' }]
    },
    { id: 'profile', label: '个人中心', icon: <Shield className="w-5 h-5 transition-all" /> },
  ];

  const getSubTab = (parentId: string) => {
    if (parentId === 'analysis') return analysisSubTab;
    if (parentId === 'knowledge') return knowledgeTab;
    return null;
  };

  const setSubTab = (parentId: string, childId: string) => {
    if (parentId === 'analysis') setAnalysisSubTab(childId as 'current' | 'history');
    if (parentId === 'knowledge') setKnowledgeTab(childId as 'items' | 'calendar');
  };

  const handleTicketClick = (historyRecordId: string) => {
    const record = history.flatMap(m => m.records).find(r => r.id === historyRecordId);
    if (record) handleSelectHistory(record);
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
    return <PortalSelector user={user} onSelect={handleSelectPortal} />;
  }

  if (activePortal === 'admin') {
    return <PlaceholderPortal portal="admin" user={user} onSwitchPortal={handleSwitchPortal} onLogout={handleLogout} />;
  }

  if (activePortal === 'leader') {
    return <LeaderPortal user={user} onSwitchPortal={handleSwitchPortal} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-white flex font-sans text-slate-800">
      {/* Sidebar Navigation */}
      <aside
        className={`bg-white flex flex-col transition-all duration-300 z-50 sticky top-0 h-screen border-r border-slate-200 ${
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
          {navItems.map((item) => (
            <React.Fragment key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group ${
                  activeTab === item.id
                    ? 'bg-amber-50 text-indigo-600 border border-amber-200/80'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                } ${!isSidebarOpen && 'justify-center'}`}
              >
                <div className={`shrink-0 transition-colors ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'}`}>
                  {item.icon}
                </div>
                {isSidebarOpen && <span className="text-sm font-semibold">{item.label}</span>}
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
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
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
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-amber-50 hover:text-indigo-600 transition-all ${!isSidebarOpen && 'justify-center'}`}
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
            {isSidebarOpen && <span className="text-sm font-semibold">切换端口</span>}
          </button>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all ${!isSidebarOpen && 'justify-center'}`}
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
            <span>{navItems.find(i => i.id === activeTab)?.label}</span>
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
                 <HistoryView history={history} onSelect={handleSelectHistory} onDelete={handleDeleteHistory} />
               ) : (
                 <div className="space-y-8">
                   {!analysisResult ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <ExcelUpload onDataLoaded={handleDataLoaded} isAnalyzing={isAnalyzing} />
                        <div className="space-y-6">
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
                                className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 disabled:hover:translate-y-0 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 group"
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
                           <button onClick={() => setAnalysisResult(null)} className="px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-all">重新分析</button>
                        </div>
                                                 <AnalysisReport
                                   result={analysisResult}
                                   executionRecords={executionRecords}
                                   currentHistoryId={currentHistoryId}
                                   serverName={serverProfiles.find(p => p.id === activeProfileId)?.name}
                                   gsName={serverProfiles.find(p => p.id === activeProfileId)?.gsName}
                                   onSaveRecords={async (records) => {
                                     for (const rec of records) {
                                       await dataService.saveExecutionRecord({ ...rec, ownerId: user?.id ?? '' });
                                     }
                                     await loadUserData();
                                   }}
                                   onSaveCase={async (draft) => {
                                     const activeProfile = serverProfiles.find(p => p.id === activeProfileId);
                                     const id = `case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                     const newCase: AnalysisCase = {
                                       id,
                                       title: draft.title ?? '待完善案例',
                                       tags: draft.tags ?? ['AI辅助整合'],
                                       serverName: draft.serverName ?? activeProfile?.name ?? '',
                                       gsName: draft.gsName ?? activeProfile?.gsName ?? '',
                                       playerName: draft.playerName ?? '',
                                       mergeStage: draft.mergeStage,
                                       caseBackground: draft.caseBackground,
                                       outburstReason: draft.outburstReason ?? '',
                                       triggerPoint: draft.triggerPoint ?? '',
                                       context: draft.context ?? [],
                                       gsAction: draft.gsAction ?? '',
                                       disposalPlan: draft.disposalPlan ?? '',
                                       caseResult: draft.caseResult ?? '',
                                       timestamp: new Date().toISOString(),
                                       views: 0, likes: 0, votedUserIds: [],
                                       isPublic: false,
                                       ownerId: user!.id,
                                     };
                                     await dataService.saveManualCase(newCase);
                                     const updated = await dataService.fetchCases(user!.id);
                                     setCases(updated);
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
          className="px-6 py-3 bg-amber-50 border border-amber-200 text-indigo-600 rounded-xl font-bold text-sm hover:bg-amber-100 transition-all flex items-center gap-2"
        >
          <LayoutGrid className="w-4 h-4" />
          切换端口
        </button>
        <button
          onClick={onLogout}
          className="px-6 py-3 bg-rose-50 text-rose-500 rounded-xl font-bold text-sm hover:bg-rose-100 transition-all flex items-center gap-2"
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
