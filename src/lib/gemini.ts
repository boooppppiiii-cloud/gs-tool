import { AnalysisResult, AnalysisCase } from "../types";

export async function qualityCheckExecution(
  outburstTitle: string,
  outburstTrigger: string,
  gsAdviceAction: string,
  executionDescription: string,
  category: '待推进' | '已解决'
): Promise<{
  summary: string;
  consistencyCheck: string;
  reasonabilityCheck: string;
  riskPoints: string;
  rating: '优' | '良' | '需改进' | '存在问题';
}> {
  const prompt = `你是一个游戏运营质量审计专家，负责核验GS（游戏运营人员）的工单执行质量。

【原始负面事件】
事件标题：${outburstTitle}
负面触发点：${outburstTrigger}

【AI建议的GS处置动作】
${gsAdviceAction}

【GS实际执行记录】
分类：${category}
执行描述：${executionDescription || '（无描述）'}

请从以下四个维度进行综合质检，严格返回JSON对象（不要markdown包裹）：
{
  "summary": "执行情况一句话摘要（30字内）",
  "consistencyCheck": "GS实际执行与建议方案的一致性评估（50字内）",
  "reasonabilityCheck": "处置策略合理性与适当性评估（50字内）",
  "riskPoints": "识别到的疑点、风险或改进建议（50字内，无风险填'暂无明显风险'）",
  "rating": "综合评级，只能是以下四者之一：优/良/需改进/存在问题"
}`;

  const content = await chatCompletion([{ role: 'user', content: prompt }], true);
  const raw = JSON.parse(content);
  return {
    summary: raw.summary ?? '',
    consistencyCheck: raw.consistencyCheck ?? '',
    reasonabilityCheck: raw.reasonabilityCheck ?? '',
    riskPoints: raw.riskPoints ?? '',
    rating: raw.rating ?? '良',
  };
}

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
你是一个资深的《傲世传奇》游戏生态专家，负责对玩家聊天记录和充值数据进行客观分析。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【全局铁律——违反任何一条输出即视为无效】

A. 【禁止捏造】所有分析结论必须有且仅有原始数据作为依据。
   - 禁止推测、联想、脑补任何在聊天记录或充值表格中未出现的信息。
   - 禁止用"可能"、"应该"、"猜测"等词引出无数据支撑的判断。
   - 若某项无据可查，直接填写"数据中无记录"，不得填写任何推测性内容。

B. 【聊天与充值严格隔离分析】
   - 聊天分析（负面情绪、行为特征、语言风格）仅依据 Sheet1 聊天记录。
   - 充值分析（金额、频次、付费习惯）仅依据 Sheet2 充值数据。
   - 两个维度禁止交叉污染：不可用聊天内容推断充值金额，不可用充值行为捏造未发生的聊天情绪。
   - 玩家画像中 paymentHabits 字段只能来自充值数据，personality/gameHabits 只能来自聊天数据。

C. 【充值额度严格计算】
   - 必须逐行读取 Sheet2，对每位玩家的所有充值条目金额进行逐笔累加，不得估算、不得凑整、不得遗漏。
   - GS运营账号（背景信息中标注的GS角色、GS小号）不纳入任何充值统计，直接跳过，不生成其充值报告。
   - totalPaid 必须等于所有非GS玩家充值金额之和；单个玩家 totalPaid 必须等于该玩家所有充值条目之和。
   - 若充值数据中某玩家金额存疑或格式异常，在 conversionDetails 字段注明"数据存疑：[原始内容]"，不得擅自修正。

D. 【时间戳原文照搬】
   - 聊天上下文 context 中每条消息的 time 字段，必须原文照抄自 Sheet1 聊天记录，不可推算、不可估算、不可修改格式。
   - 若原文时间格式已是 "M月/D日/HH:mm"（如 4月/18日/18:33），直接复制；若原文格式不同，原样保留原文格式。
   - 若某条消息原文没有时间信息，time 字段填写 "原文无时间戳"，不得伪造时间。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 背景信息
${serverContext}

# 已有的重点玩家画像（之前的分析结论，可结合本次数据更新——仅更新有新数据支撑的字段）
${persistentPortraits || '暂无存量画像'}

# 参考案例库（生成GS处置方案时检索，有相似案例须明确引用）
${hotCasesStr || '暂无参考案例'}

# 待分析数据
## Sheet1：聊天记录
${chatData}

## Sheet2：充值数据
${rechargeData}

# 分析任务

## 任务一：识别重点玩家（仅基于 Sheet1 聊天数据 + Sheet2 充值数据，禁止凭空添加）
- 基于聊天活跃度、充值金额（来自Sheet2）、言论影响力，筛选1-3位最值得关注的玩家。
- GS账号不纳入重点玩家范围。

## 任务二：生成玩家画像（字段来源严格区分）
- paymentHabits：只能来自 Sheet2 充值数据。
- personality / gameHabits：只能来自 Sheet1 聊天行为。
- realLifePersona：只能来自聊天中明确透露的现实信息，无则填"数据中无记录"。
- summary：一句话（30字内），基于以上已填字段综合。

