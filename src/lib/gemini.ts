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
  const prompt = `你是一个游戏运营质量审计专家，负责核验生态（游戏运营人员）的工单执行质量。

【原始负面事件】
事件标题：${outburstTitle}
负面触发点：${outburstTrigger}

【AI建议的生态处置动作】
${gsAdviceAction}

【生态实际执行记录】
分类：${category}
执行描述：${executionDescription || '（无描述）'}

请从以下四个维度进行综合质检，严格返回JSON对象（不要markdown包裹）：
{
  "summary": "执行情况一句话摘要（30字内）",
  "consistencyCheck": "生态实际执行与建议方案的一致性评估（50字内）",
  "reasonabilityCheck": "处置策略合理性与适当性评估（50字内）",
  "riskPoints": "识别到的疑点、风险或改进建议（50字内，无风险填'暂无明显风险'）",
  "rating": "综合评级，只能是以下四者之一：优/良/需改进/存在问题"
}`;

  const { content } = await chatCompletion([{ role: 'user', content: prompt }], true);
  const raw = JSON.parse(content);
  return {
    summary: raw.summary ?? '',
    consistencyCheck: raw.consistencyCheck ?? '',
    reasonabilityCheck: raw.reasonabilityCheck ?? '',
    riskPoints: raw.riskPoints ?? '',
    rating: raw.rating ?? '良',
  };
}

export async function generateCaseSummary(params: {
  playerName: string;
  outburstTrigger: string;
  triggerPoint: string;
  contextText: string;
  executionDescription: string;
  executionReflection: string;
  disposalPlan: string;
}): Promise<{ title: string; outburstReason: string; summary: string; reflection: string }> {
  const prompt = `你是一个游戏运营案例撰写专家，帮助生态将一次负面事件处置过程整理为可复用的案例经验。

【玩家及负面事件】
玩家：${params.playerName}
负面原因：${params.outburstTrigger}
触发点：${params.triggerPoint}

【聊天上下文片段】
${params.contextText || '（无）'}

【生态执行记录】
执行描述：${params.executionDescription || '（无）'}
复盘反思：${params.executionReflection || '（无）'}

【AI建议处置方案】
${params.disposalPlan || '（无）'}

请根据以上信息，严格返回JSON（不要markdown包裹）：
{
  "title": "案例标题，15字以内，精炼概括事件与处置结果",
  "outburstReason": "负面原因精炼摘要，50字以内",
  "summary": "经验总结：本次处置的核心策略与成效，100字以内",
  "reflection": "复盘反思：下次遇到类似情况可以改进的点，100字以内"
}`;

  const { content } = await chatCompletion([{ role: 'user', content: prompt }], true);
  const raw = JSON.parse(content);
  return {
    title: raw.title ?? '',
    outburstReason: raw.outburstReason ?? params.outburstTrigger,
    summary: raw.summary ?? '',
    reflection: raw.reflection ?? '',
  };
}

