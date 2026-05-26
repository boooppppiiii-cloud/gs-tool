/**
 * GmClient — Playwright automation for the GM backend.
 *
 * SETUP REQUIRED before first run:
 *  1. Open the GM backend in your browser with DevTools open.
 *  2. Find selectors for:
 *     - Login form: username input, password input, submit button
 *     - Chat records page: time-range start/end inputs, export/download button
 *     - Recharge records page: time-range inputs, table rows, next-page button
 *  3. Update the TODO sections below with those selectors.
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, Page, Download } from 'playwright';
import { config } from './config';

export class GmClient {
  private browser!: Browser;
  private page!: Page;

  async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true, // set false for initial debugging
    });
    this.page = await this.browser.newPage();
    console.log('[GmClient] Browser launched');
  }

  async login(): Promise<void> {
    await this.page.goto(config.GM_URL, { waitUntil: 'networkidle' });

    // ── TODO: replace selectors with actual GM backend selectors ──────────
    await this.page.fill('input[name="username"]', config.GM_USERNAME);
    await this.page.fill('input[name="password"]', config.GM_PASSWORD);
    await this.page.click('button[type="submit"]');
    // ──────────────────────────────────────────────────────────────────────

    await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15_000 })
      .catch(() => {}); // some backends don't navigate, they just update DOM

    console.log('[GmClient] Logged in, current URL:', this.page.url());
  }

  /**
   * Navigate to chat records page, set time range, click export, wait for download.
   * Returns local path of the downloaded file.
   */
  async exportChatRecords(start: Date, end: Date): Promise<string> {
    const chatUrl = new URL(config.GM_CHAT_PATH, config.GM_URL).href;
    await this.page.goto(chatUrl, { waitUntil: 'networkidle' });

    const startStr = formatDateTime(start);
    const endStr   = formatDateTime(end);

    // ── TODO: fill time-range inputs ──────────────────────────────────────
    await this.page.fill('input.start-time', startStr); // replace selector
    await this.page.fill('input.end-time',   endStr);   // replace selector
    await this.page.click('button.search-btn');          // replace selector
    await this.page.waitForTimeout(1000); // wait for results to load
    // ──────────────────────────────────────────────────────────────────────

    if (!fs.existsSync(config.TMP_DIR)) fs.mkdirSync(config.TMP_DIR, { recursive: true });
    const filePath = path.join(config.TMP_DIR, `chat_${Date.now()}.xlsx`);

    const [download]: [Download] = await Promise.all([
      this.page.waitForEvent('download'),
      // ── TODO: click the export/download button ──────────────────────────
      this.page.click('button.export-btn'),              // replace selector
      // ────────────────────────────────────────────────────────────────────
    ]);

    await download.saveAs(filePath);
    console.log(`[GmClient] Chat records saved to: ${filePath}`);
    return filePath;
  }

  /**
   * Navigate to recharge records page, set time range, scrape all paginated rows.
   * Returns an array of raw table rows (each row is an array of cell strings).
   */
  async scrapeRechargeRecords(start: Date, end: Date): Promise<string[][]> {
    const rechargeUrl = new URL(config.GM_RECHARGE_PATH, config.GM_URL).href;
    await this.page.goto(rechargeUrl, { waitUntil: 'networkidle' });

    const startStr = formatDateTime(start);
    const endStr   = formatDateTime(end);

    // ── TODO: fill time-range inputs ──────────────────────────────────────
    await this.page.fill('input.start-time', startStr); // replace selector
    await this.page.fill('input.end-time',   endStr);   // replace selector
    await this.page.click('button.search-btn');          // replace selector
    await this.page.waitForTimeout(1000);
    // ──────────────────────────────────────────────────────────────────────

    const allRows: string[][] = [];

    while (true) {
      // ── TODO: update table/row selectors to match actual GM backend HTML ─
      const rows = await this.page.$$eval('table tbody tr', (trs) =>
        trs.map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()))
      );
      // ────────────────────────────────────────────────────────────────────

      allRows.push(...rows.filter(r => r.length > 0));

      // ── TODO: update next-page button selector ────────────────────────────
      const nextBtn = await this.page.$('button.next-page:not([disabled])'); // replace selector
      // ────────────────────────────────────────────────────────────────────
      if (!nextBtn) break;
      await nextBtn.click();
      await this.page.waitForTimeout(800);
    }

    console.log(`[GmClient] Scraped ${allRows.length} recharge rows`);
    return allRows;
  }

  async close(): Promise<void> {
    await this.browser.close();
    console.log('[GmClient] Browser closed');
  }
}

/** Format a Date as "YYYY-MM-DD HH:mm:ss" for GM form inputs */
function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
