import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.crawler') });

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}. Copy .env.crawler.example → .env.crawler and fill it in.`);
  return val;
}

export interface GsUser {
  gsUserId: string;
  gsGroup: string;
  serverName: string;
  rechargePlayerIds: string[];
}

function loadUsers(): GsUser[] {
  const usersPath = path.resolve(__dirname, 'users.json');
  if (!fs.existsSync(usersPath)) {
    throw new Error('users.json not found. Create it from the example in README.md.');
  }
  const users: GsUser[] = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('users.json is empty or invalid. Add at least one GS user entry.');
  }
  return users;
}

export const config = {
  GM_CHAT_URL:      require_env('GM_CHAT_URL'),
  GM_CHAT_USERNAME: require_env('GM_CHAT_USERNAME'),
  GM_CHAT_PASSWORD: require_env('GM_CHAT_PASSWORD'),
  GM_RECHARGE_URL:  require_env('GM_RECHARGE_URL'),

  APP_SERVER_URL: process.env.APP_SERVER_URL ?? 'http://localhost:3000',

  CRON_MORNING: '0 9 * * *',
  CRON_EVENING: '0 18 * * *',

  SESSIONS_DIR: path.resolve(__dirname, 'sessions'),
  TMP_DIR:      path.resolve(__dirname, 'tmp'),
};

export { loadUsers };
