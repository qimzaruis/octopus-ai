/**
 * Key limit — จับสัญญาณ "คีย์นี้โควต้าหมด" ตามกติกาของแต่ละ provider
 *
 * เหตุผลที่ไม่ hardcode ใน gateway: ลิมิตของโควต้าหน้าตาไม่เหมือนกันตามค่าย
 * บางค่ายตอบ HTTP 402 + code `insufficient_quota` ("Quota exceeded. Enable
 * overusage or upgrade your plan to continue.") เมื่อเครดิตหมดและรีเซตทุกวัน
 * 13:00 เวลาไทย ส่วนค่ายอื่นมักใช้ 429 พร้อมรอบรีเซตคนละแบบ กติกาจึงเก็บเป็น
 * ข้อมูลต่อ provider (ตาราง provider_key_limits) แก้ได้จาก /admin/key-limits
 *
 * ผลลัพธ์ของการจับได้: ตั้ง provider_keys.limit_until = เวลารีเซตครั้งถัดไป
 * คีย์นั้นจะถูกข้ามทั้งวัน (ไม่เอามา backoff ซ้ำ ๆ) แล้วกลับมาใช้เองเมื่อถึงเวลา
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { providerKeyLimits } from "@/db/schema";
import { isDemoMode } from "@/lib/config";
import { cached } from "@/lib/catalog-cache";
import { getDemoStore } from "@/lib/demo/store";

/** กติกาหนึ่งชุดของ provider ใด provider หนึ่ง */
export type KeyLimitRule = {
  enabled: boolean;
  /** HTTP status ที่ถือว่าติดลิมิต เช่น [402] หรือ [429] */
  httpStatuses: number[];
  /** ข้อความที่ต้องพบใน body (ใช้กับ error.code / error.type เช่น insufficient_quota) */
  errorCodes: string[];
  /** คำสำคัญในข้อความ error เช่น "quota exceeded" */
  keywords: string[];
  /** เวลา "HH:MM" ที่โควต้ารีเซต */
  resetTime: string;
  /** IANA timezone ของเวลานั้น เช่น "Asia/Bangkok" */
  resetTimezone: string;
};

const RULE_TTL_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * กติกาของ provider นี้ (null = ไม่ใช้กฎลิมิต ให้กลับไปที่ backoff ปกติ)
 *
 * อ่านไม่สำเร็จได้แต่ห้ามทำให้ request ของลูกค้าพังตาม จึงครอบ try/catch ไว้
 * และแถวที่ไม่มีการกรอกเงื่อนไขเลยถือเท่ากันกับ "ปิดอยู่" กันพลาดบล็อกคีย์ทั้งระบบ
 */
export function keyLimitRule(providerId: number): Promise<KeyLimitRule | null> {
  if (isDemoMode) return Promise.resolve(demoRule(providerId));
  return cached(`keylimit:${providerId}`, RULE_TTL_MS, () => loadRule(providerId).catch(() => null));
}

async function loadRule(providerId: number): Promise<KeyLimitRule | null> {
  const row = (
    await getDb().select().from(providerKeyLimits).where(eq(providerKeyLimits.providerId, providerId))
  )[0];
  if (!row) return null;
  return toRule({
    enabled: row.enabled,
    httpStatuses: row.httpStatuses ?? [],
    errorCodes: row.errorCodes ?? [],
    keywords: row.keywords ?? [],
    resetTime: row.resetTime,
    resetTimezone: row.resetTimezone,
  });
}

function demoRule(providerId: number): KeyLimitRule | null {
  const row = getDemoStore().keyLimits.find((r) => r.providerId === providerId);
  if (!row) return null;
  return toRule({
    enabled: row.enabled,
    httpStatuses: row.httpStatuses ?? [],
    errorCodes: row.errorCodes ?? [],
    keywords: row.keywords ?? [],
    resetTime: row.resetTime,
    resetTimezone: row.resetTimezone,
  });
}

