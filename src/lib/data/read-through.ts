/**
 * อ่านข้อมูลพร้อม "ค่าล่าสุดที่อ่านสำเร็จ" ต่อคีย์
 *
 * ใช้กับหน้าที่ผู้ใช้เปิดดู (dashboard/admin) ซึ่งการล้มครั้งเดียวไม่ควรทำให้
 * ทั้งหน้าเปลี่ยนเป็น "ไม่มีข้อมูล" — คืน snapshot ล่าสุดไปก่อนระหว่างที่ DB สะดุด
 * และไม่แคชผลล้มเหลวไว้ (ต่างจาก cached() ที่เคยแคช [] ไปหลายสิบวินาที)
 */
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";
import { withDbRetry } from "@/lib/db-retry";

type Snapshot = { at: number; value: unknown };

const snapshots = new Map<string, Snapshot>();
const MAX_KEYS = 200;

/** คืน null เมื่ออ่านไม่สำเร็จและยังไม่เคยมี snapshot — ผู้เรียกเลือกค่าศูนย์เองได้ */
export async function readThrough<T>(
  key: string,
  load: () => Promise<T>,
  onError?: (err: unknown) => void,
): Promise<T | null> {
  const snapshot = snapshots.get(key);
  if (isDbUnavailable() && snapshot) return snapshot.value as T;

  try {
    const value = await withDbRetry(load);
    if (snapshots.size >= MAX_KEYS && !snapshots.has(key)) {
      const oldest = [...snapshots.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) snapshots.delete(oldest[0]);
    }
    snapshots.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (onError) onError(err);
    else console.error("[db] อ่านข้อมูลไม่สำเร็จ:", err);
    const isTransient = !/constraint|syntax|does not exist|permission denied|invalid input/i.test(
      err instanceof Error ? err.message : String(err),
    );
    if (isTransient) markDbUnavailable(err);
    return (snapshot?.value as T) ?? null;
  }
}
