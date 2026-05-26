import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createRequire } from "module";

dotenv.config();

const require = createRequire(import.meta.url);

// 懒初始化 CloudBase 服务端 SDK（仅在配置了凭证时可用）
function getAdminDb() {
  const secretId = process.env.CLOUDBASE_SECRET_ID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY;
  const envId = process.env.CLOUDBASE_ENV_ID;
  if (!secretId || !secretKey || !envId) return null;
  try {
    const tcb = require('@cloudbase/node-sdk');
    const app = tcb.init({ secretId, secretKey, env: envId });
    return app.database();
  } catch (e) {
    console.warn('[AdminDB] CloudBase 服务端 SDK 初始化失败:', e);
    return null;
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('[Server] 未处理的异步异常（已拦截，进程继续运行）:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastRes: Response | undefined;
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, options);
    if (res.status !== 503 && res.status !== 429) return res;
    lastRes = res;
    if (i < retries) {
      const wait = (i + 1) * 3000;
      console.log(`[Gemini] ${res.status}，${wait / 1000}s 后重试 (${i + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  return lastRes!;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '50mb' }));

  // Coze API 反向代理（解决浏览器 CORS 跨域问题，支持流式 SSE）
  app.use('/api/coze', async (req: any, res: any) => {
    const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const targetUrl = `https://api.coze.cn${req.path}${queryString}`;
    console.log(`[Coze Proxy] ${req.method} ${targetUrl}`);
    try {
      const fetchOptions: RequestInit = {
        method: req.method,
        headers: {
          Authorization: `Bearer ${process.env.COZE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOptions.body = JSON.stringify(req.body);
      }
      const response = await fetch(targetUrl, fetchOptions);

      // 流式 SSE（stream: true 时直接管道透传）
      if (req.body?.stream === true) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const reader = (response.body as any).getReader();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(value);
          pump();
        };
        pump();
        return;
      }

      const rawText = await response.text();
      const safeStatus = response.status >= 100 && response.status <= 599 ? response.status : 502;
      console.log(`[Coze Proxy] status=${response.status} body=${rawText.slice(0, 300)}`);
      let parsed: unknown;
      try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }
      if (!res.headersSent) res.status(safeStatus).json(parsed);
    } catch (err) {
      console.error('[Coze Proxy] 网络错误:', err);
      if (!res.headersSent) res.status(502).json({ error: 'Coze 代理请求失败', detail: String(err) });
    }
  });

  // Gemini 原生 REST API 代理（在代理层将 OpenAI 格式转换为 Gemini 格式，客户端代码无需改动）
  app.use('/api/gemini', async (req: any, res: any) => {
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
        console.log(`[Gemini Stream] POST ${model}:streamGenerateContent`);
        const response = await fetchWithRetry(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) });
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
      console.log(`[Gemini] POST ${model}:generateContent`);
      const response = await fetchWithRetry(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) });
      const rawText = await response.text();
      const safeStatus = response.status >= 100 && response.status <= 599 ? response.status : 502;
      console.log(`[Gemini] status=${response.status} body=${rawText.slice(0, 200)}`);
      if (!response.ok) return res.status(safeStatus).json({ error: rawText });
      const data = JSON.parse(rawText);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      res.json({
        choices: [{ message: { content: text, role: 'assistant' } }],
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount ?? 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        },
      });
    } catch (err) {
      console.error('[Gemini] 网络错误:', err);
      if (!res.headersSent) res.status(502).json({ error: 'Gemini 代理请求失败', detail: String(err) });
    }
  });

  // 管理员日志查询端点（服务端权限，全量不过滤）
  app.get('/api/admin/logs', async (req: any, res: any) => {
    try {
      const db = getAdminDb();
      if (!db) {
        return res.status(503).json({ error: 'Admin SDK 未配置，请在 .env 中设置 CLOUDBASE_SECRET_ID 和 CLOUDBASE_SECRET_KEY' });
      }
      const result = await db
        .collection('usage_logs')
        .orderBy('timestamp', 'desc')
        .limit(1000)
        .get();
      res.json({ data: result.data });
    } catch (e: any) {
      console.error('[Admin Logs] 查询失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
