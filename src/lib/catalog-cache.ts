/**
 * แคชข้อมูล "catalog" (route / โมเดลปลายทาง / แผน) ที่ถูกอ่านซ้ำในทุก request
 *
 * ข้อมูลกลุ่มนี้เปลี่ยนน้อยมาก (แอดมินแก้เท่านั้น) แต่แต่ละ query ไป Supabase
 * ใช้เวลา ~350ms ต่อรอบ — ถ้าไม่แคช แชทหนึ่งรอบต้องรอ route+targets+plan
 * รวมกันเกิน 1 วินาทีก่อนที่โมเดลจะเริ่มตอบ
 *
 * ค่าที่แคชไว้จะถูกล้างทันทีที่แอดมินบันทึกการตั้งค่า (revalidateAdmin)
 * จึงไม่เห็นข้อมูลค้างแม้ TTL ยังไม่หมด
 */
const entries = new Map<string, { at: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.at + ttlMs > Date.now()) return hit.value as Promise<T>;
  const promise = load().catch((err) => {
    entries.delete(key); // อย่าให้ request ถัดไปติด promise ที่ล้มเหลว
    throw err;
  });
  entries.set(key, { at: Date.now(), value: promise });
  return promise;
}

/** ล้างทุกคีย์เมื่อแอดมินแก้ route / โมเดล / แผน */
export function invalidateCatalog(): void {
  entries.clear();
}

/** ล้างเฉพาะกลุ่มคีย์ เช่น หลังรู้ว่า API key ตัวหนึ่งพัง จะได้ไม่ใช้ข้อมูลเก่าเลือกซ้ำ */
export function invalidateCache(prefix: string): void {
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
