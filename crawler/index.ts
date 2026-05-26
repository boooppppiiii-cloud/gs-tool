/**
 * index.ts — Crawler entry point.
 *
 * Schedules two daily runs:
 *   09:00 — collects yesterday 18:00 → today 09:00
 *   18:00 — collects today 09:00 → today 18:00
 *
 * Quick start:
 *   cd crawler && npm install && npx playwright install chromium
 *   cp .env.crawler.example .env.crawler  # fill in your values
 *   npm run now                            # run once immediately for testing
 *   npm start                              # start the scheduler
 */

import * as cron from 'node-cron';
import * as fs from 'fs';
import { config } from './config';
import { GmClient } from './gmClient';
import { parseChatExcel, parseRechargeRows } from './parser';
import { runAnalysis } from './autoAnalysis';

/** Calculate the [start, end] time range for the current scheduled run */
function getTimeRange(): { start: Date; end: Date } {
  const now = new Date();
  const hour = now.getHours();

  if (hour >= 9 && hour < 18) {
    // Evening run (18:00): collect from today 09:00 to now
    const start = new Date(now);
    start.setHours(9, 0, 0, 0);
    return { start, end: now };
  } else {
    // Morning run (09:00): collect from yesterday 18:00 to now
    const start = new Date(now);
    const isBeforeNoon = hour < 9;
    if (isBeforeNoon) start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0);
    return { start, end: now };
  }
}

async function collect(): Promise<void> {
  const { start, end } = getTimeRange();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Crawler] Run started at ${new Date().toLocaleString('zh-CN')}`);
  console.log(`[Crawler] Collecting ${start.toLocaleString('zh-CN')} → ${end.toLocaleString('zh-CN')}`);

  const gm = new GmClient();

  try {
    await gm.launch();
    await gm.login();

    const chatFile = await gm.exportChatRecords(start, end);
    const rechargeRows = await gm.scrapeRechargeRecords(start, end);

    await gm.close();

    const chatData = parseChatExcel(chatFile);
    const rechargeData = parseRechargeRows(rechargeRows);

    // Clean up temp file after parsing
    try { fs.unlinkSync(chatFile); } catch {}

    if (chatData.length === 0) {
      console.warn('[Crawler] No chat records found for this period — skipping analysis.');
      return;
    }

    await runAnalysis(chatData, rechargeData, config.GS_USER_ID, config.GS_GROUP);

    console.log(`[Crawler] ✓ Daily report generated successfully`);
  } catch (err) {
    console.error('[Crawler] ✗ Run failed:', err);
    // Don't rethrow — let the scheduler keep running for the next trigger
    try { await gm.close(); } catch {}
  }

  console.log(`${'='.repeat(60)}\n`);
}

// ── Scheduler ─────────────────────────────────────────────────────────────
cron.schedule(config.CRON_MORNING, collect, { timezone: 'Asia/Shanghai' });
cron.schedule(config.CRON_EVENING, collect, { timezone: 'Asia/Shanghai' });

console.log('[Crawler] Scheduler started');
console.log(`  Morning: ${config.CRON_MORNING} (Asia/Shanghai)`);
console.log(`  Evening: ${config.CRON_EVENING} (Asia/Shanghai)`);
console.log('  Waiting for next trigger... (Ctrl+C to stop)');
console.log('  To run immediately: node index.js --now\n');

// ── Immediate run for --now flag ───────────────────────────────────────────
if (process.argv.includes('--now')) {
  console.log('[Crawler] --now flag detected, running immediately...');
  collect();
}
