import { db, auth } from './firebase';

export async function cloudSet(collection: string, id: string, data: object): Promise<void> {
  try {
    await (db.collection(collection) as any).add({ _id: id, ...data });
  } catch (addErr: any) {
    const code = String(addErr?.code || addErr?.message || '');
    if (code.includes('-502008') || code.toLowerCase().includes('duplicate') || code.toLowerCase().includes('exist')) {
      try {
        await db.collection(collection).doc(id).update(data);
      } catch (updateErr) {
        console.warn(`[CloudSync] ${collection}/${id} 更新失败`, updateErr);
      }
    } else {
      console.warn(`[CloudSync] ${collection}/${id} 创建失败`, addErr);
    }
  }
}

export async function cloudDelete(collection: string, id: string): Promise<void> {
  try {
    await (db.collection(collection).doc(id) as any).remove();
  } catch (e) {
    console.warn(`[CloudSync] ${collection}/${id} 删除失败`, e);
  }
}

export async function cloudFetchAll<T>(collection: string): Promise<T[]> {
  try {
    const res = await db.collection(collection).limit(1000).get();
    return (res.data || []) as T[];
  } catch (e) {
    console.warn(`[CloudSync] ${collection} 拉取失败`, e);
    return [];
  }
}

export async function cloudFetchWhere<T>(
  collection: string,
  field: string,
  value: string
): Promise<T[]> {
  try {
    const res = await db.collection(collection).where({ [field]: value }).limit(500).get();
    return (res.data || []) as T[];
  } catch (e) {
    console.warn(`[CloudSync] ${collection} 查询失败`, e);
    return [];
  }
}

export async function testCloudWrite(): Promise<{ ok: boolean; message: string }> {
  const testId = `_test_${Date.now()}`;
  try {
    const state = await auth.getLoginState();
    if (!state?.user) return { ok: false, message: '未检测到登录态，请先登录' };

    await (db.collection('analytics_logs') as any).add({
      _id: testId,
      action: '_cloud_sync_test',
      timestamp: new Date().toISOString(),
      userId: (state.user as any).uid || 'unknown',
    });

    try { await (db.collection('analytics_logs').doc(testId) as any).remove(); } catch {}
    return { ok: true, message: '云端写入成功 ✓' };
  } catch (e: any) {
    return {
      ok: false,
      message: `写入失败：${e?.code || e?.message || JSON.stringify(e)}`,
    };
  }
}
