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
    });
  }
  return drizzle(client, { schema });
}

export { schema };
