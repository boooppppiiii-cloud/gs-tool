import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createRequire } from "module";
import { spawn } from "child_process";
import fs from "fs";

dotenv.config();

const require = createRequire(import.meta.url);

// CloudBase 服务端 SDK — 单次初始化，启动时调用 initAdminDb()
let _adminDb: any = null;
let _adminDbError: string = '未初始化';

function initAdminDb() {
  const secretId = process.env.CLOUDBASE_SECRET_ID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY;
  const envId = process.env.CLOUDBASE_ENV_ID;
  if (!secretId || !secretKey || !envId) {
    _adminDbError = '缺少环境变量：CLOUDBASE_SECRET_ID / CLOUDBASE_SECRET_KEY / CLOUDBASE_ENV_ID';
    console.warn('[AdminDB]', _adminDbError);
    return;
  }
  try {
    const mod = require('@cloudbase/node-sdk');
    // 兼容 CJS/ESM 互操作：模块导出可能挂在 .default 上
    const tcb = (mod?.default ?? mod) as any;
    const app = tcb.init({ secretId, secretKey, env: envId });
    _adminDb = app.database();
    _adminDbError = '';
    console.log('[AdminDB] CloudBase 服务端 SDK 初始化成功');
  } catch (e: any) {
    _adminDbError = String(e?.message || e);
    console.error('[AdminDB] CloudBase 服务端 SDK 初始化失败:', e);
  }
}

function getAdminDb() { return _adminDb; }
function getAdminDbError() { return _adminDbError || 'Admin SDK 未就绪'; }

