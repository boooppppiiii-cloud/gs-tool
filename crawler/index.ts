/**
 * index.ts — Scheduler + orchestrator for all GS users.
 *
 * Usage:
 *   npm run now    — run immediately (for testing)
 *   npm start      — start scheduler (09:00 and 18:00 daily)
 *
 * Before running, complete setup:
 *   1. npm install && npx playwright install chromium
 *   2. cp .env.crawler.example .env.crawler  (fill in values)
 *   3. Edit users.json with all GS member configs
 *   4. npm run auth:chat      (manual captcha)
 *   5. npm run auth:recharge  (manual QR scan)
 */

import * as cron from 'node-cron';
import { config, loadUsers, GsUser } from './config';
import { GmClient, SessionExpiredError } from './gmClient';
import { parseChatCsv, parseRechargeRows } from './parser';
import { runAnalysis } from './autoAnalysis';

function getTimeRange(): { start: Date; end: Date } {
  const now = new Date();
  const hour = now.getHours();
  const start = new Date(now);

  if (hour >= 9 && hour < 18) {
    // Evening run (18:00): from today 09:00 to now
    start.setHours(9, 0, 0, 0);
  } else {
    // Morning run (09:00): from yesterday 18:00 to now
    if (hour < 9) start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0);
  }
  return { start, end: now };
}

async function collectForUser(user: GsUser, start: Date, end: Date): Promise<void> {
  console.log(`  [${user.serverName}] Starting collection (userId: ${user.gsUserId})`);

  // ── Chat records ───────────────────────────────────────────────────────
  const chatClient = new GmClient('chat');
  await chatClient.launch();
  let chatData;
  try {
    const csvPath = await chatClient.exportChatCsv(user.serverName, start, end);
    chatData = parseChatCsv(csvPath);
  } finally {
    await chatClient.close();
  }

  if (chatData.length === 0) {
    console.warn(`  [${user.serverName}] No chat records found — skipping analysis.`);
    return;
  }

  // ── Recharge records (per player ID) ──────────────────────────────────
  const rechargeClient = new GmClient('recharge');
  await rechargeClient.launch();
  const allRechargeRows: string[][] = [];
  try {
    for (const playerId of user.rechargePlayerIds) {
      const rows = await rechargeClient.scrapeRechargeById(playerId, start, end);
      allRechargeRows.push(...rows);
    }
  } finally {
    await rechargeClient.close();
  }
  const rechargeData = parseRechargeRows(allRechargeRows);

  // ── AI analysis + CloudBase write ─────────────────────────────────────
  await runAnalysis(chatData, rechargeData, user.gsUserId, user.gsGroup);
  console.log(`  [${user.serverName}] ✓ Daily report generated`);
}

async function collectAll(): Promise<void> {
  const { start, end } = getTimeRange();
  const users = loadUsers();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Crawler] Run started: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`[Crawler] Period: ${start.toLocaleString('zh-CN')} → ${end.toLocaleString('zh-CN')}`);
  console.log(`[Crawler] Users: ${users.length}`);

  let successCount = 0;
  for (const user of users) {
    try {
      await collectForUser(user, start, end);
      successCount++;
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        console.error(`\n  ⚠ Session expired for ${err.backend} backend.`);
        console.error(`  → Run: npm run auth:${err.backend}  then restart the crawler.\n`);
        // Notify via system bell
        process.stdout.write('\x07');
      } else {
        console.error(`  ✗ [${user.serverName}] Collection failed:`, err);
      }
    }
  }

  console.log(`[Crawler] Done: ${successCount}/${users.length} users succeeded`);
  console.log(`${'='.repeat(60)}\n`);
}

// ── Cron schedule ─────────────────────────────────────────────────────────
cron.schedule(config.CRON_MORNING, collectAll, { timezone: 'Asia/Shanghai' });
cron.schedule(config.CRON_EVENING, collectAll, { timezone: 'Asia/Shanghai' });

console.log('[Crawler] Scheduler started (Asia/Shanghai)');
console.log(`  Morning: ${config.CRON_MORNING}`);
console.log(`  Evening: ${config.CRON_EVENING}`);
console.log(`  Users configured: ${loadUsers().length}`);
console.log('  Waiting... (Ctrl+C to stop)\n');

// ── Immediate run ─────────────────────────────────────────────────────────
if (process.argv.includes('--now')) {
  console.log('[Crawler] --now flag: running immediately...');
  collectAll().catch(console.error);
}
