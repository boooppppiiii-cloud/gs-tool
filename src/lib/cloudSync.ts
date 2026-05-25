import { db } from './firebase';

export function cloudSet(collection: string, id: string, data: object) {
  db.collection(collection).doc(id).set(data).catch(e =>
    console.warn(`[CloudSync] ${collection}/${id} 写入失败`, e)
  );
}

export function cloudDelete(collection: string, id: string) {
  (db.collection(collection).doc(id) as any).remove().catch(e =>
    console.warn(`[CloudSync] ${collection}/${id} 删除失败`, e)
  );
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
