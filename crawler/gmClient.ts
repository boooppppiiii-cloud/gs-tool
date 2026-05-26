/**
 * gmClient.ts — Session-aware Playwright client for both GM backends.
 *
 * SETUP: After running `npm run auth:chat` and `npm run auth:recharge`,
 * update the TODO selectors below to match the actual GM backend HTML.
 * Use browser DevTools (F12 → select element) to find CSS selectors.
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page, Download } from 'playwright';
import { config } from './config';

export class SessionExpiredError extends Error {
  constructor(public readonly backend: 'chat' | 'recharge') {
    super(`${backend} session has expired. Run: npm run auth:${backend}`);
    this.name = 'SessionExpiredError';
  }
}

export class GmClient {
  private context!: BrowserContext;
  private page!: Page;
  private sessionFile: string;

  constructor(backend: 'chat' | 'recharge') {
    this.sessionFile = path.join(config.SESSIONS_DIR, `${backend}.json`);
  }

  async launch(): Promise<void> {
    const hasSession = fs.existsSync(this.sessionFile);
    this.context = await chromium.launchPersistentContext('', {
      headless: true,
      ...(hasSession && { storageState: this.sessionFile }),
    });
    this.page = await this.context.newPage();
  }

  async close(): Promise<void> {
    await this.context.close();
  }

  private checkLoggedOut(expectedPathFragment: string): void {
    const url = this.page.url();
    if (url.includes('login') || url.includes('signin') || url.includes('qr')) {
      const backend = this.sessionFile.includes('chat') ? 'chat' : 'recharge';
      throw new SessionExpiredError(backend);
    }
    // Also check if we ended up somewhere unexpected (e.g. error page)
    if (expectedPathFragment && !url.includes(expectedPathFragment) && !url.includes(config.GM_CHAT_URL.replace('https://', '').replace('http://', ''))) {
      // Not a fatal error — just log and continue
      console.warn(`[GmClient] Unexpected URL after navigation: ${url}`);
    }
  }

  /**
   * Export chat records CSV for a given server and time range.
   * Returns the local file path of the downloaded CSV.
   *
   * TODO: Update selectors to match the actual chat backend export page.
   */
  async exportChatCsv(serverName: string, start: Date, end: Date): Promise<string> {
    // ── TODO: update with actual export page path ──────────────────────
    await this.page.goto(`${config.GM_CHAT_URL}/chat/export`, { waitUntil: 'networkidle' });
    // ──────────────────────────────────────────────────────────────────

    this.checkLoggedOut('export');

    const startStr = formatDateTime(start);
    const endStr   = formatDateTime(end);

    // ── TODO: update all selectors below ──────────────────────────────
    // Select server/region
    await this.page.selectOption('select.server-select', { label: serverName })
      .catch(() => this.page.fill('input.server-input', serverName));

    // Fill time range
    await this.page.fill('input.start-time', startStr);
    await this.page.fill('input.end-time', endStr);

    // Click search/query button
    await this.page.click('button.search-btn');
    await this.page.waitForTimeout(1000);

    // Click export button and wait for download
    if (!fs.existsSync(config.TMP_DIR)) fs.mkdirSync(config.TMP_DIR, { recursive: true });
    const filePath = path.join(config.TMP_DIR, `chat_${serverName}_${Date.now()}.csv`);

    const [download] = await Promise.all([
      this.page.waitForEvent('download') as Promise<Download>,
      this.page.click('button.export-btn'),
    ]);
    await download.saveAs(filePath);
    // ──────────────────────────────────────────────────────────────────

    console.log(`[GmClient] Chat CSV saved: ${filePath}`);
    return filePath;
  }

  /**
   * Look up recharge records for a single player game ID.
   * Returns raw table rows as string arrays.
   *
   * TODO: Update selectors to match the actual recharge backend search page.
   */
  async scrapeRechargeById(playerId: string, start: Date, end: Date): Promise<string[][]> {
    // ── TODO: update with actual recharge search page path ─────────────
    await this.page.goto(`${config.GM_RECHARGE_URL}/recharge/search`, { waitUntil: 'networkidle' });
    // ──────────────────────────────────────────────────────────────────

    this.checkLoggedOut('search');

    const startStr = formatDateTime(start);
    const endStr   = formatDateTime(end);

    // ── TODO: update all selectors below ──────────────────────────────
    // Fill game ID
    await this.page.fill('input.player-id-input', playerId);

    // Fill time range
    await this.page.fill('input.start-time', startStr);
    await this.page.fill('input.end-time', endStr);

    // Click search
    await this.page.click('button.search-btn');
    await this.page.waitForTimeout(800);

    // Scrape all paginated rows
    const allRows: string[][] = [];
    while (true) {
      const rows = await this.page.$$eval('table tbody tr', (trs) =>
        trs.map(tr =>
          Array.from(tr.querySelectorAll('td')).map(td => (td as Element & { innerText: string }).innerText.trim())
        )
      );
      allRows.push(...rows.filter(r => r.length > 0));

      const nextBtn = await this.page.$('button.next-page:not([disabled])');
      if (!nextBtn) break;
      await nextBtn.click();
      await this.page.waitForTimeout(600);
    }
    // ──────────────────────────────────────────────────────────────────

    console.log(`[GmClient] Recharge rows for player ${playerId}: ${allRows.length}`);
    return allRows;
  }
}

function formatDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}
