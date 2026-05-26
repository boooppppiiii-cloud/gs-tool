/**
 * autoAnalysis.ts — Replicates the App.tsx startAnalysis() pipeline for the crawler.
 *
 * Flow:
 *  1. Fetch the GS member's latest ServerProfile from CloudBase
 *  2. Build analysis context strings (same logic as App.tsx lines 254-276)
 *  3. Call Gemini via the local server proxy (http://localhost:3000/api/gemini)
 *  4. Persist the result to CloudBase (analysisHistory collection)
 *  5. Update the ServerProfile's persistentPortraits and serverEcology
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
  playerReports: { roleName: string; portrait: Record<string, string>; portraitTable?: any; negativeOutbursts: any[] }[];
  rechargeReport: any;
  serverEcology: string;
  gsCommunicationReports?: any[];
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
  tags: string[];
  outburstReason: string;
  gsAction: string;
  caseResult: string;
  isPublic: boolean;
  [key: string]: any;
}
// ─────────────────────────────────────────────────────────────────────────

async function dbPost(endpoint: string, body: object): Promise<any> {
  const url = `${config.APP_SERVER_URL}/api/db/${endpoint}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`DB ${endpoint} error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchLatestProfile(userId: string, group: string): Promise<ServerProfile | null> {
  const result = await dbPost('where', { collection: 'serverProfiles', field: 'ownerId', value: userId });
  const profiles: ServerProfile[] = result.data ?? [];
  if (profiles.length === 0) {
    console.warn(`[AutoAnalysis] No ServerProfile found for userId=${userId}. Create one in the App first.`);
    return null;
  }
  // Use the first profile found (if member has multiple, you can add logic to pick by name)
  return profiles[0];
}

async function fetchRecentHistory(userId: string): Promise<HistoryRecord[]> {
  const result = await dbPost('where', { collection: 'analysisHistory', field: 'userId', value: userId });
  const records: HistoryRecord[] = result.data ?? [];
  records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return records.slice(0, 3); // last 3 records for context
}

async function fetchPublicCases(): Promise<AnalysisCase[]> {
  const result = await dbPost('getAll', { collection: 'cases', limit: 20 });
  return (result.data ?? []).filter((c: AnalysisCase) => c.isPublic);
}

async function callGemini(messages: { role: string; content: string }[]): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const url = `${config.APP_SERVER_URL}/api/gemini`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gemini-2.5-flash', messages, response_format: { type: 'json_object' } }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

function buildHistoricalContext(profile: ServerProfile, recentHistory: HistoryRecord[]): string {
  const serverRecords = recentHistory
    .filter(r => r.serverConfig?.id === profile.id)
    .slice(0, 2);
  if (serverRecords.length === 0) return '';
  return serverRecords.map(r => {
    return (r.result?.playerReports ?? []).map(p => {
      const outburstSummaries = (p.negativeOutbursts ?? []).map((o: any) =>
        `  - [${o.trigger}] 关键片段：${(o.context ?? []).slice(0, 3).map((c: any) => `${c.roleName}:${c.content}`).join('；')}`
      ).join('\n');
      return `玩家${p.roleName}（历史画像：${p.portrait?.summary ?? ''}）\n历史负面事件：\n${outburstSummaries || '  无'}`;
    }).join('\n');
  }).join('\n\n---\n\n');
}

export async function runAnalysis(
  chatData: ChatRecord[],
  rechargeData: RechargeRecord[],
  userId: string,
  group: string,
): Promise<void> {
  console.log(`[AutoAnalysis] Starting analysis for userId=${userId}, group=${group}`);
  console.log(`[AutoAnalysis] Chat records: ${chatData.length}, Recharge records: ${rechargeData.length}`);

  // 1. Fetch dependencies in parallel
  const [profile, recentHistory, publicCases] = await Promise.all([
    fetchLatestProfile(userId, group),
    fetchRecentHistory(userId),
    fetchPublicCases(),
  ]);

  if (!profile) throw new Error('No ServerProfile found — create one in the App before running the crawler.');

  // 2. Build context strings (mirrors App.tsx lines 254-276)
  const gsPersonaStr = profile.gsPersona
    ? `GS人设: [角色名:${profile.gsName || '未设置'}, 年龄:${profile.gsPersona.age || '未知'}, 家乡:${profile.gsPersona.hometown || '未知'}, 职业:${profile.gsPersona.occupation || '未知'}, 家庭:${profile.gsPersona.family || '未知'}, 生活作息:${profile.gsPersona.lifestyle || '未知'}, 其他:${profile.gsPersona.others || '无'}]`
    : 'GS人设: 未提供';

  const ecologyStr = profile.serverEcology ? `区服生态总结: ${profile.serverEcology}` : '区服生态总结: 未提供';
  const serverContextStr = `区服: ${profile.name}, 开服日期: ${profile.openingDate}. \n${gsPersonaStr} \n${ecologyStr}`;

  const persistentPortraitsStr = profile.persistentPortraits
    ? Object.entries(profile.persistentPortraits).map(([name, p]) =>
        `玩家[${name}]: ${p.summary} (付费习惯:${p.paymentHabits}, 性格:${p.personality}, 游戏习惯:${p.gameHabits}, 现实人设:${p.realLifePersona})`
      ).join('\n')
    : '';

  const chatSample = chatData.slice(-1000).map(r =>
    `[${r.time}] ${r.roleName}(${r.type}): ${r.content}${r.target ? ` -> ${r.target}` : ''}`
  ).join('\n');

  const rechargeSample = rechargeData.map(r =>
    `${r.roleName}: ${r.amount} (${r.status}, ${r.method})`
  ).join('\n');

  const refCases = publicCases.slice(0, 10);
  const hotCasesStr = refCases.map(c =>
    `案例[${c.title}]: 玩家爆发负面原因:${c.outburstReason}, GS具体处置动作:${c.gsAction}, 案例结果:${c.caseResult}`
  ).join('\n');

  const historicalContext = buildHistoricalContext(profile, recentHistory);
  const historicalSection = historicalContext
    ? `# 该区服历史分析摘要（仅供参考，不可与本次数据混用）\n${historicalContext}\n\n`
    : '';

  // 3. Build the full analysis prompt (identical to gemini.ts analyzeGameEcology)
  const prompt = buildAnalysisPrompt({
    serverContextStr,
    persistentPortraitsStr,
    hotCasesStr,
    historicalSection,
    chatSample,
    rechargeSample,
  });

  console.log('[AutoAnalysis] Calling Gemini...');
  const { content, inputTokens, outputTokens } = await callGemini([{ role: 'user', content: prompt }]);

  let result: AnalysisResult;
  try {
    result = JSON.parse(content);
  } catch {
    throw new Error(`Gemini returned invalid JSON. Raw: ${content.slice(0, 500)}`);
  }
  result._usage = { inputTokens, outputTokens };

  console.log(`[AutoAnalysis] Gemini done. Key players: ${result.identifiedKeyPlayers?.length ?? 0}, Reports: ${result.playerReports?.length ?? 0}`);

  // 4. Persist analysis record to CloudBase
  const histId = `hist_${Date.now()}`;
  const histRecord = {
    id: histId,
    timestamp: new Date().toISOString(),
    serverConfig: profile,
    result,
    userId,
    group,
  };
  await dbPost('upsert', { collection: 'analysisHistory', id: histId, data: histRecord });
  console.log(`[AutoAnalysis] Saved analysisHistory/${histId}`);

  // 5. Update ServerProfile with new portraits and ecology summary
  const newPortraits = { ...(profile.persistentPortraits || {}) };
  (result.playerReports ?? []).forEach(report => {
    newPortraits[report.roleName] = { ...report.portrait as any, lastUpdated: new Date().toISOString() };
  });
  const updatedProfile: ServerProfile = {
    ...profile,
    persistentPortraits: newPortraits,
    serverEcology: result.serverEcology,
  };
  await dbPost('upsert', { collection: 'serverProfiles', id: profile.id, data: updatedProfile });
  console.log(`[AutoAnalysis] Updated serverProfile/${profile.id}`);
}

// ── Full analysis prompt (mirrors gemini.ts analyzeGameEcology) ──────────
function buildAnalysisPrompt(p: {
  serverContextStr: string;
  persistentPortraitsStr: string;
  hotCasesStr: string;
  historicalSection: string;
  chatSample: string;
  rechargeSample: string;
}): string {
  return `
你是一个资深的《傲世传奇》游戏生态专家，负责对玩家聊天记录和充值数据进行客观分析。

${p.historicalSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【全局铁律——违反任何一条输出即视为无效】

A. 【禁止捏造】所有分析结论必须有且仅有原始数据作为依据。
   - 禁止推测、联想、脑补任何在聊天记录或充值表格中未出现的信息。
   - 若某项无据可查，直接填写"数据中无记录"，不得填写任何推测性内容。

B. 【聊天与充值严格隔离分析】
   - 聊天分析（负面情绪、行为特征）仅依据聊天记录。
   - 充值分析（金额、频次）仅依据充值数据。
   - 玩家画像中 paymentHabits 字段只能来自充值数据，personality/gameHabits 只能来自聊天数据。

C. 【充值额度严格计算】
   - 必须逐行读取充值数据，对每位玩家的所有充值条目金额进行逐笔累加，不得估算、不得凑整、不得遗漏。
   - GS运营账号（背景信息中标注的GS角色）不纳入任何充值统计，直接跳过。

D. 【时间戳原文照搬】
   - 聊天上下文 context 中每条消息的 time 字段，必须原文照抄自聊天记录，不可推算、不可估算、不可修改格式。
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
请严格按以下 JSON 结构输出，不要包裹 markdown 代码块：

{
  "identifiedKeyPlayers": ["角色名1", "角色名2"],
  "playerReports": [
    {
      "roleName": "角色名",
      "portrait": {
        "paymentHabits": "...",
        "personality": "...",
        "gameHabits": "...",
        "realLifePersona": "...",
        "summary": "..."
      },
      "portraitTable": {
        "isKeyPlayer": true,
        "basicData": { "totalRecharge": 0, "recentActivity": "...", "anomalySignals": "无" },
        "dimensions": [],
        "overallCompletion": 0
      },
      "negativeOutbursts": [
        {
          "title": "事件标题",
          "tags": ["标签1"],
          "mergeStage": "零合",
          "caseBackground": "案例背景",
          "trigger": "触发点",
          "context": [{ "roleName": "...", "content": "...", "time": "..." }],
          "triggerPoint": "负面触发点",
          "gsAdvice": { "action": "...", "reason": "...", "disposalPlan": "..." }
        }
      ]
    }
  ],
  "rechargeReport": {
    "totalPaid": 0,
    "totalUnpaid": 0,
    "playerSummaries": [],
    "paymentProfile": "...",
    "rechargeData": []
  },
  "serverEcology": "本时段区服生态总结..."
}
`;
}
