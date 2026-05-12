import { db } from '../lib/firebase';

interface UsageLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  path: string;
  timestamp: string;
  chatCount?: number;
  negativeCount?: number;
  keyPlayerCount?: number;
  sessionDuration?: number;
}

const STORAGE_KEY = 'gs_analytics';
const MAX_LOGS = 2000;

let _sessionStart: number | null = null;
let _currentUser: { id: string; username: string } | null = null;

export function initAnalyticsUser(uid: string, username: string) {
  _currentUser = { id: uid, username };
  _sessionStart = Date.now();
  logUsage('session_start', `Session started for ${username}`);
}

function loadLogs(): UsageLog[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveLogs(logs: UsageLog[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs)); } catch (e) { console.error('[Analytics] 写入失败', e); }
}

export function logUsage(action: string, details: string = '', chatCount?: number, negativeCount?: number, keyPlayerCount?: number) {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const log: UsageLog = {
      id,
      userId: _currentUser?.id || 'anonymous',
      username: _currentUser?.username || 'Unknown',
      action,
      details,
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
      ...(chatCount !== undefined && { chatCount }),
      ...(negativeCount !== undefined && { negativeCount }),
      ...(keyPlayerCount !== undefined && { keyPlayerCount }),
      ...(_sessionStart !== null && { sessionDuration: Date.now() - _sessionStart }),
    };
    const logs = loadLogs();
    logs.unshift(log);
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
    saveLogs(logs);
    // 异步上云（fire-and-forget，失败静默）
    db.collection('analytics_logs').doc(log.id).set(log).catch(() => {});
  } catch (e) {
    console.error('[Analytics] 记录失败', e);
  }
}

export function getAnalyticsLogs(): UsageLog[] {
  return loadLogs();
}

export async function fetchAllAnalyticsLogs(): Promise<UsageLog[]> {
  const res = await db.collection('analytics_logs')
    .orderBy('timestamp', 'desc')
    .limit(500)
    .get();
  return (res.data || []) as UsageLog[];
}
