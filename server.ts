import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createRequire } from "module";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import { createClient as createChClient } from "@clickhouse/client";

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

interface JobData {
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: { choices: any[]; usage: any };
  error?: { status: number; body: string };
  createdAt: number;
  queuePosition: number;
}
const jobStore = new Map<string, JobData>();
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobStore.entries()) {
    if (job.createdAt < cutoff) jobStore.delete(id);
  }
}, 5 * 60 * 1000);

class GeminiQueue {
  private queue: Array<{ fn: () => Promise<Response>; resolve: (v: Response) => void; reject: (e: unknown) => void; jobId?: string }> = [];
  private processing = false;
  private lastCallTime = 0;
  private readonly minInterval = 7000; // 7s间隔 ≈ 8.5 RPM，低于免费层10 RPM限制

  get queueLength() { return this.queue.length + (this.processing ? 1 : 0); }

  add(fn: () => Promise<Response>, jobId?: string): Promise<Response> {
    return new Promise((resolve, reject) => {
      if (jobId) {
        const job = jobStore.get(jobId);
        if (job) job.queuePosition = this.queueLength;
      }
      this.queue.push({ fn, resolve, reject, jobId });
      if (!this.processing) this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.queue.length === 0) { this.processing = false; return; }
    this.processing = true;
    this.queue.forEach((item, i) => {
      if (item.jobId) { const job = jobStore.get(item.jobId); if (job) job.queuePosition = i + 1; }
    });
    const wait = Math.max(0, this.lastCallTime + this.minInterval - Date.now());
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const item = this.queue.shift()!;
    if (item.jobId) { const job = jobStore.get(item.jobId); if (job) { job.status = 'processing'; job.queuePosition = 0; } }
    this.lastCallTime = Date.now();
    try { item.resolve(await item.fn()); } catch (e) { item.reject(e); }
    this.process();
  }
}
const geminiQueue = new GeminiQueue();

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
        const response = await geminiQueue.add(() => fetchWithRetry(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }));
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

      // 异步任务模式：立即返回 jobId，后台入队处理
      if (req.body.async === true) {
        const jobId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        jobStore.set(jobId, { status: 'pending', createdAt: Date.now(), queuePosition: geminiQueue.queueLength });
        console.log(`[Gemini Async] 任务 ${jobId} 入队 (队列长度: ${geminiQueue.queueLength})`);
        geminiQueue.add(() => fetchWithRetry(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }), jobId)
          .then(async (response) => {
            const job = jobStore.get(jobId); if (!job) return;
            const rawText = await response.text();
            if (!response.ok) { job.status = 'error'; job.error = { status: response.status, body: rawText.slice(0, 300) }; return; }
            const data = JSON.parse(rawText);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            job.result = { choices: [{ message: { content: text, role: 'assistant' } }], usage: { prompt_tokens: data.usageMetadata?.promptTokenCount ?? 0, completion_tokens: data.usageMetadata?.candidatesTokenCount ?? 0 } };
            job.status = 'done';
            console.log(`[Gemini Async] 任务 ${jobId} 完成`);
          })
          .catch((e) => { const job = jobStore.get(jobId); if (job) { job.status = 'error'; job.error = { status: 500, body: String(e) }; } });
        return res.json({ jobId, queuePosition: jobStore.get(jobId)!.queuePosition });
      }

      console.log(`[Gemini] POST ${model}:generateContent (队列长度: ${geminiQueue.queueLength})`);
      const response = await geminiQueue.add(() => fetchWithRetry(targetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }));
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

  // 异步任务状态轮询
  app.get('/api/job/:id', (req: any, res: any) => {
    const job = jobStore.get(req.params.id);
    if (!job) return res.status(404).json({ error: '任务不存在或已过期' });
    res.json({ status: job.status, queuePosition: job.queuePosition, result: job.result, error: job.error });
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
      try {
        await db.collection('usage_logs').add(log);
      } catch (e: any) {
        if (e?.code === 'DATABASE_COLLECTION_NOT_EXIST') {
          await db.createCollection('usage_logs');
          await db.collection('usage_logs').add(log);
        } else {
          throw e;
        }
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[Analytics Write] 写入失败:', e?.message || e);
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // 通用 CloudBase DB 代理（admin SDK，无 CORS，无安全规则限制）
  app.post('/api/db/upsert', async (req: any, res: any) => {
    try {
      const db = getAdminDb();
      if (!db) return res.status(503).json({ error: `Admin SDK 未就绪: ${getAdminDbError()}` });
      const { collection, id, data } = req.body;
      // 剔除 _id 字段，CloudBase 禁止通过 set() 修改文档 _id
      const { _id, ...cleanData } = (data ?? {}) as any;
      const doSet = () => (db.collection(collection).doc(id) as any).set(cleanData);
      try {
        await doSet();
      } catch (e: any) {
        if (e?.code === 'DATABASE_COLLECTION_NOT_EXIST') {
          await db.createCollection(collection);
          await doSet();
        } else {
          throw e;
        }
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[DB upsert] 失败 collection=%s id=%s:', req.body?.collection, req.body?.id, e?.message || e);
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

  // ── 数据库直连接口 ──────────────────────────────────────────────────────────

  function getChClient() {
    return createChClient({
      url: `http://${process.env.CH_HOST || 'localhost'}:${process.env.CH_PORT || '8123'}`,
      username: process.env.CH_USER || 'default',
      password: process.env.CH_PASSWORD || '',
      database: process.env.CH_DATABASE || 'default',
      request_timeout: 10_000,
    });
  }

  let _mysqlPool: any = null;
  function getMysqlPool() {
    if (!_mysqlPool) {
      const mysql = require('mysql2/promise');
      _mysqlPool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE || undefined,
        connectTimeout: 10_000,
        waitForConnections: true,
        connectionLimit: 3,
      });
    }
    return _mysqlPool;
  }

  // 安全转义标识符中的反引号
  const safeId = (s: string) => s.replace(/`/g, '``');

  // 测试连通性
  app.get('/api/db/ping', async (_req: any, res: any) => {
    const result: Record<string, any> = {};
    try {
      const ch = getChClient();
      const r = await ch.query({ query: 'SELECT 1', format: 'JSONEachRow' });
      await r.json();
      await ch.close();
      result.ch = 'ok';
    } catch (e: any) {
      result.ch = 'error';
      result.chError = e?.message || String(e);
    }
    try {
      const pool = getMysqlPool();
      const conn = await pool.getConnection();
      try {
        await conn.execute('SELECT 1');
        result.mysql = 'ok';
      } finally {
        conn.release();
      }
    } catch (e: any) {
      result.mysql = 'error';
      result.mysqlError = e?.message || String(e);
    }
    // 附带服务器出口 IP，便于白名单排查
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const { ip } = await ipRes.json() as any;
      result.serverIp = ip;
    } catch {
      result.serverIp = '获取失败';
    }
    res.json(result);
  });

  // 列出所有库和表
  app.get('/api/db/explore', async (_req: any, res: any) => {
    const result: Record<string, any> = { clickhouse: {}, mysql: {} };
    const SYSTEM_DBS_CH = new Set(['system', 'information_schema', 'INFORMATION_SCHEMA']);
    const SYSTEM_DBS_MYSQL = new Set(['information_schema', 'performance_schema', 'mysql', 'sys']);

    try {
      const ch = getChClient();
      const dbRes = await ch.query({ query: 'SHOW DATABASES', format: 'JSONEachRow' });
      const dbs: string[] = (await dbRes.json() as any[]).map((r: any) => r.name);
      result.clickhouse.databases = dbs;
      result.clickhouse.tables = {} as Record<string, string[]>;
      for (const db of dbs.filter(d => !SYSTEM_DBS_CH.has(d))) {
        const tRes = await ch.query({ query: `SHOW TABLES FROM \`${safeId(db)}\``, format: 'JSONEachRow' });
        result.clickhouse.tables[db] = (await tRes.json() as any[]).map((r: any) => r.name);
      }
      await ch.close();
    } catch (e: any) {
      result.clickhouse.error = e?.message || String(e);
    }

    try {
      const conn = await getMysqlConn();
      const [dbs] = await conn.execute('SHOW DATABASES') as any[];
      const dbNames: string[] = dbs.map((r: any) => Object.values(r)[0] as string);
      result.mysql.databases = dbNames;
      result.mysql.tables = {} as Record<string, string[]>;
      for (const db of dbNames.filter(d => !SYSTEM_DBS_MYSQL.has(d))) {
        const [tables] = await conn.execute(`SHOW TABLES FROM \`${safeId(db)}\``) as any[];
        result.mysql.tables[db] = tables.map((r: any) => Object.values(r)[0] as string);
      }
      await conn.end();
    } catch (e: any) {
      result.mysql.error = e?.message || String(e);
    }

    res.json(result);
  });

  // 查看表的字段结构
  app.post('/api/db/describe', async (req: any, res: any) => {
    const { engine, database, table } = req.body ?? {};
    if (!engine || !database || !table) return res.status(400).json({ error: '缺少参数' });

    if (engine === 'ch') {
      try {
        const ch = getChClient();
        const r = await ch.query({
          query: `DESCRIBE TABLE \`${safeId(database)}\`.\`${safeId(table)}\``,
          format: 'JSONEachRow',
        });
        const rows = await r.json() as any[];
        await ch.close();
        res.json({ columns: rows.map((row: any) => ({ name: row.name, type: row.type })) });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || String(e) });
      }
    } else if (engine === 'mysql') {
      try {
        const conn = await getMysqlConn();
        const [rows] = await conn.execute(`DESCRIBE \`${safeId(database)}\`.\`${safeId(table)}\``) as any[];
        await conn.end();
        res.json({ columns: rows.map((r: any) => ({ name: r.Field, type: r.Type })) });
      } catch (e: any) {
        res.status(500).json({ error: e?.message || String(e) });
      }
    } else {
      res.status(400).json({ error: '无效的 engine，应为 ch 或 mysql' });
    }
  });

  // 从 ClickHouse 导入聊天记录（按区服+时间范围）
  app.post('/api/db/import/chat', async (req: any, res: any) => {
    try {
      const { serverId, startTime, endTime, limit = 2000 } = req.body ?? {};
      if (!serverId || !startTime || !endTime) return res.status(400).json({ error: '缺少 serverId、startTime 或 endTime' });
      // datetime-local 传来格式 "2026-06-01T00:00"，转为 ClickHouse DateTime 格式 "2026-06-01 00:00:00"
      const toChDt = (s: string) => s.replace('T', ' ') + (s.length === 16 ? ':00' : '');
      // import 查询用更长超时（JOIN 可能较慢），与通用 getChClient 的 10s 分开
      const ch = createChClient({
        url: `http://${process.env.CH_HOST || 'localhost'}:${process.env.CH_PORT || '8123'}`,
        username: process.env.CH_USER || 'default',
        password: process.env.CH_PASSWORD || '',
        database: process.env.CH_DATABASE || 'default',
        request_timeout: 60_000,
      });
      const r = await ch.query({
        query: `SELECT
          toString(c.action_time) AS time,
          COALESCE(NULLIF(r.role_name, ''), toString(c.cp_role_id)) AS roleName,
          c.context_type          AS type,
          c.context               AS content,
          c.receive_id            AS target
        FROM zhangyou.zs_role_all_chat_log c
        LEFT JOIN zhangyou.zs_game_role r ON c.role_id = r.role_id AND r.server_id = {serverId:String}
        WHERE c.server_id   = {serverId:String}
          AND c.action_time >= {startTime:DateTime}
          AND c.action_time <  {endTime:DateTime}
        ORDER BY c.action_time ASC
        LIMIT {limit:UInt32}`,
        query_params: {
          serverId: String(serverId),
          startTime: toChDt(String(startTime)),
          endTime: toChDt(String(endTime)),
          limit: Math.min(Number(limit) || 2000, 5000),
        },
        format: 'JSONEachRow',
      });
      const rows = await r.json() as any[];
      await ch.close();
      const playerCount = new Set(rows.map((r: any) => r.roleName)).size;
      res.json({ records: rows, count: rows.length, playerCount });
    } catch (e: any) {
      console.error('[DB import/chat]', e);
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
