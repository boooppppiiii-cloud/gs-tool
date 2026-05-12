export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const targetUrl = `https://api.coze.cn${req.url.replace(/^\/?api\/coze/, '')}${queryString}`;

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
    let parsed: unknown;
    try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }
    if (!res.headersSent) res.status(safeStatus).json(parsed);
  } catch (err) {
    console.error('[Coze] 错误:', err);
    if (!res.headersSent) res.status(502).json({ error: 'Coze 代理请求失败', detail: String(err) });
  }
}
