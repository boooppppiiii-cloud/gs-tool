/**
 * autoAnalysis.ts — Replicates App.tsx startAnalysis() pipeline for the crawler.
 *
 * Flow:
 *  1. Fetch the GS member's latest ServerProfile from CloudBase
 *  2. Build analysis context strings (same logic as App.tsx lines 254-276)
 *  3. Call Gemini via the local server proxy
 *  4. Persist the result to CloudBase (analysisHistory collection)
 *  5. Update ServerProfile's persistentPortraits and serverEcology
 */

import { config } from './config';
import type { ChatRecord, RechargeRecord } from './parser';

// ── Types (mirror of src/types.ts) ──────────────────────────────────────
interface ServerProfile {
  id: string;
  name: string;
  openingDate: string;
  mergeStage?: string;
  gsName?: string;
  group?: string;
  gsPersona?: { age?: string; hometown?: string; occupation?: string; family?: string; lifestyle?: string; others?: string };
  serverEcology?: string;
  persistentPortraits?: Record<string, { paymentHabits: string; personality: string; gameHabits: string; realLifePersona: string; summary: string; lastUpdated: string }>;
  ownerId: string;
}

interface AnalysisResult {
  identifiedKeyPlayers: string[];
  playerReports: { roleName: string; portrait: Record<string, string>; portraitTable?: unknown; negativeOutbursts: unknown[] }[];
  rechargeReport: unknown;
  serverEcology: string;
  _usage?: { inputTokens: number; outputTokens: number };
}

interface HistoryRecord {
  id: string;
  timestamp: string;
  serverConfig: ServerProfile;
  result: AnalysisResult;
  userId: string;
  group: string;
}

interface AnalysisCase {
  id: string;
  title: string;
  outburstReason: string;
  gsAction: string;
  caseResult: string;
  isPublic: boolean;
  [key: string]: unknown;
}
// ─────────────────────────────────────────────────────────────────────────

