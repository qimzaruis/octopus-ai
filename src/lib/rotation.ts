/**
 * Rotation engine — ลำดับคีย์ของ provider และคำนวณ backoff
 *
 * เป็นฟังก์ชันบริสุทธิ์ (ไม่แตะ DB) เพื่อให้เทสได้ตรง ๆ
 * ส่วนที่บันทึกผลลง DB อยู่ที่ recordKeyResult()/markKeyLimited() ใน lib/data/admin.ts
 *
 * gateway เรียก orderedKeys() เพื่อไล่ลองคีย์ของค่ายเดียวกันตามลำดับ
 * (primary → ใช้นานสุดแล้ว → พลาดน้อยสุด) และข้ามคีย์ที่ติด cooldown หรือติดลิมิตโควต้า
 */

/** ข้อมูลคีย์เท่าที่ engine ต้องใช้ตัดสินใจ */
export type RotatableKey = {
  id: number;
  enabled: boolean;
  isPrimary: boolean;
  failureCount: number;
  cooldownUntil: Date | string | null;
  lastUsedAt: Date | string | null;
  /**
   * พักเพราะ "โควต้าของค่ายหมด" (ต่างจาก cooldownUntil ที่เกิดจาก error ชั่วคราว)
   * ค่านี้คือเวลารีเซตของค่าย จึงข้ามคีย์นี้จนกว่าจะถึงเวลานั้น — ดู lib/key-limit
   */
  limitUntil?: Date | string | null;
};

function timeOf(v: Date | string | null | undefined): number {
  if (!v) return 0;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** คีย์นี้ติด cooldown อยู่หรือยัง ณ เวลานั้น */
export function isCoolingDown(key: RotatableKey, now: Date = new Date()): boolean {
  const until = timeOf(key.cooldownUntil);
  return until > now.getTime();
}

/** คีย์นี้กำลังติดลิมิตโควต้าอยู่หรือยัง */
export function isKeyLimited(key: RotatableKey, now: Date = new Date()): boolean {
  return timeOf(key.limitUntil) > now.getTime();
}

/**
 * ลำดับ backoff หลังล้มเหลวติดกัน (มิลลิวินาที) — เกินกว่าลิสต์ใช้ค่าสุดท้าย
 * 30 วินาที → 2 นาที → 10 นาที → 30 นาที
 */
const BACKOFF_STEPS_MS = [30_000, 120_000, 600_000, 1_800_000];

export function backoffMs(failureCount: number): number {
  if (failureCount <= 0) return 0;
  const idx = Math.min(failureCount - 1, BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[idx];
}

/** เวลาที่ควรปลด cooldown หลังล้มเหลวครั้งที่ failureCount */
export function cooldownUntilFrom(failureCount: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + backoffMs(failureCount));
}

/**
 * ลำดับคีย์ที่ควรใช้ (มาก → น้อย)
 *
 * เกณฑ์: เปิดใช้งาน, ไม่ติด cooldown, ไม่ติดลิมิตโควต้า
 * เรียง: isPrimary ก่อน → ใช้นานที่สุดแล้ว (lastUsedAt เก่าสุด / ยังไม่เคยใช้)
 *        → failureCount น้อยสุด → id น้อยสุด (ให้ผลคงที่)
 *
 * gateway ไล่รายการนี้จนครบ เพื่อ "ข้ามไปคีย์ถัดไปที่ไม่ติดลิมิต" ของค่ายเดียวกัน
 * (เดิมลองได้แค่ตัวเดียว แล้วกระโดดไปโมเดลอื่นทั้งที่คีย์สำรองยังใช้ได้)
 */
export function orderedKeys<T extends RotatableKey>(
  keys: T[],
  now: Date = new Date(),
): T[] {
  return keys
    .filter((k) => k.enabled && !isCoolingDown(k, now) && !isKeyLimited(k, now))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      const la = timeOf(a.lastUsedAt);
      const lb = timeOf(b.lastUsedAt);
      if (la !== lb) return la - lb; // ยังไม่เคยใช้ (0) มาก่อน, ใช้นานสุดมาก่อน
      if (a.failureCount !== b.failureCount) return a.failureCount - b.failureCount;
      return a.id - b.id;
    });
}

/** สถานะสุขภาพของคีย์ สำหรับแสดงใน UI */
export type KeyHealth = "ready" | "cooling" | "limited" | "disabled";

export function keyHealth(key: RotatableKey, now: Date = new Date()): KeyHealth {
  if (!key.enabled) return "disabled";
  // ลิมิตโควต้า informative กว่า cooldown เพราะยาวกว่าและรีเซตตามเวลาของค่าย
  if (isKeyLimited(key, now)) return "limited";
  if (isCoolingDown(key, now)) return "cooling";
  return "ready";
}

/** เวลาที่เหลือของ cooldown (นาที, ปัดขึ้น) — ใช้แสดงผล */
export function cooldownMinutesLeft(key: RotatableKey, now: Date = new Date()): number {
  const ms = timeOf(key.cooldownUntil) - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 60_000);
}

/** เวลาที่เหลือของลิมิตโควต้า (นาที, ปัดขึ้น) — ใช้แสดงผล */
export function limitMinutesLeft(key: RotatableKey, now: Date = new Date()): number {
  const ms = timeOf(key.limitUntil) - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 60_000);
}
