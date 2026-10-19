/**
 * ทุกข้อความที่จะหลุดออกจากเซิร์ฟเวอร์ไปให้ผู้ใช้อ่าน
 *
 * ข้อความ error ของค่ายต้นทางปนข้อมูลภายในมาด้วยเสมอ — ชื่อค่าย, host ของค่าย,
 * id ปลายทางจริง และบางทีเป็น stack trace ของ bundler ที่บอโครงสร้างไฟล์ของโปรเจกต์
 * เราไม่เปิดเผยว่าระบบส่งต่อไปค่ายไหนเด็ดขาด จึงล้างทั้งหมอก่อนถึงตาผู้ใช้
 *
 * ล้างสองชั้น: ตอนเขียนลงตาราง requests (logRequest) และตอนอ่านออกมาแสดง
 * ชั้นหลังจำเป็นเพราะแถวที่เก็บไว้ก่อนมีกติกานี้ยังมีชื่อค่ายค้างอยู่ในฐานข้อมูล
 */

import { getCatalog } from "@/lib/data/catalog";

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return "";
  }
}

/** ชื่อค่าย + host ของ provider แต่ละตัว — ใช้ตัดยี่ห้อออกจากข้อความที่จะแสดงต่อผู้ใช้ */
export function brandNames(list: { name: string; baseUrl: string }[]): string[] {
  return list.flatMap((p) => [p.name, hostOf(p.baseUrl)]);
}

export type InternalIdentities = {
  /** ชื่อค่าย + host ของค่ายต้นทางทุกตัวที่ระบบรู้จัก */
  brands: string[];
  /** id และชื่อ display ของโมเดลปลายทางจริง (ผู้ใช้ไม่เห็นชื่อนี้) */
  targets: string[];
};

/**
 * รายชื่อข้อมูลภายในทั้งหมดของระบบ — อ่านจาก catalog snapshot (แคชอยู่แล้ว)
 * ตอน DB ไม่พร้อม snapshot จะเป็นค่าว่าง และ maskInternals จะ fail closed
 * (ส่งข้อความกลาง ๆ แทน ไม่ส่งข้อความดิบที่มียี่ห้อปนออกเด็ดขาด)
 */
export async function internalIdentities(): Promise<InternalIdentities> {
  const catalog = await getCatalog();
  return {
    brands: brandNames(catalog.providers),
    targets: catalog.models.flatMap((m) => [m.modelId, m.displayName]),
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** token ของ bundler ซึ่งปน path ไฟล์ในโปรเจกต์มาใน stack trace */
const BUNDLE_NOISE = /[^\s]*(?:__|\$[0-9a-f]{2}\$|\/src\/|\.tsx?\b|\.jsx?\b|node_modules)[^\s]*/gi;

const replaceAll = (text: string, names: string[], token: string) =>
  names.reduce((acc, raw) => {
    const name = raw?.trim();
    return name && name.length >= 3 ? acc.replace(new RegExp(escapeRe(name), "gi"), token) : acc;
  }, text);

/**
 * ตัดชื่อค่าย / host / id ปลายทาง / URL / stack trace ออกจากข้อความ
 *
 * รับ identities เป็นพารามิเตอร์เพราะจุดที่เรียกซ้ำ ๆ (loop ไล่คีย์) ควรถ่าย_once
 * แล้วส่งต่อ ไม่ให้ยิง query ใหม่ทุกครั้งที่ลองล้ม
 */
export function maskInternals(text: string, ids: InternalIdentities): string {
  // ไม่มีรายชื่อค่ายให้บัง (อ่าน DB ไม่สำเร็จ) → ห้ามส่งข้อความดิบออก เพราะชื่อยี่ห้อจะหลุด
  if (ids.brands.length === 0) return "เกิดข้อผิดพลาดจากโมเดลปลายทาง";

  const out = replaceAll(
    text.replace(/https?:\/\/\S+/g, "[url]").replace(BUNDLE_NOISE, "[ภายใน]"),
    ids.brands,
    "[ค่าย]",
  );
  return replaceAll(out, ids.targets, "[ปลายทาง]")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200);
}
