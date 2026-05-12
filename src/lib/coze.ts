const COZE_BASE_URL = '/api/coze';
const COZE_ANALYSIS_BOT_ID = process.env.COZE_ANALYSIS_BOT_ID;
const COZE_SEARCH_BOT_ID = process.env.COZE_SEARCH_BOT_ID;

// 剔除 Coze 返回结果里的 Markdown 格式字符，保留纯数据文本
function cleanCozeResponse(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').replace(/```/g, '').trim())
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 判断返回内容是否表示"未找到"
function isNotFound(text: string): boolean {
  const notFoundPatterns = [
    /未找到/,
    /没有找到/,
    /无法找到/,
    /暂无.*数据/,
    /不存在/,
    /没有.*相关/,
    /未收录/,
    /no.*result/i,
    /not.*found/i,
  ];
  const cleaned = text.trim();
  if (cleaned.length < 10) return true;
  return notFoundPatterns.some((p) => p.test(cleaned));
}

// 调用 Coze Bot（非流式，带轮询）
async function callCozeBotAsync(botId: string, userMessage: string): Promise<string> {
  if (!botId) {
    throw new Error('Coze Bot ID 未配置，请检查 .env 文件');
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  // 1. 创建对话
  const chatRes = await fetch(`${COZE_BASE_URL}/v3/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      bot_id: botId,
      user_id: 'aosichuanqi_gs_tool',
      stream: false,
      auto_save_history: true,
      additional_messages: [{ role: 'user', content: userMessage, content_type: 'text' }],
    }),
  });

  if (!chatRes.ok) {
    throw new Error(`Coze 创建对话失败: ${chatRes.status} ${chatRes.statusText}`);
  }

  const chatData = await chatRes.json();
  if (chatData.code !== 0) {
    throw new Error(`Coze 接口错误: ${chatData.msg}`);
  }

  const chatId = chatData.data.id;
  const conversationId = chatData.data.conversation_id;

  // 2. 轮询 retrieve 直到状态为 completed（最多 90 秒，容错非 200 的瞬态响应）
  const maxAttempts = 90;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const retrieveRes = await fetch(
      `${COZE_BASE_URL}/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`,
      { headers, method: 'GET' }
    );

    if (!retrieveRes.ok) continue; // 瞬态错误（如 515），继续等待

    const retrieveData = await retrieveRes.json();
    if (retrieveData.code !== 0) continue;

    const status = retrieveData.data?.status;
    if (status === 'failed' || status === 'requires_action') {
      throw new Error(`Coze 对话异常: ${status}`);
    }
    if (status === 'completed') break;
    // in_progress 或其他：继续轮询
  }

  // 3. 获取消息列表，提取 assistant 的 answer
  const msgRes = await fetch(
    `${COZE_BASE_URL}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
    { headers, method: 'GET' }
  );

  if (!msgRes.ok) {
    throw new Error(`Coze 获取消息失败: ${msgRes.status}`);
  }

  const msgData = await msgRes.json();
  const messages: Array<{ role: string; type: string; content: string }> = msgData.data || [];
  const answer = messages.find((m) => m.role === 'assistant' && m.type === 'answer');

  if (!answer?.content) {
    throw new Error('Coze 未返回有效回复');
  }

  return answer.content;
}

// 深度分析：对大量聊天数据或报表进行深度归纳
export async function analyzeWithCoze(data: string): Promise<string> {
  const prompt = `请对以下数据进行深度归纳分析，输出结构化结论：\n\n${data}`;
  const raw = await callCozeBotAsync(COZE_ANALYSIS_BOT_ID!, prompt);
  return cleanCozeResponse(raw);
}

// 知识库绝对检索：查到什么输出什么，查不到输出"未找到数据"
export async function searchKnowledgeBase(keyword: string): Promise<string> {
  const prompt = `检索关键词：${keyword}\n\n要求：直接输出该词条的数据内容，不要任何解释或废话。若知识库中不存在该词条，只输出：未找到数据`;
  const raw = await callCozeBotAsync(COZE_SEARCH_BOT_ID!, prompt);
  const cleaned = cleanCozeResponse(raw);
  return isNotFound(cleaned) ? '未找到数据' : cleaned;
}

// 流式知识库检索：第一个字符约 1-2 秒出现，无需等待全文完成
export async function searchKnowledgeBaseStream(
  keyword: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const prompt = `检索关键词：${keyword}\n\n要求：直接输出该词条的数据内容，不要任何解释或废话。若知识库中不存在该词条，只输出：未找到数据`;

  const res = await fetch(`${COZE_BASE_URL}/v3/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bot_id: COZE_SEARCH_BOT_ID,
      user_id: 'aosichuanqi_gs_tool',
      stream: true,
      additional_messages: [{ role: 'user', content: prompt, content_type: 'text' }],
    }),
  });

  if (!res.ok) throw new Error(`Coze 流式请求失败: ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let lastEvent = '';
  let fullContent = '';
  let completedContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('event:')) {
        lastEvent = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:') && !trimmed.endsWith('[DONE]')) {
        try {
          const data = JSON.parse(trimmed.slice(5).trim());
          if (lastEvent === 'conversation.message.delta' && data.content) {
            // 不过滤 type，只要 delta 有 content 就累加
            fullContent += data.content;
            onChunk(data.content);
          } else if (lastEvent === 'conversation.message.completed' && data.content) {
            // delta 为空时的兜底：completed 事件携带完整文本
            completedContent = data.content;
          }
        } catch { /* ignore parse errors */ }
      }
    }
  }

  const raw = fullContent || completedContent;
  const cleaned = cleanCozeResponse(raw);
  return isNotFound(cleaned) ? '未找到数据' : cleaned;
}

export { cleanCozeResponse, isNotFound };