process.on('unhandledRejection', (reason) => {
  console.error('[Server] 未处理的异步异常（已拦截，进程继续运行）:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastRes: Response | undefined;
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429) return res; // rate-limited — return immediately, let client handle retry
    if (res.status !== 503) return res;
    lastRes = res;
    if (i < retries) {
      const wait = (i + 1) * 15_000;
      console.log(`[Gemini] 503 过载，${wait / 1000}s 后重试 (${i + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  return lastRes!;
}

async function startServer() {
  initAdminDb();
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
      if (!response.ok) {
        if (response.status === 429) return res.status(429).json({ error: rawText, retryAfter: 65 });
        return res.status(safeStatus).json({ error: rawText });
      }
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
        return res.status(503).json({ error: `Admin SDK 未就绪: ${getAdminDbError()}` });
      }
      const result = await db.collection('usage_logs').limit(1000).get();
      const sorted = (result.data as any[]).sort((a, b) =>
        String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
      );
      res.json({ data: sorted });
    } catch (e: any) {
      console.error('[Admin Logs] 查询失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // 埋点日志写入端点（服务端 admin SDK 写入，绕过客户端 CORS）
  app.post('/api/analytics/log', async (req: any, res: any) => {
    try {
      const db = getAdminDb();
      if (!db) return res.status(503).json({ error: `Admin SDK 未就绪: ${getAdminDbError()}` });
      const log = req.body;
      await db.collection('usage_logs').add(log);
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[Analytics Write] 写入失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // 通用 CloudBase DB 代理（admin SDK，无 CORS，无安全规则限制）
  app.post('/api/db/upsert', async (req: any, res: any) => {
    try {
      const db = getAdminDb();
      if (!db) return res.status(503).json({ error: `Admin SDK 未就绪: ${getAdminDbError()}` });
      const { collection, id, data } = req.body;
      try {
        await db.collection(collection).add({ _id: id, ...data });
      } catch (e: any) {
        const code = String(e?.code || e?.message || '');
        if (code.includes('-502008') || code.toLowerCase().includes('duplicate') || code.toLowerCase().includes('exist')) {
          await db.collection(collection).doc(id).update(data);
        } else throw e;
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[DB upsert] 失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/db/update', async (req: any, res: any) => {
    try {
      const db = getAdminDb();
      if (!db) return res.status(503).json({ error: `Admin SDK 未就绪: ${getAdminDbError()}` });
      const { collection, id, data } = req.body;
      await db.collection(collection).doc(id).update(data);
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[DB update] 失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/db/delete', async (req: any, res: any) => {
    try {
      const db = getAdminDb();
      if (!db) return res.status(503).json({ error: `Admin SDK 未就绪: ${getAdminDbError()}` });
      const { collection, id } = req.body;
      await (db.collection(collection).doc(id) as any).remove();
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[DB delete] 失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/db/getAll', async (req: any, res: any) => {
    try {
      const db = getAdminDb();
      if (!db) return res.status(503).json({ error: `Admin SDK 未就绪: ${getAdminDbError()}` });
      const { collection, orderBy, limit: lim = 1000 } = req.body;
      let query: any = db.collection(collection);
      if (orderBy) query = query.orderBy(orderBy, 'asc');
      const result = await query.limit(lim).get();
      res.json({ data: result.data || [] });
    } catch (e: any) {
      console.error('[DB getAll] 失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/db/getDoc', async (req: any, res: any) => {
    try {
      const db = getAdminDb();
      if (!db) return res.status(503).json({ error: `Admin SDK 未就绪: ${getAdminDbError()}` });
      const { collection, id } = req.body;
      const result = await db.collection(collection).doc(id).get();
      res.json({ data: result.data ?? null });
    } catch (e: any) {
      console.error('[DB getDoc] 失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.post('/api/db/where', async (req: any, res: any) => {
    try {
      const db = getAdminDb();
      if (!db) return res.status(503).json({ error: `Admin SDK 未就绪: ${getAdminDbError()}` });
      const { collection, field, value } = req.body;
      const result = await db.collection(collection).where({ [field]: value }).limit(500).get();
      res.json({ data: result.data || [] });
    } catch (e: any) {
      console.error('[DB where] 失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // Image → chat extraction (Gemini Vision)
  app.post('/api/image/extract-chat', async (req: any, res: any) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body ?? {};
      if (!imageBase64) return res.status(400).json({ error: '缺少图片数据' });

      const prompt = `你是专业的游戏聊天记录识别助手。分析这张截图，判断属于哪种类型并提取信息。

类型A：游戏内聊天截图（传奇/傲世传奇等游戏界面，可见角色名和游戏聊天框）
类型B：微信/QQ等通讯软件聊天截图，或纯文字聊天记录截图

如果是类型A，输出：
{"type":"game","messages":[{"roleName":"角色名","content":"消息内容","chatType":"世界或区域或私聊或帮派"}]}

如果是类型B，输出：
{"type":"wechat","messages":[{"senderName":"发言者昵称","content":"消息内容"}],"uniqueSenders":["昵称1","昵称2"]}

只输出JSON，不要markdown代码块或任何说明文字。`;

      const geminiBody = {
        contents: [{ parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ]}],
        generationConfig: { responseMimeType: 'application/json' },
      };

      const model = 'gemini-2.5-flash';
      const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
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

      const data = await response.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      let result: unknown;
      try { result = JSON.parse(text); } catch { result = { error: '解析失败', raw: text.slice(0, 200) }; }
      res.json(result);
    } catch (e: any) {
      console.error('[Image Extract] 失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // Crawler session status + re-auth triggers
  const STATUS_FILE = path.join(__dirname, 'crawler', 'sessions', 'status.json');

  app.get('/api/crawler/session-status', (_req: any, res: any) => {
    try {
      res.json(JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')));
    } catch {
      res.json({ chat: 'ok', recharge: 'ok' });
    }
  });

  app.post('/api/crawler/collect-now', (req: any, res: any) => {
    const { serverName, ownerId } = req.body ?? {};
    try {
      const logPath = path.join(__dirname, 'crawler', 'sessions', 'crawl_last.log');
      fs.writeFileSync(logPath, `[${new Date().toISOString()}] Crawl started\n`, 'utf-8');
      const child = spawn('npm', ['run', 'crawler:now'], {
        cwd: __dirname,
        shell: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          CRAWL_HOURS: '10',
          ...(serverName ? { CRAWL_SERVER_NAME: String(serverName) } : {}),
          ...(ownerId    ? { CRAWL_OWNER_ID:    String(ownerId)    } : {}),
        },
      });
      child.unref();
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[Collect] 启动失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/crawler/last-log', (_req: any, res: any) => {
    const logPath = path.join(__dirname, 'crawler', 'sessions', 'crawl_last.log');
    try {
      res.json({ log: fs.readFileSync(logPath, 'utf-8') });
    } catch {
      res.json({ log: '(暂无运行日志)' });
    }
  });

  app.get('/api/crawler/auth-log/:backend', (req: any, res: any) => {
    const { backend } = req.params as { backend: string };
    if (backend !== 'chat' && backend !== 'recharge') return res.status(400).json({ error: 'invalid backend' });
    const logPath = path.join(__dirname, 'crawler', 'sessions', `auth_${backend}.log`);
    try {
      res.json({ log: fs.readFileSync(logPath, 'utf-8') });
    } catch {
      res.json({ log: '(暂无认证日志)' });
    }
  });

  app.post('/api/crawler/auth/:backend', (req: any, res: any) => {
    const { backend } = req.params as { backend: string };
    if (backend !== 'chat' && backend !== 'recharge') {
      return res.status(400).json({ error: 'invalid backend' });
    }
    try {
      const logPath = path.join(__dirname, 'crawler', 'sessions', `auth_${backend}.log`);
      fs.writeFileSync(logPath, `[${new Date().toISOString()}] 认证进程已启动，浏览器窗口即将弹出，请完成认证操作\n`, 'utf-8');
      const child = spawn('npm', ['run', `auth:${backend}`], {
        cwd: __dirname,
        shell: true,
        stdio: 'ignore',
      });
      child.unref();
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[Auth] 启动失败:', e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  app.get('/api/crawler/playwright-status', (req: any, res: any) => {
    const { execSync: execS } = require('child_process') as typeof import('child_process');

    // 1. where.exe — searches PATH + registered App Paths simultaneously
    for (const name of ['chrome.exe', 'msedge.exe']) {
      try {
        const out = (execS(`where ${name} 2>nul`, { encoding: 'utf-8' }) as string).trim();
        const firstLine = out.split('\n')[0].trim();
        if (firstLine && fs.existsSync(firstLine)) return res.json({ installed: true, execPath: firstLine });
      } catch {}
    }

    // 2. Registry — no stdio array so execSync reliably returns stdout
    const regKeys = [
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe',
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe',
    ];
    for (const key of regKeys) {
      try {
        const out = (execS(`reg query "${key}" /ve 2>nul`, { encoding: 'utf-8' }) as string);
        const match = out.match(/REG_SZ\s+(\S.+)/);
        const p = match?.[1]?.trim();
        if (p && fs.existsSync(p)) return res.json({ installed: true, execPath: p });
      } catch {}
    }

    // 3. Hardcoded paths
    const localAppData = process.env.LOCALAPPDATA || '';
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const candidates = [
      `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    ];
    const found = candidates.find(p => fs.existsSync(p));
    res.json({ installed: !!found, execPath: found });
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
