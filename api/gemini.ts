export const config = { maxDuration: 60 };

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastRes: Response | undefined;
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, options);
    if (res.status !== 503 && res.status !== 429) return res;
    lastRes = res;
    if (i < retries) {
      const wait = (i + 1) * 3000;
      await new Promise(r => setTimeout(r, wait));
    }
  }
  return lastRes!;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { messages = [], model = 'gemini-2.0-flash', stream, response_format } = req.body;

    const systemMsg = messages.find((m: any) => m.role === 'system');
    const chatMessages = messages.filter((m: any) => m.role !== 'system');

    const contents = chatMessages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const geminiBody: any = { contents };
    if (systemMsg) geminiBody.systemInstruction = { parts: [{ text: systemMsg.content }] };
    if (response_format?.type === 'json_object') geminiBody.generationConfig = { responseMimeType: 'application/json' };

    if (stream) {
      const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`;
      const response = await fetchWithRetry(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      });
      if (!response.ok) {
        const errText = await response.text();
        const safeStatus = response.status >= 100 && response.status <= 599 ? response.status : 502;
        return res.status(safeStatus).json({ error: errText });
      }
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const reader = (response.body as any).getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;
          try {
            const chunk = JSON.parse(line.slice(6));
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
          } catch {}
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetchWithRetry(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
    const rawText = await response.text();
    const safeStatus = response.status >= 100 && response.status <= 599 ? response.status : 502;
    if (!response.ok) return res.status(safeStatus).json({ error: rawText });
    const data = JSON.parse(rawText);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ choices: [{ message: { content: text, role: 'assistant' } }] });
  } catch (err) {
    console.error('[Gemini] 错误:', err);
    if (!res.headersSent) res.status(502).json({ error: 'Gemini 代理请求失败', detail: String(err) });
  }
}