async function dbPost(endpoint: string, body: object): Promise<Record<string, unknown>> {
  const url = `${config.APP_SERVER_URL}/api/db/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DB ${endpoint} error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function fetchLatestProfile(userId: string, serverName?: string): Promise<ServerProfile | null> {
  // Primary: query by ownerId (works when users.json gsUserId === Firebase UID)
  let profiles = ((await dbPost('where', { collection: 'serverProfiles', field: 'ownerId', value: userId })).data as ServerProfile[]) ?? [];

  // Fallback: query by serverName (works even when gsUserId is a CloudBase UID)
  if (profiles.length === 0 && serverName) {
    console.warn(`[AutoAnalysis] No profile for ownerId=${userId}, trying serverName="${serverName}"...`);
    profiles = ((await dbPost('where', { collection: 'serverProfiles', field: 'name', value: serverName })).data as ServerProfile[]) ?? [];
  }

  if (profiles.length === 0) {
    console.warn(`[AutoAnalysis] No ServerProfile found for userId=${userId}${serverName ? ` or serverName=${serverName}` : ''}. Create one in the App first.`);
    return null;
  }
  if (serverName) {
    return profiles.find(p => p.name === serverName) ?? profiles[0];
  }
  return profiles[0];
}

export async function fetchUserServerNames(userId: string): Promise<string[]> {
  const result = await dbPost('where', { collection: 'serverProfiles', field: 'ownerId', value: userId });
  const profiles = (result.data as ServerProfile[]) ?? [];
  return profiles.map(p => p.name).filter(n => /^\d+$/.test(n));
}

async function fetchRecentHistory(userId: string): Promise<HistoryRecord[]> {
  const result = await dbPost('where', { collection: 'analysisHistory', field: 'userId', value: userId });
  const records = (result.data as HistoryRecord[]) ?? [];
  return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 3);
}

async function fetchPublicCases(): Promise<AnalysisCase[]> {
  const result = await dbPost('getAll', { collection: 'cases', limit: 20 });
  return ((result.data as AnalysisCase[]) ?? []).filter(c => c.isPublic);
}

async function callGemini(messages: { role: string; content: string }[]): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const url = `${config.APP_SERVER_URL}/api/gemini`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gemini-2.5-flash', messages, response_format: { type: 'json_object' } }),
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

function buildHistoricalContext(profileId: string, history: HistoryRecord[]): string {
  const records = history.filter(r => r.serverConfig?.id === profileId).slice(0, 2);
  if (records.length === 0) return '';
  return records.map(r =>
    (r.result?.playerReports ?? []).map(p => {
      const summaries = ((p.negativeOutbursts ?? []) as { trigger?: string; context?: { roleName: string; content: string }[] }[])
        .map(o => `  - [${o.trigger}] 关键片段：${(o.context ?? []).slice(0, 3).map(c => `${c.roleName}:${c.content}`).join('；')}`)
        .join('\n');
      return `玩家${p.roleName}（历史画像：${p.portrait?.summary ?? ''}）\n历史负面事件：\n${summaries || '  无'}`;
    }).join('\n')
  ).join('\n\n---\n\n');
}

export async function runAnalysis(
  chatData: ChatRecord[],
  rechargeData: RechargeRecord[],
  userId: string,
  group: string,
  csvContent?: string,
  serverName?: string,
  crawlPeriod?: { start: Date; end: Date },
): Promise<void> {
  console.log(`[AutoAnalysis] userId=${userId}, server=${serverName ?? '(first)'}, chat=${chatData.length}, recharge=${rechargeData.length}`);

  const [profile, recentHistory, publicCases] = await Promise.all([
    fetchLatestProfile(userId, serverName),
    fetchRecentHistory(userId),
    fetchPublicCases(),
  ]);
  if (!profile) throw new Error('No ServerProfile found — create one in the App first.');

  // Build context strings (mirrors App.tsx startAnalysis())
  const gsPersonaStr = profile.gsPersona
    ? `GS人设: [角色名:${profile.gsName || '未设置'}, 年龄:${profile.gsPersona.age || '未知'}, 家乡:${profile.gsPersona.hometown || '未知'}, 职业:${profile.gsPersona.occupation || '未知'}, 家庭:${profile.gsPersona.family || '未知'}, 生活作息:${profile.gsPersona.lifestyle || '未知'}, 其他:${profile.gsPersona.others || '无'}]`
    : 'GS人设: 未提供';

  const serverContextStr = `区服: ${profile.name}, 开服日期: ${profile.openingDate}. \n${gsPersonaStr} \n${profile.serverEcology ? `区服生态总结: ${profile.serverEcology}` : '区服生态总结: 未提供'}`;

  const persistentPortraitsStr = profile.persistentPortraits
    ? Object.entries(profile.persistentPortraits)
        .map(([name, p]) => `玩家[${name}]: ${p.summary} (付费习惯:${p.paymentHabits}, 性格:${p.personality}, 游戏习惯:${p.gameHabits}, 现实人设:${p.realLifePersona})`)
        .join('\n')
    : '';

  const chatSample = chatData.slice(-1000)
    .map(r => `[${r.time}] ${r.roleName}(${r.type}): ${r.content}${r.target ? ` -> ${r.target}` : ''}`)
    .join('\n');

  const rechargeSample = rechargeData
    .map(r => `${r.roleName}: ${r.amount} (${r.status}, ${r.method})`)
    .join('\n');

  const hotCasesStr = publicCases.slice(0, 10)
    .map(c => `案例[${c.title}]: 玩家爆发负面原因:${c.outburstReason}, GS具体处置动作:${c.gsAction}, 案例结果:${c.caseResult}`)
    .join('\n');

  const historicalContext = buildHistoricalContext(profile.id, recentHistory);
  const historicalSection = historicalContext
    ? `# 该区服历史分析摘要（仅供参考，不可与本次数据混用）\n${historicalContext}\n\n`
    : '';

  const prompt = buildPrompt({ serverContextStr, persistentPortraitsStr, hotCasesStr, historicalSection, chatSample, rechargeSample });

  console.log('[AutoAnalysis] Calling Gemini...');
  const { content, inputTokens, outputTokens } = await callGemini([{ role: 'user', content: prompt }]);

  let result: AnalysisResult;
  try {
    result = JSON.parse(content) as AnalysisResult;
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${content.slice(0, 300)}`);
  }
  result._usage = { inputTokens, outputTokens };
  console.log(`[AutoAnalysis] Key players: ${result.identifiedKeyPlayers?.length ?? 0}, Reports: ${result.playerReports?.length ?? 0}`);

  // Use profile.ownerId (Firebase UID) so App queries by user.id can find these records.
  // userId param is gsUserId from users.json which may be a CloudBase UID, not Firebase UID.
  const appUserId = profile.ownerId;

  // Persist to CloudBase
  const histId = `hist_${Date.now()}`;
  await dbPost('upsert', {
    collection: 'analysisHistory',
    id: histId,
    data: { id: histId, timestamp: new Date().toISOString(), serverConfig: profile, result, userId: appUserId, group, hasCsv: !!csvContent },
  });

  if (csvContent) {
    try {
      await dbPost('upsert', {
        collection: 'chat_csv_files',
        id: histId,
        data: { recordId: histId, userId: appUserId, content: csvContent },
      });
      console.log(`[AutoAnalysis] CSV uploaded (${csvContent.length} chars)`);
    } catch (e) {
      console.warn('[AutoAnalysis] CSV 上传失败（不影响分析结果）:', e);
    }
  }

  if (crawlPeriod) {
    try {
      const crawlId = `crawl_${Date.now()}`;
      await dbPost('upsert', {
        collection: 'crawler_chat_logs',
        id: crawlId,
        data: {
          id: crawlId,
          userId: appUserId,
          serverName: profile.name,
          timestamp: new Date().toISOString(),
          crawlStart: crawlPeriod.start.toISOString(),
          crawlEnd: crawlPeriod.end.toISOString(),
          rowCount: chatData.length,
          csvFileId: histId,
        },
      });
      console.log(`[AutoAnalysis] Crawler chat log saved: ${crawlId}`);
    } catch (e) {
      console.warn('[AutoAnalysis] Crawler log 保存失败:', e);
    }
  }

  // Update ServerProfile portraits + ecology
  const newPortraits = { ...(profile.persistentPortraits ?? {}) };
  for (const report of result.playerReports ?? []) {
    newPortraits[report.roleName] = { ...report.portrait as { paymentHabits: string; personality: string; gameHabits: string; realLifePersona: string; summary: string }, lastUpdated: new Date().toISOString() };
  }
  await dbPost('upsert', {
    collection: 'serverProfiles',
    id: profile.id,
    data: { ...profile, persistentPortraits: newPortraits, serverEcology: result.serverEcology },
  });

  console.log(`[AutoAnalysis] Saved analysisHistory/${histId}`);
}

function buildPrompt(p: { serverContextStr: string; persistentPortraitsStr: string; hotCasesStr: string; historicalSection: string; chatSample: string; rechargeSample: string }): string {
  return `你是一个资深的《傲世传奇》游戏生态专家，负责对玩家聊天记录和充值数据进行客观分析。

${p.historicalSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【全局铁律——违反任何一条输出即视为无效】

A. 【禁止捏造】所有分析结论必须有且仅有原始数据作为依据。
B. 【聊天与充值严格隔离分析】paymentHabits 只能来自充值数据，personality/gameHabits 只能来自聊天数据。
C. 【充值额度严格计算】必须逐行累加，GS运营账号不纳入统计。
D. 【时间戳原文照搬】context 中每条消息的 time 字段原文照抄。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 背景信息
${p.serverContextStr}

# 已有的重点玩家画像
${p.persistentPortraitsStr || '暂无存量画像'}

# 参考案例库
${p.hotCasesStr || '暂无参考案例'}

# 待分析数据
## 聊天记录
${p.chatSample}

## 充值数据
${p.rechargeSample || '本时段无充值数据'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
请严格按以下 JSON 结构输出，不要包裹 markdown：

{
  "identifiedKeyPlayers": [],
  "playerReports": [
    {
      "roleName": "",
      "portrait": { "paymentHabits": "", "personality": "", "gameHabits": "", "realLifePersona": "", "summary": "" },
      "portraitTable": { "isKeyPlayer": false, "basicData": { "totalRecharge": 0, "recentActivity": "", "anomalySignals": "无" }, "dimensions": [], "overallCompletion": 0 },
      "negativeOutbursts": [
        {
          "title": "", "tags": [], "mergeStage": "", "caseBackground": "",
          "trigger": "", "context": [{ "roleName": "", "content": "", "time": "" }],
          "triggerPoint": "",
          "gsAdvice": { "action": "", "reason": "", "disposalPlan": "" }
        }
      ]
    }
  ],
  "rechargeReport": { "totalPaid": 0, "totalUnpaid": 0, "playerSummaries": [], "paymentProfile": "", "rechargeData": [] },
  "serverEcology": "",
  "chatTopics": ["话题1", "话题2"]
}`;
}
