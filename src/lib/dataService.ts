import { ServerProfile, AnalysisResult, AnalysisCase, HistoryRecord, MonthHistory } from '../types';

// Module-level current user, set on login/logout
let _currentUserId: string | null = null;

export function setCurrentUser(userId: string | null) {
  _currentUserId = userId;
}

function currentUid(): string {
  if (!_currentUserId) throw new Error('用户未登录');
  return _currentUserId;
}

// localStorage helpers
function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function save<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.error('[Storage] 写入失败', e); }
}

// ---------------- Server Profiles ----------------
export async function saveServerProfile(profile: ServerProfile) {
  const uid = currentUid();
  const profiles = load<ServerProfile>('gs_serverProfiles');
  const idx = profiles.findIndex(p => p.id === profile.id);
  const record = { ...profile, ownerId: uid };
  if (idx >= 0) profiles[idx] = record; else profiles.push(record);
  save('gs_serverProfiles', profiles);
}

export async function fetchServerProfiles(userId: string): Promise<ServerProfile[]> {
  return load<ServerProfile>('gs_serverProfiles').filter(p => p.ownerId === userId);
}

export async function deleteServerProfile(profileId: string) {
  save('gs_serverProfiles', load<ServerProfile>('gs_serverProfiles').filter(p => p.id !== profileId));
}

export async function updateServerProfile(id: string, updates: Partial<ServerProfile>) {
  const profiles = load<ServerProfile>('gs_serverProfiles');
  const idx = profiles.findIndex(p => p.id === id);
  if (idx >= 0) { profiles[idx] = { ...profiles[idx], ...updates }; save('gs_serverProfiles', profiles); }
}

// ---------------- Analysis History ----------------
export async function saveAnalysisRecord(serverConfig: ServerProfile, result: AnalysisResult): Promise<string> {
  const uid = currentUid();
  const id = `hist_${Date.now()}`;
  const record = { id, timestamp: new Date().toISOString(), serverConfig, result, userId: uid };
  const history = load<typeof record>('gs_analysisHistory');
  history.unshift(record);
  save('gs_analysisHistory', history);

  if (result.playerReports) {
    for (const report of result.playerReports) {
      if (report.negativeOutbursts?.length > 0) {
        createCaseFromReport(serverConfig, report, uid);
      }
    }
  }
  return id;
}

export async function fetchHistory(userId: string): Promise<MonthHistory[]> {
  const records = load<HistoryRecord & { userId: string }>('gs_analysisHistory')
    .filter(r => r.userId === userId);
  const groups: { [key: string]: HistoryRecord[] } = {};
  records.forEach(r => {
    const month = r.timestamp.slice(0, 7);
    if (!groups[month]) groups[month] = [];
    groups[month].push(r);
  });
  return Object.entries(groups)
    .map(([month, recs]) => ({ month, records: recs }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export async function deleteHistoryRecord(id: string) {
  save('gs_analysisHistory', load<HistoryRecord>('gs_analysisHistory').filter(r => r.id !== id));
}

export async function updateHistoryRecord(id: string, updates: Partial<HistoryRecord>) {
  const history = load<HistoryRecord>('gs_analysisHistory');
  const idx = history.findIndex(r => r.id === id);
  if (idx >= 0) { history[idx] = { ...history[idx], ...updates }; save('gs_analysisHistory', history); }
}

// ---------------- Cases ----------------
function toStr(v: any): string { return typeof v === 'string' ? v : (v != null ? JSON.stringify(v) : ''); }

function createCaseFromReport(serverConfig: ServerProfile, report: any, userId: string) {
  const outburstReason = toStr(report.negativeOutbursts[0]?.trigger);
  const playerName = report.roleName;
  if (!outburstReason || !playerName) return;

  const cases = load<AnalysisCase>('gs_cases');
  const dup = cases.find(c => c.ownerId === userId && c.playerName === playerName && c.outburstReason === outburstReason);
  if (dup) return;

  const id = `case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const gsAdvice = report.negativeOutbursts[0]?.gsAdvice || {};
  const newCase: AnalysisCase = {
    id,
    title: `${serverConfig.name} - ${playerName} 负面趋势分析`,
    tags: ['系统自动提取'],
    serverName: serverConfig.name,
    gsName: serverConfig.gsName || '系统默认',
    playerName,
    outburstReason,
    triggerPoint: toStr(report.negativeOutbursts[0]?.triggerPoint),
    context: report.negativeOutbursts[0]?.context || [],
    gsAction: toStr(gsAdvice.action),
    disposalPlan: toStr(gsAdvice.disposalPlan),
    caseResult: '处理中',
    timestamp: new Date().toISOString(),
    views: 0,
    likes: 0,
    votedUserIds: [],
    isPublic: false,
    ownerId: userId,
  };
  cases.push(newCase);
  save('gs_cases', cases);
}

export async function fetchCases(userId: string): Promise<AnalysisCase[]> {
  const cases = load<AnalysisCase>('gs_cases');
  const casesMap = new Map<string, AnalysisCase>();
  cases.filter(c => c.isPublic).forEach(c => casesMap.set(c.id, c));
  cases.filter(c => c.ownerId === userId).forEach(c => casesMap.set(c.id, c));

  const allCases = Array.from(casesMap.values());
  const publicCases = allCases.filter(c => c.isPublic).sort((a, b) => b.likes - a.likes);
  const top3Ids = publicCases.slice(0, 3).map(c => c.id);

  return allCases
    .map(c => ({ ...c, isHot: top3Ids.includes(c.id) && c.isPublic && c.likes > 0 }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function updateCase(id: string, updates: Partial<AnalysisCase>) {
  const cases = load<AnalysisCase>('gs_cases');
  const idx = cases.findIndex(c => c.id === id);
  if (idx >= 0) { cases[idx] = { ...cases[idx], ...updates }; save('gs_cases', cases); }
}

export async function deleteCase(id: string) {
  save('gs_cases', load<AnalysisCase>('gs_cases').filter(c => c.id !== id));
}

export async function voteOnCase(id: string, userId: string) {
  const cases = load<AnalysisCase>('gs_cases');
  const idx = cases.findIndex(c => c.id === id);
  if (idx < 0) return;
  const c = cases[idx];
  const hasVoted = c.votedUserIds?.includes(userId);
  cases[idx] = {
    ...c,
    likes: hasVoted ? c.likes - 1 : c.likes + 1,
    votedUserIds: hasVoted
      ? (c.votedUserIds || []).filter(u => u !== userId)
      : [...(c.votedUserIds || []), userId],
  };
  save('gs_cases', cases);
}

export async function incrementCaseView(id: string) {
  const cases = load<AnalysisCase>('gs_cases');
  const idx = cases.findIndex(c => c.id === id);
  if (idx >= 0) { cases[idx] = { ...cases[idx], views: (cases[idx].views || 0) + 1 }; save('gs_cases', cases); }
}

export async function saveManualCase(newCase: AnalysisCase) {
  const uid = currentUid();
  const cases = load<AnalysisCase>('gs_cases');
  const idx = cases.findIndex(c => c.id === newCase.id);
  const record = { ...newCase, ownerId: uid };
  if (idx >= 0) cases[idx] = record; else cases.push(record);
  save('gs_cases', cases);
}

export async function testConnection() {
  console.log('[LocalStorage] 后端就绪，使用本地存储（无需云端配置）');
}
