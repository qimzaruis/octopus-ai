/**
 * Rotation engine — เลือกคีย์ถัดไปของ provider และคำนวณ backoff
 *
 * เป็นฟังก์ชันบริสุทธิ์ (ไม่แตะ DB) เพื่อให้เทสได้ตรง ๆ
 * ส่วนที่บันทึกผลลง DB อยู่ที่ recordKeyResult() ใน lib/data/admin.ts
 *
 * เหตุผลที่แยกออกมา: ตอนนี้ยังไม่มี API gateway จริงที่รับ request จากลูกค้า
 * engine นี้จึงยังไม่มีจุดเรียกใน runtime — เตรียมไว้ให้ gateway เรียก pickKey()
 * ตอนเลือกคีย์, แล้วเรียก recordKeyResult() ตอนรู้ผล เพื่อให้ระบบหมุนคีย์เองได้ทันทีที่ต่อ gateway
 */

/** ข้อมูลคีย์เท่าที่ engine ต้องใช้ตัดสินใจ */
export type RotatableKey = {
  id: number;
  enabled: boolean;
  isPrimary: boolean;
  failureCount: number;
  cooldownUntil: Date | string | null;
  lastUsedAt: Date | string | null;
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
 * เลือกคีย์ที่ควรใช้ถัดไป
 *
 * เกณฑ์: เปิดใช้งาน และไม่ติด cooldown
 * เรียง: isPrimary ก่อน → ใช้นานที่สุดแล้ว (lastUsedAt เก่าสุด / ยังไม่เคยใช้)
 *        → failureCount น้อยสุด → id น้อยสุด (ให้ผลคงที่)
 *
 * คืน null ถ้าไม่มีคีย์ที่ใช้ได้ (ให้ caller ตัดสินใจ fallback ไป provider ถัดไป)
 */
export function pickKey<T extends RotatableKey>(
  keys: T[],
  now: Date = new Date(),
): T | null {
  const usable = keys.filter((k) => k.enabled && !isCoolingDown(k, now));
  if (usable.length === 0) return null;

  const sorted = [...usable].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    const la = timeOf(a.lastUsedAt);
    const lb = timeOf(b.lastUsedAt);
    if (la !== lb) return la - lb; // ยังไม่เคยใช้ (0) มาก่อน, ใช้นานสุดมาก่อน
    if (a.failureCount !== b.failureCount) return a.failureCount - b.failureCount;
    return a.id - b.id;
  });

  return sorted[0] ?? null;
}

/** สถานะสุขภาพของคีย์ สำหรับแสดงใน UI */
export type KeyHealth = "ready" | "cooling" | "disabled";

export function keyHealth(key: RotatableKey, now: Date = new Date()): KeyHealth {
  if (!key.enabled) return "disabled";
  if (isCoolingDown(key, now)) return "cooling";
  return "ready";
}

/** เวลาที่เหลือของ cooldown (นาที, ปัดขึ้น) — ใช้แสดงผล */
export function cooldownMinutesLeft(key: RotatableKey, now: Date = new Date()): number {
  const ms = timeOf(key.cooldownUntil) - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 60_000);
}