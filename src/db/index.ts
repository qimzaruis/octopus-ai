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
    client = postgres(normalizeDbUrl(raw), {
      prepare: false,
      max: 10,
      // ถ้า DB เข้าถึงไม่ได้ ให้ล้มเร็วแทนที่จะค้าง 20+ วินาที (fallback profile ใน auth.ts)
      connect_timeout: 5,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
    });
  }
  return drizzle(client, { schema });
}

export { schema };