function toRule(r: KeyLimitRule): KeyLimitRule | null {
  if (!r.enabled) return null;
  if (r.httpStatuses.length === 0 && r.errorCodes.length === 0 && r.keywords.length === 0) {
    return null;
  }
  return r;
}

/**
 * ตอบว่า response ล้มเหลวนี้ "คือคีย์ติดลิมิต" ไหม + เหตุผลสั้น ๆ ไว้แสดงใน admin
 *
 * errorCodes/keywords เทียบแบบ substring ใน body (พิมพ์เล็ก) เพราะแต่ละค่าย
 * วาง code ไว้คนละชั้น (error.code / error.type / บนสุด) การอ่าน body เป็น JSON
 * แล้วเลือกฟิลด์จึงเปราะบางกว่าการหาข้อความที่แอดมินกรอกไว้
 */
export function matchKeyLimit(
  status: number,
  body: string,
  rule: KeyLimitRule,
): string | null {
  if (status < 400) return null;
  const lower = body.toLowerCase();
  const byStatus = rule.httpStatuses.includes(status);
  const byCode = rule.errorCodes.find((c) => c.trim() && lower.includes(c.trim().toLowerCase()));
  const byKeyword = rule.keywords.find((k) => k.trim() && lower.includes(k.trim().toLowerCase()));

  if (!byStatus && !byCode && !byKeyword) return null;
  const reason = [byStatus ? String(status) : null, byCode, byKeyword ? `"${byKeyword}"` : null]
    .filter(Boolean)
    .join(" · ");
  return reason.slice(0, 120);
}

/** "HH:MM" → ชั่วโมง+นาที (ค่าไม่ถูกต้อง = เที่ยงคืนของโซนนั้น) */
function parseClock(value: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return { hour: 0, minute: 0 };
  return {
    hour: Math.min(23, Number(m[1])),
    minute: Math.min(59, Number(m[2])),
  };
}

/** ผลต่างนาฬิกาของโซนนั้นกับ UTC (ms) — timezone ไม่ถูกต้องถือว่า UTC */
function zoneOffsetMs(timeZone: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    return asUtc - Math.floor(at.getTime() / 1000) * 1000;
  } catch {
    return 0;
  }
}

/**
 * เวลารีเซตถัดไปของ provider นี้ (เสมอ = เวลาในอนาคต)
 *
 * คิดแบบ "นาฬิกาของโซนนั้น" แล้วค่อยแปลงกลับเป็น UTC พร้อมเช็ก offset ซ้ำ
 * ที่เวลานั้น จึงไม่คลาดเมื่อโซนปลายทางเปลี่ยน DST (ไทยไม่มี DST แต่ค่ายอื่นอาจมี)
 */
export function nextResetAt(
  rule: Pick<KeyLimitRule, "resetTime" | "resetTimezone">,
  now = new Date(),
): Date {
  const tz = rule.resetTimezone?.trim() || "UTC";
  const { hour, minute } = parseClock(rule.resetTime ?? "");
  const offset = zoneOffsetMs(tz, now);
  const wallNow = now.getTime() + offset;
  let wall =
    Math.floor(wallNow / DAY_MS) * DAY_MS + hour * 3_600_000 + minute * 60_000;
  if (wall <= wallNow) wall += DAY_MS;

  let utc = wall - offset;
  for (let i = 0; i < 2; i += 1) utc = wall - zoneOffsetMs(tz, new Date(utc));

  // กันเคสแปลก ๆ (ค่าเวลาไม่ถูกต้อง / ข้าม DST) ทำให้คีย์ถูกบล็อกถาวร
  const at = new Date(utc);
  if (!(at.getTime() > now.getTime())) return new Date(now.getTime() + 60 * 60_000);
  const maxUntil = now.getTime() + 8 * DAY_MS;
  return at.getTime() > maxUntil ? new Date(maxUntil) : at;
}
