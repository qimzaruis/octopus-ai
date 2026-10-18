/**
 * แผนการใช้งาน + โควต้า
 *
 * โควต้าเป็น USD ทั้งหมด: เพดานต่อรอบ (cycle) เป็นตัวหลัก และมี sub-quota รายวันได้
 * ค่าจริงถูกเก็บในตาราง `plans` ซึ่งแอดมินแก้ได้จากหน้า /admin/plans
 * ส่วนค่าในไฟล์นี้เป็น "ค่าเริ่มต้น" ที่ใช้เมื่ออ่าน DB ไม่ได้ (หรือโหมด demo)
 *
 * พฤติกรรมที่ตั้งใจ: ถ้าโควต้ารอบเต็ม ระบบถือว่าใช้ครบแล้วทันที
 * โดยไม่รีเซตกลับตามโควตารายวัน (รายวันเป็นเพดานย่อย ไม่ใช่ตัวปลดล็อก)
 */

export type PlanKey = string;

export type Plan = {
  key: PlanKey;
  label: string;
  /** ความยาวรอบรีเซตเป็นวัน */
  cycleDays: number;
  /** โควต้า USD ต่อรอบ */
  cycleQuotaUsd: number;
  /** sub-quota รายวัน USD (0 = ไม่ตั้ง) */
  dailyQuotaUsd: number;
  /** เพดาน requests ต่อรอบ (0 = ไม่จํากัด) */
  cycleRequests: number;
  concurrentModels: number;
  fallback: boolean;
  /** ลำดับขั้นของแผน (0 = ฟรี) — ใช้เทียบสิทธิ์การเข้าถึงโมเดล */
  tier: number;
};

export const DEFAULT_PLANS: Record<string, Plan> = {
  free: {
    key: "free",
    label: "Free",
    cycleDays: 7,
    cycleQuotaUsd: 5,
    dailyQuotaUsd: 1,
    cycleRequests: 0,
    concurrentModels: 3,
    fallback: false,
    tier: 0,
  },
  pro: {
    key: "pro",
    label: "Pro",
    cycleDays: 30,
    cycleQuotaUsd: 50,
    dailyQuotaUsd: 5,
    cycleRequests: 0,
    concurrentModels: 20,
    fallback: true,
    tier: 1,
  },
};

/** ความยาวรอบที่อนุญาต (วัน) — ใช้ทั้งใน UI และการตรวจค่า */
export const CYCLE_DAY_OPTIONS = [1, 7, 30] as const;

export function getPlan(key: string | null | undefined): Plan {
  return DEFAULT_PLANS[key ?? "free"] ?? DEFAULT_PLANS.free;
}

/**
 * ช่วงเวลาของรอบปัจจุบัน (นับย้อนจากตอนนี้เป็นเวลา cycleDays)
 *
 * ใช้ rolling window ไม่ผูกกับวันตามปฏิทิน เพื่อให้ "รอบ 7 วัน" หมายถึง
 * 7 วันล่าสุดจริง ๆ ไม่ใช่สัปดาห์ปฏิทิน
 */
export function cycleStart(cycleDays: number, now: Date = new Date()): Date {
  const days = cycleDays > 0 ? cycleDays : 30;
  return new Date(now.getTime() - days * 86_400_000);
}

/** เริ่มต้นของวันนี้ (เวลาไทย) — ใช้กับ sub-quota รายวัน */
export function dayStart(now: Date = new Date()): Date {
  const TZ_OFFSET_MS = 7 * 3600_000;
  const nowBkk = new Date(now.getTime() + TZ_OFFSET_MS);
  return new Date(
    Date.UTC(nowBkk.getUTCFullYear(), nowBkk.getUTCMonth(), nowBkk.getUTCDate()) - TZ_OFFSET_MS,
  );
}

/** จำนวนวันเต็มที่เหลือก่อนรอบรีเซต (อย่างน้อย 0) */
export function daysUntilReset(cycleDays: number, now: Date = new Date()): number {
  // รอบเป็น rolling window จากตอนนี้ จึงเหลือเต็ม cycleDays เสมอเมื่อเริ่มนับใหม่
  return Math.max(0, cycleDays > 0 ? cycleDays : 30);
}

export type QuotaUsage = {
  plan: Plan;
  /** ยอดที่ใช้ไปในรอบปัจจุบัน (USD) */
  cycleSpendUsd: number;
  /** คงเหลือในรอบ (USD) */
  cycleLeftUsd: number;
  /** 0–1 */
  cyclePct: number;
  /** ยอดที่ใช้ไปวันนี้ (USD) */
  dailySpendUsd: number;
  dailyLeftUsd: number;
  dailyPct: number;
  /** true เมื่อใช้ครบเพดานรอบแล้ว (บล็อกทันที ไม่รีเซตรายวัน) */
  cycleExhausted: boolean;
  dailyExhausted: boolean;
};

export function computeQuota(
  plan: Plan,
  used: { cycleSpendUsd: number; dailySpendUsd: number },
): QuotaUsage {
  const cycleQuota = plan.cycleQuotaUsd;
  const dailyQuota = plan.dailyQuotaUsd;

  const cycleLeftUsd = cycleQuota > 0 ? Math.max(0, cycleQuota - used.cycleSpendUsd) : Infinity;
  const cyclePct = cycleQuota > 0 ? Math.min(1, used.cycleSpendUsd / cycleQuota) : 0;
  const cycleExhausted = cycleQuota > 0 && used.cycleSpendUsd >= cycleQuota;

  const dailyLeftUsd = dailyQuota > 0 ? Math.max(0, dailyQuota - used.dailySpendUsd) : Infinity;
  const dailyPct = dailyQuota > 0 ? Math.min(1, used.dailySpendUsd / dailyQuota) : 0;
  // รอบเต็ม = บล็อกแล้ว รายวันจึงไม่มีความหมายว่ายังเหลือ
  const dailyExhausted =
    cycleExhausted || (dailyQuota > 0 && used.dailySpendUsd >= dailyQuota);

  return {
    plan,
    cycleSpendUsd: used.cycleSpendUsd,
    cycleLeftUsd: Number.isFinite(cycleLeftUsd) ? cycleLeftUsd : 0,
    cyclePct,
    dailySpendUsd: used.dailySpendUsd,
    dailyLeftUsd: Number.isFinite(dailyLeftUsd) ? dailyLeftUsd : 0,
    dailyPct,
    cycleExhausted,
    dailyExhausted,
  };
}