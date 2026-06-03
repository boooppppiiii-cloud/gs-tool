/**
 * auth.ts — Interactive authentication script.
 *
 * Run this ONCE (and again when session expires):
 *   npm run auth:chat      → opens browser, fill captcha manually, saves sessions/chat.json
 *   npm run auth:recharge  → opens browser, scan QR code, saves sessions/recharge.json
 *
 * After saving, the main crawler (index.ts) will reuse the session headlessly.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { chromium } from 'playwright';
import { config } from './config';

function findSystemBrowser(): string | undefined {
  const regKeys = [
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe',
  ];
  for (const key of regKeys) {
    try {
      const out = execSync(`reg query "${key}" /ve 2>nul`, { encoding: 'utf-8' });
      const match = out.match(/REG_SZ\s+(.+)/);
      const p = match?.[1]?.trim();
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }
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
  return candidates.find(p => fs.existsSync(p));
}

function setSessionStatus(backend: 'chat' | 'recharge', status: 'ok' | 'expired'): void {
  const file = path.join(config.SESSIONS_DIR, 'status.json');
  try {
    const s = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : { chat: 'ok', recharge: 'ok' };
    s[backend] = status;
    fs.writeFileSync(file, JSON.stringify(s), 'utf-8');
  } catch {}
}

const backend = process.argv.find(a => a.startsWith('--backend='))?.split('=')[1]
  ?? process.argv[process.argv.indexOf('--backend') + 1];

if (!backend || (backend !== 'chat' && backend !== 'recharge')) {
  console.error('Usage: ts-node auth.ts --backend chat|recharge');
  process.exit(1);
}

if (!fs.existsSync(config.SESSIONS_DIR)) {
  fs.mkdirSync(config.SESSIONS_DIR, { recursive: true });
}

async function authChat(): Promise<void> {
  console.log('\n=== 聊天后台认证 ===');
  console.log('将打开浏览器窗口，请：');
  console.log('  1. 确认账号密码已自动填入');
  console.log('  2. 手动输入验证码');
  console.log('  3. 点击登录按钮');
  console.log('  4. 等待跳转后程序自动保存 session\n');

  const executablePath = findSystemBrowser();
  if (!executablePath) throw new Error('未找到 Chrome 或 Edge 浏览器，请安装后重试');
  console.log(`使用浏览器：${executablePath}`);
  const browser = await chromium.launch({ headless: false, slowMo: 100, executablePath });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(config.GM_CHAT_URL, { waitUntil: 'networkidle' });

  // ── TODO: replace with actual selectors from GM chat backend ──────────
  try {
    await page.fill('input[name="username"]', config.GM_CHAT_USERNAME);
    await page.fill('input[name="password"]', config.GM_CHAT_PASSWORD);
  } catch {
    console.log('(账密自动填写失败，请在浏览器中手动填入)');
  }
  // ──────────────────────────────────────────────────────────────────────

  console.log('等待登录完成（最长 3 分钟）...');
  try {
    // Wait for URL to change away from login page
    await page.waitForURL(
      (url) => !url.toString().includes('login') && !url.toString().includes('signin'),
      { timeout: 180_000 }
    );
  } catch {
    console.error('超时未检测到登录成功，请重试。');
    await browser.close();
    process.exit(1);
  }

  const sessionPath = path.join(config.SESSIONS_DIR, 'chat.json');
  await context.storageState({ path: sessionPath });
  setSessionStatus('chat', 'ok');
  await browser.close();
  console.log(`✓ 聊天后台 session 已保存到 ${sessionPath}`);
  console.log('  Session 通常持续数小时至数天，过期后重新运行此命令。\n');
}

async function authRecharge(): Promise<void> {
  console.log('\n=== 充值后台认证 ===');
  console.log('将打开浏览器窗口，请：');
  console.log('  1. 页面若显示"登录过期"，点击"重新登录"按钮');
  console.log('  2. 弹出的二维码窗口中，用手机扫码完成登录');
  console.log('  3. 扫码后弹窗自动关闭，程序随即保存登录状态\n');

  const executablePath = findSystemBrowser();
  if (!executablePath) throw new Error('未找到 Chrome 或 Edge 浏览器，请安装后重试');
  console.log(`使用浏览器：${executablePath}`);
  const browser = await chromium.launch({ headless: false, executablePath });
  const context = await browser.newContext();
  const page = await context.newPage();

  const popupClosed = new Promise<void>(resolve => {
    context.on('page', (popup) => {
      console.log('  (检测到扫码窗口已弹出，请扫码...)');
      popup.on('close', () => {
        console.log('  (扫码窗口已关闭，正在保存登录状态...)');
        resolve();
      });
    });
  });

  await page.goto(config.GM_RECHARGE_URL, { waitUntil: 'networkidle' });

  console.log('  等待扫码完成（最长 5 分钟）...');
  await Promise.race([
    popupClosed,
    page.waitForURL(
      url => !url.toString().includes('login') && !url.toString().includes('qr'),
      { timeout: 300_000 }
    ).catch(() => {}),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('认证超时（5分钟）')), 305_000)
    ),
  ]);

  const sessionPath = path.join(config.SESSIONS_DIR, 'recharge.json');
  await context.storageState({ path: sessionPath });
  setSessionStatus('recharge', 'ok');
  await browser.close();
  console.log(`✓ 充值后台 session 已保存到 ${sessionPath}`);
  console.log('  Session 通常持续数天，过期后重新运行此命令。\n');
}

(async () => {
  if (backend === 'chat') await authChat();
  else await authRecharge();
})().catch(err => {
  console.error('Auth failed:', err);
  process.exit(1);
});