async function chatCompletion(
  messages: { role: string; content: string }[],
  jsonMode = false
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
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
    if (res.status === 429) {
      let body: any = {};
      try { body = await res.json(); } catch {}
      const errStr = typeof body.error === 'string' ? body.error : JSON.stringify(body.error ?? '');
      const isDaily = /DAILY|daily|per day|quota_exceeded/i.test(errStr);
      throw new Error(isDaily ? '__DAILY_QUOTA__' : '__RATE_LIMIT__');
    }
    if (res.status === 503) {
      throw new Error('__OVERLOAD__');
    }
    const err = await res.text();
    throw new Error(`Gemini API 错误: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

export async function analyzeGameEcology(
  serverContext: string,
  chatData: string,
  rechargeData: string,
  referenceCases: AnalysisCase[] = [],
  persistentPortraits: string = "",
  historicalContext: string = ""
): Promise<AnalysisResult> {
  const hotCasesStr = referenceCases.map(c =>
    `案例[${c.title}]: 玩家爆发负面原因:${c.outburstReason}, 生态具体处置动作:${c.gsAction}, 案例结果:${c.caseResult}`
  ).join('\n');

  const historicalSection = historicalContext
    ? `# 该区服历史分析摘要（仅供参考，不可与本次数据混用，不得将历史事件归入本次结论）\n${historicalContext}\n\n`
    : '';

  const prompt = `
你是一个资深的《傲世传奇》游戏生态专家，负责对玩家聊天记录和充值数据进行客观分析。

${historicalSection}

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
   - 生态运营账号（背景信息中标注的生态角色、生态小号）不纳入任何充值统计，直接跳过，不生成其充值报告。
   - totalPaid 必须等于所有非生态玩家充值金额之和；单个玩家 totalPaid 必须等于该玩家所有充值条目之和。
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

# 参考案例库（生成生态处置方案时检索，有相似案例须明确引用）
${hotCasesStr || '暂无参考案例'}

# 待分析数据
## Sheet1：聊天记录
${chatData}

## Sheet2：充值数据
${rechargeData}

# 分析任务

## 任务一：识别重点玩家（仅基于 Sheet1 聊天数据 + Sheet2 充值数据，禁止凭空添加）
- 基于聊天活跃度、充值金额（来自Sheet2）、言论影响力，筛选1-3位最值得关注的玩家。
- 生态账号不纳入重点玩家范围。

## 任务二：重点玩家结构化画像分析

**重点玩家提取标准：开服三天内充值达500元**（结合背景信息中开服日期与Sheet2充值数据判断，isKeyPlayer=true；未达标则 isKeyPlayer=false）。

对每位玩家同时输出两套画像：

### 2A. 基础兼容画像（portrait，来源规则不变）
- paymentHabits：只能来自 Sheet2 充值数据。
- personality / gameHabits：只能来自 Sheet1 聊天行为。
- realLifePersona：只能来自聊天中明确透露的现实信息，无则填"数据中无记录"。
- summary：一句话（30字内），基于以上已填字段综合。

### 2B. 结构化画像表格（portraitTable）

**数据版基础信息**（只能从已有数据中提取，不推断）：
- totalRecharge：从Sheet2逐笔累加该玩家历史总充值
- recentActivity：近7日充值活跃度描述（无充值数据填"数据中无记录"）
- anomalySignals：近期是否有异常资源抛售/频繁下线/负面退游情绪（基于Sheet1，无则填"未检测到异常信号"）

**三个维度（每个词条必须单独判断是否有数据支撑）**：

维度一：现实属性（职业/年龄/居住地/家庭情况/收入水平来自Sheet1聊天；游戏消费水平仅来自Sheet2）
①职业（从聊天中提取，无则obtained=false）
②年龄（从聊天内容推断，无则obtained=false）
③居住地（从聊天中明确提及的地名/方言/时区线索提取，无则obtained=false）
④家庭情况（从聊天中明确透露的家庭信息提取，无则obtained=false）
⑤收入水平（从聊天内容推断，不得用充值金额代替，无则obtained=false）
⑥游戏消费水平（仅来自Sheet2充值记录，无充值数据则obtained=false）
⑦兴趣爱好（从聊天中提及的游戏外爱好/话题提取，无则obtained=false）
⑧性格（从聊天行为/言辞风格综合判断，无则obtained=false）

维度二：游戏行为（只能来自Sheet1聊天数据）
①游玩时间（从聊天时间规律分析活跃时段，无则obtained=false）
②活动参与态度（主动发起/积极响应/消极回避等，从聊天中提取，无则obtained=false）
③游戏状态（战力/段位/装备进度等，从聊天内容提取，无则obtained=false）
④话术风格（沟通语气/习惯用词/表达方式，从聊天内容提取，无则obtained=false）

维度三：游玩心理（对抗风格/消费偏好来自数据，消费意向仅来自聊天）
①对抗风格（从PK/战场/仇恨言论中提取，如主动挑衅/被动应战/战略型等，无则obtained=false）
②消费偏好（仅从Sheet2充值记录分析消费品类/节点偏好，无则obtained=false）
③消费意向（仅从Sheet1聊天记录诊断：玩家是否曾透露对付费道具的购买意向？有则obtained=true，value格式"有意向购买[道具名]"，evidence填原话；无则obtained=false，value="数据中无记录"）
④敏感点（从聊天中明确表达的反感/投诉提取，无则obtained=false）

铁律：每个词条 value 只填数据中有据可查的内容；无数据支撑则 obtained=false，value="数据中无记录"，evidence=""。completionRate = 该维度中 obtained=true 的词条数 ÷ 总词条数（保留两位小数）。维度一共8条，维度二共4条，维度三共4条。

tableSummary：综合三个维度中所有 obtained=true 的词条，用一句话（40字内）提炼该玩家最关键的3-4个标签（例："40岁教师，晚间活跃，有意向购买封神武器，对PK挑衅敏感"）。无任何 obtained=true 词条时填"数据不足，暂无总结"。

## 任务三：负面爆发核查（覆盖全部玩家，仅基于 Sheet1 聊天数据）
- 对 Sheet1 聊天记录中**所有出现过的玩家**（不限于 identifiedKeyPlayers）逐一排查负面情绪/投诉/发泄/质疑/争执行为。
- 只要聊天中出现下列任一信号，即视为负面爆发：明确投诉、辱骂或发泄情绪、对外挂/不公平/Bug的质疑、对游戏机制的强烈抱怨、与其他玩家的冲突争执。
- 每条负面事件输出到顶层 allNegativeOutbursts 数组（独立于 playerReports，覆盖全部玩家）。
- 溯源上下文 3-5 条消息：time 字段原文照抄，内容原文照抄，不做任何改写。
- 负面触发点：结合背景信息中的游戏机制进行归因，无法归因则填"需人工核实"。
- 若所有玩家聊天均无以上信号，allNegativeOutbursts 输出空数组 []。

## 任务四：生态处置建议
- 先检索参考案例库，有相似案例须注明"参考了案例[xxx]的处理逻辑"。
- 视角要求（强制）：以区服内老玩家身份与其交流，自然、真实、有人情味。
- 严禁客服腔：禁止"亲爱的玩家"、"感谢您的支持"、"我们会积极优化"等官方话术。
- 参考背景信息中生态人设与区服生态，确保语气风格符合角色设定。
- 每条负面爆发须生成：title（15字内案例标题）、tags（1-3个关键标签）、mergeStage（从聊天推断合服阶段，无法推断填"未知"）、caseBackground（3-5句话案例背景）、gsAdvice.resultEvaluation（预期处置效果）、gsAdvice.resultTags（1-2个结果标签，如"付费转化"、"流失挽回"、"关系维护"等）。

## 任务五：充值分析（仅基于 Sheet2 充值数据）
- 逐行累加每位玩家充值金额，生态账号跳过。
- 统计 totalPaid（全部玩家总额）、totalUnpaid（未付款订单总额，若无则为0）。
- 每位玩家 totalPaid 等于其所有条目累加值。
- 判定是否转端：依据充值记录中的渠道/平台字段，无相关字段则填 false 并在 conversionDetails 注明"充值数据中无转端字段"。

## 任务六：聊天话题摘要（仅基于 Sheet1 聊天数据）
- 提炼本次聊天中出现的 3-8 个话题，每条 15 字内，用简短短句表达（如"讨论合服后装备被削"、"争论行会名额分配"）。
- 只基于聊天数据中明确讨论的内容，禁止推测。

## 任务七：生态维护质量分析（仅基于 Sheet1 聊天数据）

生态角色名已在背景信息中标注（"角色名:xxx"），以此识别生态在聊天中的发言。

### 沟通类型判定规则
- **主动沟通**：①生态作为言论发起方；②高价值玩家作为承接方；③双方发言存在语义关联。
- **被动沟通**：①生态作为承接方；②核心玩家作为发起方；③双方发言存在语义关联。
- **不良沟通**：①生态作为发起方；②沟通频道为私聊（type字段含"私聊"或target字段指向特定玩家）；③高价值用户无承接回应。

### 沟通单位计数规则
当双方语义关联由存在转为消失（即话题转移或一方停止回应），本次沟通记为1个单位。不良沟通直接按次数计，无需等待语义消失。

### 沟通内容分类
- **游戏内沟通**：双方讨论装备/战力/游戏道具/游戏活动/充值活动/行会秩序。
- **游戏外沟通**：谈论游戏外的生活话题。

### 负面介入核查
- 若某玩家存在负面爆发，检查生态与该玩家是否存在与该负面事件语义相关的互动记录。有则 hasIntervened=true，无则 false。
- 无负面爆发的玩家：interventionSummary 填"无负面工单"，hasIntervened 填 false。

### 覆盖范围
对 identifiedKeyPlayers 中的每位玩家生成一条记录。若某玩家与生态完全没有互动，各计数填0。

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
      "portraitTable": {
        "isKeyPlayer": true或false,
        "basicData": {
          "totalRecharge": 数字,
          "recentActivity": "近7日充值活跃度",
          "anomalySignals": "异常信号描述或'未检测到异常信号'"
        },
        "dimensions": [
          {
            "name": "维度一：现实属性",
            "completionRate": 已获取条目数/8,
            "items": [
              { "label": "职业", "value": "提取内容或'数据中无记录'", "evidence": "依据原文或''", "obtained": true或false },
              { "label": "年龄", "value": "...", "evidence": "...", "obtained": true或false },
              { "label": "居住地", "value": "...", "evidence": "...", "obtained": true或false },
              { "label": "家庭情况", "value": "...", "evidence": "...", "obtained": true或false },
              { "label": "收入水平", "value": "从聊天推断，不得用充值金额代替，无则填'数据中无记录'", "evidence": "...", "obtained": true或false },
              { "label": "游戏消费水平", "value": "仅来自充值记录（Sheet2）", "evidence": "...", "obtained": true或false },
              { "label": "兴趣爱好", "value": "...", "evidence": "...", "obtained": true或false },
              { "label": "性格", "value": "...", "evidence": "...", "obtained": true或false }
            ]
          },
          {
            "name": "维度二：游戏行为",
            "completionRate": 已获取条目数/4,
            "items": [
              { "label": "游玩时间", "value": "活跃时段", "evidence": "...", "obtained": true或false },
              { "label": "活动参与态度", "value": "...", "evidence": "...", "obtained": true或false },
              { "label": "游戏状态", "value": "战力/段位/装备进度等", "evidence": "...", "obtained": true或false },
              { "label": "话术风格", "value": "...", "evidence": "...", "obtained": true或false }
            ]
          },
          {
            "name": "维度三：游玩心理",
            "completionRate": 已获取条目数/4,
            "items": [
              { "label": "对抗风格", "value": "...", "evidence": "...", "obtained": true或false },
              { "label": "消费偏好", "value": "仅从充值记录（Sheet2）分析消费品类/节点偏好", "evidence": "...", "obtained": true或false },
              { "label": "消费意向", "value": "有意向购买[道具名]（原话依据） 或 '数据中无记录'", "evidence": "原话摘录", "obtained": true或false },
              { "label": "敏感点", "value": "...", "evidence": "...", "obtained": true或false }
            ]
          }
        ],
        "overallCompletion": 0.67,
        "tableSummary": "一句话总结（40字内），综合已获取词条的核心标签"
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
    "totalPaid": 数字（所有非生态玩家充值额逐笔累加）,
    "totalUnpaid": 数字（无则为0）,
    "playerSummaries": [
      {
        "roleName": "玩家名（生态账号不出现在此列表）",
        "totalPaid": 数字（该玩家所有条目金额逐笔累加）,
        "isConverted": true或false,
        "conversionDetails": "转端判定依据或'充值数据中无转端字段'",
        "paymentHabits": "来自Sheet2的付费习惯描述"
      }
    ],
    "paymentProfile": "整体付费画像（只基于Sheet2数据）",
    "rechargeData": [{ "name": "金额挡位", "value": 数字 }]
  },
  "serverEcology": "区服生态总结约100字（只基于本次数据，不联想）",
  "chatTopics": ["话题简句1", "话题简句2"],
  "gsCommunicationReports": [
    {
      "roleName": "玩家名",
      "activeCount": 主动沟通单位数（整数，无互动填0）,
      "passiveCount": 被动沟通单位数（整数，无互动填0）,
      "badCount": 不良沟通次数（整数，无不良沟通填0）,
      "contentTypes": {
        "inGame": 游戏内沟通单位数（整数）,
        "outGame": 游戏外沟通单位数（整数）
      },
      "hasIntervened": true或false,
      "interventionSummary": "一句话描述生态介入情况（无负面工单填'无负面工单'；有负面但无介入填'未发现介入记录'；有介入则描述介入方式）"
    }
  ],
  "allNegativeOutbursts": [
    {
      "playerName": "发生负面的玩家名（来自聊天记录中的任意玩家）",
      "title": "案例标题（15字内）",
      "tags": ["标签1", "标签2"],
      "mergeStage": "从聊天推断合服阶段，无法推断填'未知'",
      "caseBackground": "3-5句话案例背景（仅基于聊天数据）",
      "trigger": "爆发负面的详细原因",
      "triggerPoint": "具体触发点（结合游戏机制归因）",
      "context": [
        { "roleName": "发言人", "content": "原文消息内容", "time": "原文时间戳，无则填'原文无时间戳'" }
      ],
      "gsAdvice": {
        "action": "具体引导动作（分步列举，每步以序号开头）",
        "reason": "原因分析",
        "disposalPlan": "处置策略",
        "resultEvaluation": "预期处置效果",
        "resultTags": ["结果标签1"]
      }
    }
  ]
}
`;

  const { content, inputTokens, outputTokens } = await chatCompletion(
    [{ role: 'user', content: prompt }],
    true
  );
  const raw = JSON.parse(content);
  return {
    _usage: { inputTokens, outputTokens },
    identifiedKeyPlayers: raw.identifiedKeyPlayers ?? [],
    playerReports: (raw.playerReports ?? []).map((p: any) => {
      const pt = p.portraitTable;
      const parsedPortraitTable = pt ? {
        isKeyPlayer: pt.isKeyPlayer ?? false,
        basicData: {
          totalRecharge: pt.basicData?.totalRecharge ?? 0,
          recentActivity: pt.basicData?.recentActivity ?? '数据中无记录',
          anomalySignals: pt.basicData?.anomalySignals ?? '未检测到异常信号',
        },
        dimensions: (pt.dimensions ?? []).map((d: any) => ({
          name: d.name ?? '',
          completionRate: d.completionRate ?? 0,
          items: (d.items ?? []).map((item: any) => ({
            label: item.label ?? '',
            value: item.value ?? '数据中无记录',
            evidence: item.evidence ?? '',
            obtained: item.obtained ?? false,
          })),
        })),
        overallCompletion: pt.overallCompletion ?? 0,
        tableSummary: pt.tableSummary ?? '',
      } : undefined;

      return {
        ...p,
        portraitTable: parsedPortraitTable,
        negativeOutbursts: (p.negativeOutbursts ?? []).map((o: any) => ({
          ...o,
          context: o.context ?? [],
          tags: o.tags ?? [],
          gsAdvice: {
            ...o.gsAdvice,
            resultTags: o.gsAdvice?.resultTags ?? [],
          },
        })),
      };
    }),
    rechargeReport: {
      totalPaid: raw.rechargeReport?.totalPaid ?? 0,
      totalUnpaid: raw.rechargeReport?.totalUnpaid ?? 0,
      playerSummaries: raw.rechargeReport?.playerSummaries ?? [],
      paymentProfile: raw.rechargeReport?.paymentProfile ?? '',
      rechargeData: raw.rechargeReport?.rechargeData ?? [],
    },
    serverEcology: raw.serverEcology ?? '',
    chatTopics: raw.chatTopics ?? [],
    gsCommunicationReports: (raw.gsCommunicationReports ?? []).map((r: any) => ({
      roleName: r.roleName ?? '',
      activeCount: r.activeCount ?? 0,
      passiveCount: r.passiveCount ?? 0,
      badCount: r.badCount ?? 0,
      contentTypes: { inGame: r.contentTypes?.inGame ?? 0, outGame: r.contentTypes?.outGame ?? 0 },
      hasIntervened: r.hasIntervened ?? false,
      interventionSummary: r.interventionSummary ?? '',
    })),
    allNegativeOutbursts: (raw.allNegativeOutbursts ?? []).map((o: any) => ({
      playerName: o.playerName ?? '',
      title: o.title,
      tags: o.tags ?? [],
      mergeStage: o.mergeStage,
      caseBackground: o.caseBackground,
      trigger: o.trigger ?? '',
      triggerPoint: o.triggerPoint ?? '',
      context: (o.context ?? []).map((c: any) => ({
        roleName: c.roleName ?? '',
        content: c.content ?? '',
        time: c.time ?? '原文无时间戳',
      })),
      gsAdvice: {
        action: o.gsAdvice?.action ?? '',
        reason: o.gsAdvice?.reason ?? '',
        disposalPlan: o.gsAdvice?.disposalPlan ?? '',
        resultEvaluation: o.gsAdvice?.resultEvaluation,
        resultTags: o.gsAdvice?.resultTags ?? [],
      },
    })),
  };
}
