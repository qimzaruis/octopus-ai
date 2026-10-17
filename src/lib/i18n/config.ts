/**
 * ค่ากลางของระบบสองภาษา (TH/EN)
 *
 * เลือกใช้ "ข้อความไทยเป็นคีย์" แทนการตั้งชื่อคีย์เอง (เช่น t("dashboard.title"))
 * เหตุผล: ข้อความทั้งเว็บมีกว่า 600 จุด การตั้งชื่อคีย์เองเท่ากับงานเขียนซ้ำสองเท่า
 * และเสี่ยงพิมพ์คีย์ผิดโดยไม่มีอะไรจับได้ วิธีนี้ใช้ข้อความจริงเป็นกุญแจ
 * → อ่านโค้ดแล้วรู้ทันทีว่าแปลอะไรอยู่ และถ้าลืมแปล หน้าจอจะยังแสดงไทยได้ (ไม่พัง)
 */

export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "th";

/** ชื่อ cookie ที่จํา locale — ต้องตรงกับที่อ่านใน getLocale() */
export const LOCALE_COOKIE = "octopus_locale";

/** อายุ cookie 1 ปี (ผู้ใช้ไม่ต้องเลือกภาษาซ้ําทุกครั้ง) */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** ป้ายชื่อภาษาในเมนูสลับภาษา */
export const LOCALE_LABEL: Record<Locale, string> = { th: "TH", en: "EN" };

/** ใช้กับ attribute lang ของ <html> */
export const HTML_LANG: Record<Locale, string> = { th: "th", en: "en" };