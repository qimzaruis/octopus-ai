import type { Locale } from "./config";
import { common } from "./dictionaries/common";
import { publicPages } from "./dictionaries/public";
import { appPages } from "./dictionaries/app";
import { adminPages } from "./dictionaries/admin";

/** รวมทุกหมวดเป็น map เดียว — คีย์คือข้อความไทย ค่าคือคําแปลอังกฤษ */
const RAW_DICTIONARY: Record<string, string> = {
  ...common,
  ...publicPages,
  ...appPages,
  ...adminPages,
};

/**
 * ข้อความไทยเขียนได้สองแบบที่ตาเห็นเหมือนกันแต่เป็นคนละโค้ดพอยต์
 * (สระอํา U+0E33 กับ นิคหิต U+0E4D + สระอา U+0E32) — เกิดจากเครื่องมือที่สร้างไฟล์
 * ต่างกัน ถ้าไม่จัดให้เป็นรูปเดียวกัน คีย์ที่ "ดูเหมือนตรง" จะหาไม่เจอแล้วไม่ถูกแปล
 * จึง normalize ด้วย NFC ทั้งฝั่งดิกชันนารีและฝั่งข้อความที่ส่งเข้ามา
 */
const DICTIONARY: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_DICTIONARY).map(([k, v]) => [k.normalize("NFC"), v]),
);

/** ค่าที่ใช้แทนตัวแปรในข้อความ เช่น { name: "สมชาย" } */
export type TVars = Record<string, string | number>;

/**
 * แปลข้อความจากภาษาไทยเป็นอังกฤษ
 *
 * - locale = "th" → คืนข้อความเดิม (ไม่ต้องมีดิกชันนารีฝั่งไทย เพราะต้นทางเป็นไทยอยู่แล้ว)
 * - ไม่พบคําแปล → คืนข้อความเดิม (fail-open) หน้าจอจึงไม่มีทางว่างหรือขึ้นคีย์ดิบ
 *   แต่ยังเห็นได้ทันทีว่าจุดไหนยังไม่ได้แปล
 *
 * รองรับตัวแปรแบบ {name}: t("สวัสดี {name}", { name: "สมชาย" })
 */
export function translate(locale: Locale, text: string, vars?: TVars): string {
  let out = locale === "th" ? text : (DICTIONARY[text.normalize("NFC")] ?? text);

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}

/** จํานวนคําที่แปลแล้ว — ใช้ตรวจความคืบหน้า/ทดสอบ */
export function dictionarySize(): number {
  return Object.keys(DICTIONARY).length;
}