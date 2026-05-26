import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.crawler from project root (one level up from crawler/)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.crawler') });

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}. Copy .env.crawler.example → .env.crawler and fill it in.`);
  return val;
}

export const config = {
  // GM backend
  GM_URL:          require_env('GM_URL'),
  GM_USERNAME:     require_env('GM_USERNAME'),
  GM_PASSWORD:     require_env('GM_PASSWORD'),
  GM_CHAT_PATH:    process.env.GM_CHAT_PATH    ?? '/chat/records',
  GM_RECHARGE_PATH: process.env.GM_RECHARGE_PATH ?? '/recharge/records',

  // GS identity (whose account this crawler acts as)
  GS_USER_ID: require_env('GS_USER_ID'),
  GS_GROUP:   require_env('GS_GROUP'),

  // Local app server (proxies Gemini + CloudBase)
  APP_SERVER_URL: process.env.APP_SERVER_URL ?? 'http://localhost:3000',

  // Cron schedules (Asia/Shanghai)
  CRON_MORNING: '0 9 * * *',   // 09:00 daily
  CRON_EVENING: '0 18 * * *',  // 18:00 daily

  // Tmp dir for downloaded files
  TMP_DIR: path.resolve(__dirname, 'tmp'),
};
