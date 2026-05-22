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
  MessageSquare
} from 'lucide-react';
import ServerConfig from './components/ServerConfig';
import ExcelUpload from './components/ExcelUpload';
import AnalysisReport from './components/AnalysisReport';
import HistoryView from './components/HistoryView';
import CaseGallery from './components/CaseGallery';
import HomeView from './components/HomeView';
import KnowledgeBase from './components/KnowledgeBase';
import ChatSimulation from './components/ChatSimulation';
import ProfileView from './components/ProfileView';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import { ServerProfile, ChatRecord, RechargeRecord, AnalysisResult, MonthHistory, HistoryRecord, AnalysisCase, User } from './types';
import { analyzeGameEcology } from './lib/gemini';

import { auth } from './lib/firebase';
import * as dataService from './lib/dataService';
import { logUsage, initAnalyticsUser } from './services/analyticsService';

const ADMIN_EMAIL = '1463432441@qq.com';

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [activeTab, setActiveTab] = React.useState<'home' | 'server' | 'analysis' | 'gallery' | 'knowledge' | 'profile' | 'chat-simulation'>('home');
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
      } else {
        dataService.setCurrentUser(null);
        setUser(null);
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
      const [profiles, historyData, casesData] = await Promise.all([
        dataService.fetchServerProfiles(user.id),
        dataService.fetchHistory(user.id),
        dataService.fetchCases(user.id)
      ]);
      setServerProfiles(profiles);
      setHistory(historyData);
      setCases(casesData);
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

      const result = await analyzeGameEcology(serverContextStr, chatSample, rechargeSample, cases.slice(0, 10), persistentPortraitsStr);
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

  type TabId = 'home' | 'server' | 'analysis' | 'gallery' | 'knowledge' | 'chat-simulation' | 'profile';
  type NavItem = { id: TabId; label: string; icon: React.ReactElement; children?: { id: string; label: string }[] };

  const navItems: NavItem[] = [
    { id: 'home', label: '首页', icon: <Zap className="w-5 h-5 transition-all" /> },
    { id: 'server', label: '区服配置', icon: <Hammer className="w-5 h-5 transition-all" /> },
    {
      id: 'analysis', label: '专家分析', icon: <Sword className="w-5 h-5 transition-all" />,
      children: [{ id: 'current', label: '实时分析' }, { id: 'history', label: '历史存档' }]
    },
    {
      id: 'gallery', label: '优秀案例库', icon: <Crown className="w-5 h-5 transition-all" />,
      children: [{ id: 'online', label: '精英案例' }, { id: 'my', label: '我的案例' }]
    },
    {
      id: 'knowledge', label: '游戏知识库', icon: <Scroll className="w-5 h-5 transition-all" />,
      children: [{ id: 'items', label: '道具数据库' }, { id: 'calendar', label: '维护日历' }]
    },
    { id: 'chat-simulation', label: '对话模拟', icon: <MessageSquare className="w-5 h-5 transition-all" /> },
    { id: 'profile', label: '个人中心', icon: <Shield className="w-5 h-5 transition-all" /> },
  ];

  const getSubTab = (parentId: string) => {
    if (parentId === 'analysis') return analysisSubTab;
    if (parentId === 'gallery') return galleryFilter;
    if (parentId === 'knowledge') return knowledgeTab;
    return null;
  };

  const setSubTab = (parentId: string, childId: string) => {
    if (parentId === 'analysis') setAnalysisSubTab(childId as 'current' | 'history');
    if (parentId === 'gallery') setGalleryFilter(childId as 'online' | 'my');
    if (parentId === 'knowledge') setKnowledgeTab(childId as 'items' | 'calendar');
  };

  if (!user) {
    return <Login onLogin={(u) => {
      dataService.setCurrentUser(u.id);
      initAnalyticsUser(u.id, u.username);
      setUser(u);
      logUsage('login', `User ${u.username} logged in`);
    }} />;
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
        <div className="px-3 py-4 border-t border-slate-100">
          <button
            onClick={() => auth.signOut()}
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
              <p className="text-sm font-bold text-slate-800 leading-none">{user.username}</p>
            </div>
            <div className="w-9 h-9 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-indigo-600 font-black text-sm">
              {user.username[0].toUpperCase()}
            </div>
          </div>
        </header>

        <div className="px-8 pb-12 pt-8 overflow-y-auto flex-1">
           {activeTab === 'home' && <HomeView serverProfiles={serverProfiles} />}
           
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
                                                 <AnalysisReport result={analysisResult} />
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
                filter={galleryFilter}
                onFilterChange={setGalleryFilter}
                onVote={handleVote}
                onView={handleViewCase}
                onUpdate={handleUpdateCase}
                onDelete={handleDeleteCase}
                onRefresh={loadUserData}
              />
           )}

           {activeTab === 'knowledge' && <KnowledgeBase activeTab={knowledgeTab} onTabChange={setKnowledgeTab} />}

           {activeTab === 'chat-simulation' && <ChatSimulation profiles={serverProfiles} />}

           {activeTab === 'profile' && <ProfileView user={user} onLogout={() => auth.signOut()} />}
        </div>
      </main>
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
