/**
 * parser.ts — Convert raw GM data into the exact same format that ExcelUpload.tsx produces.
 *
 * Chat Excel column mapping (same as ExcelUpload.tsx):
 *   C = time, D = roleName, E = type, F = content, H = target
 *
 * Recharge table column mapping (same as ExcelUpload.tsx Sheet2):
 *   col[1] = amount, col[2] = roleName, col[6] = status, col[7] = method
 *   (0-indexed; adjust RECHARGE_COL_MAP below if your GM table differs)
 */

import * as XLSX from 'xlsx';

export interface ChatRecord {
  time: string;
  roleName: string;
  type: string;
  content: string;
  target: string;
}

export interface RechargeRecord {
  amount: string;
  roleName: string;
  status: string;
  method: string;
}

// ── RECHARGE TABLE COLUMN INDICES (0-based) ───────────────────────────────
// Update these to match the actual column order in the GM backend's recharge table.
// Open the page in browser, count the <th> columns from left (starting at 0).
const RECHARGE_COL_MAP = {
  amount:   1,   // 充值金额
  roleName: 2,   // 角色名
  status:   6,   // 状态
  method:   7,   // 方式
};
// ──────────────────────────────────────────────────────────────────────────

/**
 * Parse a downloaded Excel/XLSX file into ChatRecord[].
 * Uses the same column mapping as ExcelUpload.tsx Sheet1.
 */
export function parseChatExcel(filePath: string): ChatRecord[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 'A' });

  const records: ChatRecord[] = json.slice(1).map((row: any) => ({
    time:     String(row.C || ''),
    roleName: String(row.D || ''),
    type:     String(row.E || ''),
    content:  String(row.F || ''),
    target:   String(row.H || ''),
  })).filter((r: ChatRecord) => r.roleName && r.content);

  records.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  console.log(`[Parser] Parsed ${records.length} chat records from Excel`);
  return records;
}

/**
 * Convert scraped HTML table rows into RechargeRecord[].
 * Rows come from GmClient.scrapeRechargeRecords() as string[][].
 */
export function parseRechargeRows(rows: string[][]): RechargeRecord[] {
  const { amount, roleName, status, method } = RECHARGE_COL_MAP;
  const records: RechargeRecord[] = rows
    .map(row => ({
      amount:   row[amount]   ?? '',
      roleName: row[roleName] ?? '',
      status:   row[status]   ?? '',
      method:   row[method]   ?? '',
    }))
    .filter(r => r.roleName);

  console.log(`[Parser] Parsed ${records.length} recharge records from HTML`);
  return records;
}
