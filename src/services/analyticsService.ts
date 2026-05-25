import { db } from '../lib/firebase';

export interface UsageLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  path: string;
  timestamp: string;
  group?: string;
  chatCount?: number;
  negativeCount?: number;
  keyPlayerCount?: number;
  sessionDuration?: number;
  inputTokens?: number;
  outputTokens?: number;
  apiLatencyMs?: number;
  uploadedChatRows?: number;
  uploadedRechargeRows?: number;
}

let _sessionStart: number | null = null;
let _currentUser: { id: string; username: string } | null = null;
let _currentGroup: string | null = null;

export function initAnalyticsUser(uid: string, username: string) {
  _currentUser = { id: uid, username };
  _sessionStart = Date.now();
  logUsage('session_start', `Session started for ${username}`);
}

export function setAnalyticsGroup(group: string) {
  _currentGroup = group;
}

export function logUsage(
  action: string,
  details: string = '',
  chatCount?: number,
  negativeCount?: number,
  keyPlayerCount?: number,
  extra?: {
    inputTokens?: number;
    outputTokens?: number;
    apiLatencyMs?: number;
    uploadedChatRows?: number;
    uploadedRechargeRows?: number;
  }
) {
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
      ...(_currentGroup !== null && { group: _currentGroup }),
      ...(chatCount !== undefined && { chatCount }),
      ...(negativeCount !== undefined && { negativeCount }),
      ...(keyPlayerCount !== undefined && { keyPlayerCount }),
      ...(_sessionStart !== null && { sessionDuration: Date.now() - _sessionStart }),
      ...(extra?.inputTokens !== undefined && { inputTokens: extra.inputTokens }),
      ...(extra?.outputTokens !== undefined && { outputTokens: extra.outputTokens }),
      ...(extra?.apiLatencyMs !== undefined && { apiLatencyMs: extra.apiLatencyMs }),
      ...(extra?.uploadedChatRows !== undefined && { uploadedChatRows: extra.uploadedChatRows }),
      ...(extra?.uploadedRechargeRows !== undefined && { uploadedRechargeRows: extra.uploadedRechargeRows }),
    };

    (db.collection('usage_logs') as any).add({ _id: id, ...log }).catch((e: unknown) => {
      console.error('[Analytics] 云端写入失败', e);
    });
  } catch (e) {
    console.error('[Analytics] 记录失败', e);
  }
}

export async function fetchAllAnalyticsLogs(): Promise<UsageLog[]> {
  const res = await db.collection('usage_logs')
    .orderBy('timestamp', 'desc')
    .limit(1000)
    .get();
  return (res.data || []) as UsageLog[];
}
