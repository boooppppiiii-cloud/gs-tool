import { AnalysisResult, AnalysisCase } from "../types";

async function chatCompletion(messages: { role: string; content: string }[], jsonMode = false): Promise<string> {
  const res = await fetch('/api/gemini/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages,
      ...(jsonMode && { response_format: { type: 'json_object' } }),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) {
      throw new Error('Gemini API 免费配额已用尽，请等待明日重置或前往 aistudio.google.com 检查配额。');
    }
    throw new Error(`Gemini API 错误: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function analyzeGameEcology(
  serverContext: string,
  chatData: string,
  rechargeData: string,
  referenceCases: AnalysisCase[] = [],
  persistentPortraits: string = ""
): Promise<AnalysisResult> {
  const hotCasesStr = referenceCases.map(c =>
    `案例[${c.title}]: 玩家爆发负面原因:${c.outburstReason}, GS具体处置动作:${c.gsAction}, 案例结果:${c.caseResult}`
  ).join('\n');

  const prompt = `
你是一个资深的《傲世传奇》游戏生态专家，擅长通过玩家聊天语境和充值行为分析其深层心理、付费潜力及流失风险。

# 背景信息
${serverContext}

# 已有的重点玩家画像 (之前的分析结论，请结合本次数据进行更新或完善)
${persistentPortraits || '暂无存量画像'}

# 参考优秀案例 (学习其分析深度和归因逻辑)
${hotCasesStr}

# 待分析数据
## 聊天记录 (Sheet1)
${chatData}

## 充值数据 (Sheet2)
${rechargeData}

# 任务目标
1. **识别重点玩家**：基于聊天活跃度、充值金额、言论影响力，自动从数据中筛选出最值得关注的1-3位玩家。
2. **生成玩家画像**：对识别出的玩家，结合充值和聊天，生成画像。画像总结需在一句话内（30字内），结合付费习惯、游戏习惯、现实人设。
3. **负面爆发核查**：识别"爆发负面"趋势，输出：
   - 玩家名 + 负面爆发原因
   - 溯源上下文：必须标注每条消息发送具体时间，格式严格要求为：'M月/D日/HH:mm' (如：4月/18日/18:33)。
   - 负面触发点：结合背景信息中的游戏知识进行深度归因。
4. **GS建议**：
   - 具体引导动作。
   - GS 处置方案：结合知识库和参考案例，给出系统化的应对逻辑。**务必参考背景信息中的"GS 人设和区服生态"，确保建议的风格语气符合 GS 角色设定。**
5. **充值分析**：统计充值总额，并判定玩家是否转端。

# 输出格式要求
必须严格返回一个 JSON 对象，包含以下字段（不要任何 markdown 包裹）：

{
  "identifiedKeyPlayers": ["玩家名1", "玩家名2"],
  "playerReports": [
    {
      "roleName": "玩家名",
      "portrait": {
        "paymentHabits": "付费习惯描述",
        "personality": "性格描述",
        "gameHabits": "游戏习惯描述",
        "realLifePersona": "现实人设描述",
        "summary": "一句话总结（30字内）"
      },
      "negativeOutbursts": [
        {
          "trigger": "爆发负面的详细原因",
          "triggerPoint": "具体触发点（结合游戏知识）",
          "context": [
            { "roleName": "发言人", "content": "消息内容", "time": "M月/D日/HH:mm" }
          ],
          "gsAdvice": {
            "action": "具体引导动作",
            "reason": "原因分析",
            "disposalPlan": "体系化GS处置方案"
          }
        }
      ]
    }
  ],
  "rechargeReport": {
    "totalPaid": 数字,
    "totalUnpaid": 数字,
    "playerSummaries": [
      {
        "roleName": "玩家名",
        "totalPaid": 数字,
        "isConverted": true或false,
        "conversionDetails": "转端判定逻辑",
        "paymentHabits": "付费习惯"
      }
    ],
    "paymentProfile": "整体付费画像",
    "rechargeData": [{ "name": "金额挡位", "value": 数字 }]
  },
  "serverEcology": "区服生态总结（约100字）"
}

负面爆发上下文 context 必须包含 3-5 条相关消息。
`;

  const content = await chatCompletion(
    [{ role: 'user', content: prompt }],
    true
  );
  return JSON.parse(content);
}
