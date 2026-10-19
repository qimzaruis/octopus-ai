import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { normalizeDbUrl } from "@/lib/db-url";

export { normalizeDbUrl };

let client: postgres.Sql | null = null;

/**
 * Session pooler ของ Supabase ให้ถือ connection พร้อมกันได้แค่ pool_size (15)
 * ซึ่งเครื่อง dev กับ lambda บน Vercel ใช้ quota ร่วมกันทั้งโครงการ
 *
 * เดิม idle_timeout 600 ทำให้ lambda ที่เพิ่งใช้งานเสร็จค้าง connection ไว้ 10 นาที
 * และ max 2 ต่อ instance ยิ่งมีหลาย instance ก็ยิ่งกิน quota เร็ว — result คือ
 * EMAXCONNSESSION แล้ว circuit breaker เปิด ทำให้หน้าเว็บอ่าน catalog ไม่ได้เลย
 *
 * ค่าเวลาทุกตัวในไฟล์นี้หน่วยเป็น "วินาที" (ตาม docs ของ postgres.js)
 */
export function getDb() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!client) {
    // เครื่อง dev ต้องเผื่อ quota ให้เว็บจริงด้วย เพราะใช้ฐานข้อมูลโครงการเดียวกัน
    const isDevHost = (process.env.APP_ENV ?? process.env.NODE_ENV ?? "development") === "development";
    client = postgres(normalizeDbUrl(raw), {
      prepare: false,
      // 1 connection ต่อ process ก็พอ: postgres.js วาง query ที่ยิงพร้อมกัน (Promise.all)
      // ไว้ใน pipeline เดียว วัดจริง 6 query พร้อมกันบน connection เดียว ~= เวลาของ query ตัวเดียว
      // (การเปิด connection ใหม่ไป pooler วัดได้ ~2.6 วินาที ส่วน query บนตัวเดิม ~350ms)
      max: 1,
      // ฝั่ง production คืน connection เร็ว เพราะ lambda ที่พักยังถือ slot ของ pooler อยู่
      // ส่วนเครื่อง dev ใช้ 60 วินาที: ถ้าสั้นกว่านั้น ผู้ใช้พิมพ์ต่อช้ากว่าค่านี้ทีไร
      // ต้องจ่ายค่าเปิด connection ใหม่ 2.6 วินาทีก่อน query แรกของหน้าานั้นทั้งที่ใช้ slot ตัวเดียว
      idle_timeout: isDevHost ? 60 : 30,
      max_lifetime: 60 * 10,
      // DB เข้าถึงไม่ได้ให้ล้มเร็ว อย่าค้าง 20+ วินาที (auth.ts มี fallback profile อยู่แล้ว)
      connect_timeout: 5,
    });
  }
  return drizzle(client, { schema });
}

export { schema };