## 任务三：负面爆发核查（仅基于 Sheet1 聊天数据）
- 识别明确出现在聊天记录中的负面情绪/投诉/发泄行为。
- 溯源上下文 3-5 条消息：time 字段原文照抄，内容原文照抄，不做任何改写。
- 负面触发点：结合背景信息中的游戏机制进行归因，无法归因则填"需人工核实"。

## 任务四：GS处置建议
- 先检索参考案例库，有相似案例须注明"参考了案例[xxx]的处理逻辑"。
- 视角要求（强制）：以区服内老玩家身份与其交流，自然、真实、有人情味。
- 严禁客服腔：禁止"亲爱的玩家"、"感谢您的支持"、"我们会积极优化"等官方话术。
- 参考背景信息中 GS 人设与区服生态，确保语气风格符合角色设定。
- 每条负面爆发须生成：title（15字内案例标题）、tags（1-3个关键标签）、mergeStage（从聊天推断合服阶段，无法推断填"未知"）、caseBackground（3-5句话案例背景）、gsAdvice.resultEvaluation（预期处置效果）、gsAdvice.resultTags（1-2个结果标签，如"付费转化"、"流失挽回"、"关系维护"等）。

## 任务五：充值分析（仅基于 Sheet2 充值数据）
- 逐行累加每位玩家充值金额，GS账号跳过。
- 统计 totalPaid（全部玩家总额）、totalUnpaid（未付款订单总额，若无则为0）。
- 每位玩家 totalPaid 等于其所有条目累加值。
- 判定是否转端：依据充值记录中的渠道/平台字段，无相关字段则填 false 并在 conversionDetails 注明"充值数据中无转端字段"。

# 输出格式（严格JSON，不要任何 markdown 包裹）

{
  "identifiedKeyPlayers": ["玩家名1", "玩家名2"],
  "playerReports": [
    {
      "roleName": "玩家名",
      "portrait": {
        "paymentHabits": "来自Sheet2的付费习惯，无数据则填'数据中无记录'",
        "personality": "来自Sheet1的性格行为特征",
        "gameHabits": "来自Sheet1的游戏行为偏好",
        "realLifePersona": "来自聊天明确透露的现实信息，无则填'数据中无记录'",
        "summary": "一句话总结（30字内）"
      },
      "negativeOutbursts": [
        {
          "title": "案例标题（15字内）",
          "tags": ["标签1", "标签2"],
          "mergeStage": "从聊天推断合服阶段，无法推断填'未知'",
          "caseBackground": "3-5句话概述案例背景（仅基于聊天数据，不推测）",
          "trigger": "爆发负面的详细原因（仅基于聊天内容）",
          "triggerPoint": "具体触发点（结合游戏机制归因）",
          "context": [
            { "roleName": "发言人", "content": "原文消息内容", "time": "原文时间戳，无则填'原文无时间戳'" }
          ],
          "gsAdvice": {
            "action": "具体引导动作（分步列举，每步以序号开头）",
            "reason": "原因分析",
            "disposalPlan": "处置策略（分步骤说明整体思路）",
            "resultEvaluation": "预期处置效果或可能的案例结果",
            "resultTags": ["结果标签1", "结果标签2"]
          }
        }
      ]
    }
  ],
  "rechargeReport": {
    "totalPaid": 数字（所有非GS玩家充值额逐笔累加）,
    "totalUnpaid": 数字（无则为0）,
    "playerSummaries": [
      {
        "roleName": "玩家名（GS账号不出现在此列表）",
        "totalPaid": 数字（该玩家所有条目金额逐笔累加）,
        "isConverted": true或false,
        "conversionDetails": "转端判定依据或'充值数据中无转端字段'",
        "paymentHabits": "来自Sheet2的付费习惯描述"
      }
    ],
    "paymentProfile": "整体付费画像（只基于Sheet2数据）",
    "rechargeData": [{ "name": "金额挡位", "value": 数字 }]
  },
  "serverEcology": "区服生态总结约100字（只基于本次数据，不联想）"
}
`;

  const content = await chatCompletion(
    [{ role: 'user', content: prompt }],
    true
  );
  const raw = JSON.parse(content);
  return {
    identifiedKeyPlayers: raw.identifiedKeyPlayers ?? [],
    playerReports: (raw.playerReports ?? []).map((p: any) => ({
      ...p,
      negativeOutbursts: (p.negativeOutbursts ?? []).map((o: any) => ({
        ...o,
        context: o.context ?? [],
        tags: o.tags ?? [],
        gsAdvice: {
          ...o.gsAdvice,
          resultTags: o.gsAdvice?.resultTags ?? [],
        },
      })),
    })),
    rechargeReport: {
      totalPaid: raw.rechargeReport?.totalPaid ?? 0,
      totalUnpaid: raw.rechargeReport?.totalUnpaid ?? 0,
      playerSummaries: raw.rechargeReport?.playerSummaries ?? [],
      paymentProfile: raw.rechargeReport?.paymentProfile ?? '',
      rechargeData: raw.rechargeReport?.rechargeData ?? [],
    },
    serverEcology: raw.serverEcology ?? '',
  };
}
