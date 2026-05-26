async function dbPost(path: string, body: object): Promise<any> {
  const res = await fetch(`/api/db/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DB proxy ${path} error: ${res.status}`);
  return res.json();
}

export async function cloudSet(collection: string, id: string, data: object): Promise<void> {
  try { await dbPost('upsert', { collection, id, data }); }
  catch (e) { console.warn(`[CloudSync] ${collection}/${id} upsert 失败`, e); }
}

export async function cloudUpdate(collection: string, id: string, data: object): Promise<void> {
  try { await dbPost('update', { collection, id, data }); }
  catch (e) { console.warn(`[CloudSync] ${collection}/${id} update 失败`, e); }
}

export async function cloudDelete(collection: string, id: string): Promise<void> {
  try { await dbPost('delete', { collection, id }); }
  catch (e) { console.warn(`[CloudSync] ${collection}/${id} 删除失败`, e); }
}

export async function cloudFetchAll<T>(collection: string, orderBy?: string): Promise<T[]> {
  try {
    const res = await dbPost('getAll', { collection, ...(orderBy && { orderBy }) });
    return res.data || [];
  } catch (e) { console.warn(`[CloudSync] ${collection} 拉取失败`, e); return []; }
}

export async function cloudFetchWhere<T>(collection: string, field: string, value: string): Promise<T[]> {
  try {
    const res = await dbPost('where', { collection, field, value });
    return res.data || [];
  } catch (e) { console.warn(`[CloudSync] ${collection} 查询失败`, e); return []; }
}

export async function testCloudWrite(): Promise<{ ok: boolean; message: string }> {
  try {
    const testId = `_test_${Date.now()}`;
    await dbPost('upsert', { collection: 'analytics_logs', id: testId, data: {
      action: '_cloud_sync_test', timestamp: new Date().toISOString(),
    }});
    await dbPost('delete', { collection: 'analytics_logs', id: testId });
    return { ok: true, message: '云端写入成功 ✓' };
  } catch (e: any) {
    return { ok: false, message: `写入失败：${e?.message || String(e)}` };
  }
}
