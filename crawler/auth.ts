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
import { chromium } from 'playwright';
import { config } from './config';

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

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
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
  await browser.close();
  console.log(`✓ 聊天后台 session 已保存到 ${sessionPath}`);
  console.log('  Session 通常持续数小时至数天，过期后重新运行此命令。\n');
}

async function authRecharge(): Promise<void> {
  console.log('\n=== 充值后台认证 ===');
  console.log('将打开浏览器窗口，请：');
  console.log('  1. 在浏览器中扫描二维码');
  console.log('  2. 等待扫码成功跳转后程序自动保存 session\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(config.GM_RECHARGE_URL, { waitUntil: 'networkidle' });

  console.log('等待扫码完成（最长 5 分钟）...');
  try {
    await page.waitForURL(
      (url) => !url.toString().includes('login') && !url.toString().includes('qr') && !url.toString().includes('scan'),
      { timeout: 300_000 }
    );
  } catch {
    // Some backends don't redirect — wait for a specific element instead
    console.log('(未检测到 URL 跳转，尝试等待页面加载完成...)');
    await page.waitForTimeout(3000);
  }

  const sessionPath = path.join(config.SESSIONS_DIR, 'recharge.json');
  await context.storageState({ path: sessionPath });
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
