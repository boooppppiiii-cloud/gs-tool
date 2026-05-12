import cloudbase from '@cloudbase/js-sdk';

const ENV_ID = process.env.CLOUDBASE_ENV_ID!;

export const app = cloudbase.init({ env: ENV_ID });
export const auth = app.auth({ persistence: 'local' });
export const db = app.database();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`CloudBase Error [${operationType}] ${path}:`, error);
  throw error;
}

export async function loginOrRegister(email: string, password: string) {
  // 先尝试登录（注意：SDK 需要两个独立字符串参数，不是对象）
  try {
    await (auth as any).signInWithEmailAndPassword(email, password);
    const state = await auth.getLoginState();
    if (state?.user) return state.user;
  } catch (signInErr: any) {
    const signInMsg = String(signInErr?.message || signInErr?.code || signInErr || '');
    // 明确的密码错误，直接抛出，不尝试注册
    if (
      (signInMsg.includes('INVALID_PASSWORD') || signInMsg.includes('incorrect') || signInMsg.includes('wrong')) &&
      !signInMsg.includes('email must be')
    ) {
      throw new Error('密码错误，请重新输入');
    }
  }

  // 尝试注册新账号
  try {
    await (auth as any).signUpWithEmailAndPassword(email, password);
    // 注册后立即再次登录（有些 CloudBase 版本注册不自动登录）
    try { await (auth as any).signInWithEmailAndPassword(email, password); } catch (_) { /* ignore */ }
    const state = await auth.getLoginState();
    if (state?.user) return state.user;
    // getLoginState 仍为 null → CloudBase 要求邮箱验证
    throw new Error('EMAIL_VERIFICATION_REQUIRED');
  } catch (signUpErr: any) {
    const msg = String(signUpErr?.message || signUpErr?.code || signUpErr || '');
    if (msg === 'EMAIL_VERIFICATION_REQUIRED') throw signUpErr;
    if (msg.includes('400') || msg.includes('not enabled') || msg.includes('OPERATION_FORBIDDEN') || msg.includes('forbidden')) {
      throw new Error('CLOUDBASE_EMAIL_NOT_ENABLED');
    }
    // 邮箱已注册 → 密码错误（登录阶段也失败了，说明密码不对）
    if (msg.includes('already') || msg.includes('exist') || msg.includes('registered') || msg.includes('duplicate')) {
      throw new Error('密码错误，请重新输入');
    }
    throw signUpErr;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const state = await auth.getLoginState();
  return state?.user?.uid ?? null;
}
