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
      // ไม่เปิด connection ใหม่ทุก query เพราะการเปิดหนึ่งครั้งไป Supabase pooler วัดได้ ~2.5 วินาที
      // (query ปกติบน connection ที่เปิดแล้วเพียง ~350ms) แต่ต้องถือไว้น้อยตัวที่สุด
      max: isDevHost ? 1 : 2,
      // คืน connection เร็วลงมาก ถ้าทิงไว้ lambda ตัวอื่นจะขอไม่ได้
      idle_timeout: isDevHost ? 10 : 30,
      max_lifetime: 60 * 10,
      // DB เข้าถึงไม่ได้ให้ล้มเร็ว อย่าค้าง 20+ วินาที (auth.ts มี fallback profile อยู่แล้ว)
      connect_timeout: 5,
    });
  }
  return drizzle(client, { schema });
}

export { schema };
