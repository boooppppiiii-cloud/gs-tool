/**
 * gmClient.ts — Session-aware Playwright client for both GM backends.
 *
 * Selectors are filled from user-provided DevTools paths.
 * Remaining TODOs:
 *   - Chat: server/region selector (serverName filter)
 *   - Recharge: order query button (after filling time range)
 *   - Recharge: order table pagination "next page" selector
 *   - parser.ts: RECHARGE_COL_MAP column indices for the order table
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
    if (expectedPathFragment && !url.includes(expectedPathFragment) && !url.includes(config.GM_CHAT_URL.replace('https://', '').replace('http://', ''))) {
      console.warn(`[GmClient] Unexpected URL after navigation: ${url}`);
    }
  }

  /**
   * Export chat records CSV for a given server and time range.
   * Flow: 玩家数据 sidebar → 历史聊天记录 → fill times → query → export.
   */
  async exportChatCsv(serverName: string, start: Date, end: Date): Promise<string> {
    await this.page.goto(config.GM_CHAT_URL, { waitUntil: 'networkidle' });
    this.checkLoggedOut('');

    // Navigate: click "玩家数据" to expand, then "历史聊天记录"
    await this.page.click(
      'body > div.page-container > div.page-sidebar.nav-collapse.collapse > ul > li.active.open > a > span.title'
    );
    await this.page.waitForTimeout(500);
    await this.page.click(
      'body > div.page-container > div.page-sidebar.nav-collapse.collapse > ul > li.active > ul > li:nth-child(25) > a'
    );
    await this.page.waitForTimeout(1500);
    this.checkLoggedOut('');

    // TODO: select server/region — selector not yet provided
    // await this.page.selectOption('/* server select */', { label: serverName });
    console.warn(`[GmClient] Server filter not configured — exporting all servers (serverName=${serverName})`);

    const startStr = formatDateTime(start);
    const endStr   = formatDateTime(end);

    // jQuery datetimepicker is read-only — set via evaluate + dispatch change event
    await setDateValue(this.page, '#datetimepicker1', startStr);
    await setDateValue(this.page, '#datetimepicker2', endStr);

    // Click query
    await this.page.click(
      '#tab_1 > div.portlet.box.blue > div.portlet-body.form > form > div.form-actions > button.btn.blue'
    );
    await this.page.waitForTimeout(2000);

    // Click export and capture the download
    if (!fs.existsSync(config.TMP_DIR)) fs.mkdirSync(config.TMP_DIR, { recursive: true });
    const filePath = path.join(config.TMP_DIR, `chat_${serverName}_${Date.now()}.csv`);

    const [download] = await Promise.all([
      this.page.waitForEvent('download') as Promise<Download>,
      this.page.click(
        '#tab_1 > div.portlet.box.blue > div.portlet-body.form > form > div.form-actions > button.btn.green'
      ),
    ]);
    await download.saveAs(filePath);

    console.log(`[GmClient] Chat CSV saved: ${filePath}`);
    return filePath;
  }

  /**
   * Scrape order records for a single player game ID.
   * Flow: 玩家管理 → 角色管理 → search by ID → click row → 订单记录 tab → fill times → scrape.
   */
  async scrapeRechargeById(playerId: string, start: Date, end: Date): Promise<string[][]> {
    // Selectors (long paths from DevTools, defined here for readability)
    const SEL_MENU_EXPAND  = '#app > div > div.sidebar-container > div.el-scrollbar > div.scrollbar-wrapper.el-scrollbar__wrap > div > div > ul > div:nth-child(1) > li > div > svg';
    const SEL_ROLE_MGMT    = '#app > div > div.sidebar-container > div.el-scrollbar > div.scrollbar-wrapper.el-scrollbar__wrap > div > div > ul > div:nth-child(1) > li > ul > div:nth-child(2) > a > li > span';
    const SEL_PLAYER_INPUT = '#app > div > div.main-container > section > div.insider-account-box > div.content-outer > div.block-box.search-block-box.BiSearchBlock_footer > div.block-content > div > div:nth-child(1) > div.item-content.select-content > div > input';
    const SEL_CLEAR_DATE   = '#app > div > div.main-container > section > div.insider-account-box > div.content-outer > div.block-box.search-block-box.BiSearchBlock_footer > div.block-content > div > div:nth-child(12) > div.item-content > div > i.el-input__icon.el-range__close-icon';
    const SEL_SEARCH_BTN   = '#app > div > div.main-container > section > div.insider-account-box > div.content-outer > div.block-box.search-block-box.BiSearchBlock_footer > div.block-content > div > div:nth-child(20) > div > button.el-button.el-button--primary.el-button--small > span';
    const SEL_PLAYER_ROW   = '#app > div > div.main-container > section > div.insider-account-box > div.content-outer > div:nth-child(2) > div.table-table > div > div.bi-table-wrapper > div > div.el-table__body-wrapper.is-scrolling-left > table > tbody > tr > td.el-table_1_column_27.el-table__cell > div > div';
    const SEL_ORDER_START  = '#pane-order > div > div.search > div:nth-child(1) > div > input:nth-child(2)';
    const SEL_ORDER_END    = '#pane-order > div > div.search > div:nth-child(1) > div > input:nth-child(4)';

    // Navigate to 角色管理 (try direct link; expand menu first if not visible)
    try {
      await this.page.click(SEL_ROLE_MGMT, { timeout: 2000 });
    } catch {
      await this.page.click(SEL_MENU_EXPAND);
      await this.page.waitForTimeout(500);
      await this.page.click(SEL_ROLE_MGMT);
    }
    await this.page.waitForTimeout(1500);
    this.checkLoggedOut('');

    // Fill player ID (triple-click to clear any previous value, then type)
    await this.page.click(SEL_PLAYER_INPUT, { clickCount: 3 });
    await this.page.keyboard.type(playerId);

    // Clear the creation-date range filter (X button) — ignore if not present
    try { await this.page.click(SEL_CLEAR_DATE, { timeout: 1000 }); } catch {}

    // Click search and wait for results
    await this.page.click(SEL_SEARCH_BTN);
    await this.page.waitForTimeout(1500);

    // Click first result row to open player detail
    await this.page.click(SEL_PLAYER_ROW);
    await this.page.waitForTimeout(1000);

    // Switch to 订单记录 tab
    await this.page.click('#tab-order');
    await this.page.waitForTimeout(800);

    const startStr = formatDateTime(start);
    const endStr   = formatDateTime(end);

    // El-Date-Picker: click field → select all → type date → close calendar
    await elDatePickerSet(this.page, SEL_ORDER_START, startStr);
    await elDatePickerSet(this.page, SEL_ORDER_END, endStr);

    // TODO: click order query button — selector not yet provided
    // await this.page.click('/* order search button in #pane-order */');
    await this.page.waitForTimeout(1000);

    // Scrape order table rows (all pages)
    const allRows: string[][] = [];
    while (true) {
      const rows = await this.page.$$eval('table tbody tr', (trs) =>
        trs.map(tr =>
          Array.from(tr.querySelectorAll('td')).map(td => (td as Element & { innerText: string }).innerText.trim())
        )
      );
      allRows.push(...rows.filter(r => r.length > 0));

      // TODO: update pagination selector for the order table
      const nextBtn = await this.page.$('button.next-page:not([disabled])');
      if (!nextBtn) break;
      await nextBtn.click();
      await this.page.waitForTimeout(600);
    }

    console.log(`[GmClient] Recharge rows for player ${playerId}: ${allRows.length}`);
    return allRows;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

/** Set value on a read-only jQuery datetimepicker input via DOM evaluate. */
async function setDateValue(page: Page, selector: string, value: string): Promise<void> {
  await page.evaluate(({ sel, val }: { sel: string; val: string }) => {
    const el = document.querySelector(sel) as HTMLInputElement | null;
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { sel: selector, val: value });
}

/** Set value on an Element UI date-picker by clicking and typing. */
async function elDatePickerSet(page: Page, selector: string, value: string): Promise<void> {
  await page.click(selector);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(value);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
