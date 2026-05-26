/**
 * parser.ts — Convert raw GM data into the same format ExcelUpload.tsx produces.
 *
 * Chat CSV column mapping (same as ExcelUpload.tsx CSV branch):
 *   col[2]=time, col[3]=roleName, col[4]=type, col[5]=content, col[7]=target
 *
 * Recharge table column mapping (same as ExcelUpload.tsx Sheet2):
 *   Adjust RECHARGE_COL_MAP below to match the actual GM recharge table column order.
 */

import * as fs from 'fs';

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

// ── Adjust these 0-based column indices to match the recharge table ───────
// Open the recharge search page, count <th> columns left-to-right from 0.
const RECHARGE_COL_MAP = {
  amount:   1,
  roleName: 2,
  status:   6,
  method:   7,
};
// ──────────────────────────────────────────────────────────────────────────

/**
 * Parse a chat CSV file downloaded from the GM backend.
 * The CSV must have a header row; data starts from row 2.
 */
export function parseChatCsv(filePath: string): ChatRecord[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  // Delete temp file after reading
  try { fs.unlinkSync(filePath); } catch {}

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const records: ChatRecord[] = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    return {
      time:     cols[2] ?? '',
      roleName: cols[3] ?? '',
      type:     cols[4] ?? '',
      content:  cols[5] ?? '',
      target:   cols[7] ?? '',
    };
  }).filter(r => r.roleName && r.content);

  records.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  console.log(`[Parser] ${records.length} chat records parsed from CSV`);
  return records;
}

/**
 * Convert scraped HTML table rows into RechargeRecord[].
 * Rows come from GmClient.scrapeRechargeById() as string[][].
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

  console.log(`[Parser] ${records.length} recharge records parsed from HTML`);
  return records;
}
