import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { normalizeDbUrl } from "@/lib/db-url";

export { normalizeDbUrl };

let client: postgres.Sql | null = null;

/**
 * Drizzle client สำหรับ Supabase Postgres — ใช้ฝั่ง server เท่านั้น
 */
export function getDb() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!client) {
    // Session pooler ของ Supabase จำกัด client พร้อมกันไว้ที่ pool_size (ค่าเริ่มต้น 15) ซึ่ง
    // เครื่อง dev กับ lambda บน Vercel ใช้ quota เดียวกัน — ตอน dev โมดูลถูก rebuild ซ้ำ ๆ
    // แล้วแต่ละ instance ถือ connection ไว้ได้นาน 10 นาที ทั้งเครื่องจึงกิน quota จนหมด
    // และ request ของ user จริงบนเว็บจะขอ connection ไม่ได้ (EMAXCONNSESSION)
    const isDevHost = (process.env.APP_ENV ?? process.env.NODE_ENV ?? "development") === "development";
    client = postgres(normalizeDbUrl(raw), {
      prepare: false,
      // ไม่เปิด connection แต่ละ query ใหม่ เพราะการเปิดหนึ่งครั้งไป Supabase pooler วัดได้ ~2.5 วินาที
      // (query ปกติบน connection ที่เปิดแล้วเพียง ~350ms) จึงใช้ connection น้อยตัวแต่เก็บไว้นาน
      max: isDevHost ? 1 : 2,
      // ถ้าปิด idle_timeout เดิม (20s) ทุกครั้งที่ผู้ใช้พิมพ์ช้ากว่า 20 วินาทีจะเจอค่าเปิดใหม่
      // ตอน dev ใช้ค่าน้อยลงมาก เพราะ connection ที่ว่างคือ connection ที่เว็บจริงใช้ไม่ได้
      idle_timeout: isDevHost ? 15 : 60 * 10,
      max_lifetime: 60 * 30,
      // ถ้า DB เข้าถึงไม่ได้ ให้ล้มเร็วแทนที่จะค้าง 20+ วินาที (fallback profile ใน auth.ts)
      connect_timeout: 5,
    });
  }
  return drizzle(client, { schema });
}

export { schema };
