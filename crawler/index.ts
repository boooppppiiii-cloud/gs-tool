/**
 * index.ts — Scheduler + orchestrator for all GS users.
 *
 * Usage:
 *   npm run now    — run immediately (for testing)
 *   npm start      — start scheduler (09:00 and 18:00 daily)
 *
 * Env vars (for --now mode):
 *   CRAWL_HOURS        — hours of data to collect (default: time-range logic)
 *   CRAWL_SERVER_NAME  — only crawl this specific server (5-digit zone id)
 *   CRAWL_OWNER_ID     — only crawl servers belonging to this user
 */

import * as cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';
import { config, loadUsers, GsUser } from './config';
import { GmClient, SessionExpiredError } from './gmClient';
import { parseChatCsv, parseRechargeRows } from './parser';
import { runAnalysis, fetchUserServerNames, fetchLastRechargeCrawlEnd, storeRechargeRecords, fetchAllStoredRecharge } from './autoAnalysis';

function setSessionStatus(backend: 'chat' | 'recharge', status: 'ok' | 'expired'): void {
  const file = path.join(config.SESSIONS_DIR, 'status.json');
  try {
    const s = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : { chat: 'ok', recharge: 'ok' };
    s[backend] = status;
    fs.writeFileSync(file, JSON.stringify(s), 'utf-8');
  } catch {}
}

function getTimeRange(): { start: Date; end: Date } {
  const now = new Date();
  const hour = now.getHours();
  const start = new Date(now);

  if (hour >= 9 && hour < 18) {
    start.setHours(9, 0, 0, 0);
  } else {
    if (hour < 9) start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0);
  }
  return { start, end: now };
}

async function collectForUser(user: GsUser, start: Date, end: Date): Promise<void> {
  console.log(`  [${user.serverName}] Starting collection (userId: ${user.gsUserId})`);

  // ── 1. 聊天爬取（使用传入的时间窗口）──────────────────────────────────────
  const chatClient = new GmClient('chat');
  await chatClient.launch();
  let chatData;
  let csvPath: string | undefined;
  let csvContent: string | undefined;
  try {
    csvPath = await chatClient.exportChatCsv(user.serverName, start, end);
    try { csvContent = fs.readFileSync(csvPath, 'utf-8'); } catch {}
    chatData = parseChatCsv(csvPath);
  } finally {
    await chatClient.close();
  }

  if (chatData.length === 0) {
    console.warn(`  [${user.serverName}] No chat records found — skipping analysis.`);
    return;
  }

  // ── 2. 充值爬取（独立时间范围：首次3天，后续增量不重叠）──────────────────
  const lastCrawlEnd = await fetchLastRechargeCrawlEnd(user.gsUserId, user.serverName);
  const rechargeStart = lastCrawlEnd ?? new Date(Date.now() - 3 * 24 * 3600_000);
  const rechargeEnd = new Date();

  console.log(`  [${user.serverName}] Recharge range: ${rechargeStart.toLocaleString('zh-CN')} → ${rechargeEnd.toLocaleString('zh-CN')} (${lastCrawlEnd ? '增量' : '首次3天'})`);

  const rechargeClient = new GmClient('recharge');
  await rechargeClient.launch();
  const allRechargeRows: string[][] = [];
  try {
    for (const playerId of user.rechargePlayerIds) {
      const rows = await rechargeClient.scrapeRechargeById(playerId, rechargeStart, rechargeEnd);
      allRechargeRows.push(...rows);
    }
  } finally {
    await rechargeClient.close();
  }
  const newRechargeRecords = parseRechargeRows(allRechargeRows);

  // 持久化新增充值记录，更新上次爬取结束时间
  await storeRechargeRecords(newRechargeRecords, user.gsUserId, user.serverName, rechargeEnd);

  // ── 3. 分析：使用该区服全量历史充值数据 ────────────────────────────────────
  const allStoredRecharge = await fetchAllStoredRecharge(user.gsUserId, user.serverName);
  console.log(`  [${user.serverName}] All stored recharge records: ${allStoredRecharge.length}`);

  await runAnalysis(chatData, allStoredRecharge, user.gsUserId, user.gsGroup, csvContent, user.serverName, { start, end });
  console.log(`  [${user.serverName}] ✓ Daily report generated`);
}

async function collectAll(opts: { isScheduled?: boolean } = {}): Promise<void> {
  const hoursOverride = process.env.CRAWL_HOURS ? parseInt(process.env.CRAWL_HOURS, 10) : null;
  const { start, end } = hoursOverride
    ? { start: new Date(Date.now() - hoursOverride * 3_600_000), end: new Date() }
    : getTimeRange();

  // Manual crawl: respect CRAWL_SERVER_NAME / CRAWL_OWNER_ID env vars
  const filterServerName = process.env.CRAWL_SERVER_NAME?.trim() || null;
  const filterOwnerId = process.env.CRAWL_OWNER_ID?.trim() || null;

  let users = loadUsers();

  if (filterServerName || filterOwnerId) {
    // --now mode: narrow down to the specific user+server requested from UI
    if (filterOwnerId) users = users.filter(u => u.gsUserId === filterOwnerId);
    if (filterServerName) users = users.filter(u => u.serverName === filterServerName);
    if (users.length === 0) {
      console.warn(`[Crawler] No users.json entry matched serverName=${filterServerName} ownerId=${filterOwnerId}. Check users.json.`);
      return;
    }
  } else if (opts.isScheduled) {
    // Scheduled run: only crawl servers the user currently has configured in CloudBase
    const filtered: GsUser[] = [];
    for (const u of users) {
      try {
        const configured = await fetchUserServerNames(u.gsUserId);
        if (configured.includes(u.serverName)) {
          filtered.push(u);
        } else {
          console.log(`  [skip] ${u.serverName} not in CloudBase serverProfiles for userId=${u.gsUserId}`);
        }
      } catch (e) {
        console.warn(`  [warn] Could not fetch profiles for userId=${u.gsUserId}:`, e);
        // fail-open: include the user so scheduled runs don't silently stop
        filtered.push(u);
      }
    }
    users = filtered;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Crawler] Run started: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`[Crawler] Period: ${start.toLocaleString('zh-CN')} → ${end.toLocaleString('zh-CN')}`);
  console.log(`[Crawler] Users: ${users.length}${filterServerName ? ` (server=${filterServerName})` : ''}${filterOwnerId ? ` (owner=${filterOwnerId})` : ''}`);

  let successCount = 0;
  for (const user of users) {
    try {
      await collectForUser(user, start, end);
      successCount++;
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        console.error(`\n  ⚠ Session expired for ${err.backend} backend.`);
        console.error(`  → Run: npm run auth:${err.backend}  then restart the crawler.\n`);
        setSessionStatus(err.backend, 'expired');
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
cron.schedule(config.CRON_MORNING, () => collectAll({ isScheduled: true }), { timezone: 'Asia/Shanghai' });
cron.schedule(config.CRON_EVENING, () => collectAll({ isScheduled: true }), { timezone: 'Asia/Shanghai' });

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
