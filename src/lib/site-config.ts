import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { config } from "@/db/schema";
import { siteUrl as envSiteUrl } from "@/lib/config";
import { cached } from "@/lib/catalog-cache";
import { isDbUnavailable } from "@/lib/db-circuit";

const SITE_URL_KEY = "site_url";
const CACHE_TTL_MS = 60_000;

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/\s]+/i.test(trimmed)) return null;
  try {
    new URL(trimmed);
  } catch {
    return null;
  }
  return trimmed;
}

async function loadSiteUrl(): Promise<string> {
  if (isDbUnavailable()) return envSiteUrl;
  try {
    const rows = await getDb()
      .select({ value: config.value })
      .from(config)
      .where(eq(config.key, SITE_URL_KEY))
      .limit(1);
    return normalize(rows[0]?.value) ?? envSiteUrl;
  } catch (err) {
    console.error("[config] อ่าน site_url จาก DB ไม่สำเร็จ — ใช้ค่าจาก env แทน:", err);
    return envSiteUrl;
  }
}

/**
 * โดเมนจริงของเว็บ (ไม่มี slash ท้าย) — อ่านจากตาราง config ก่อน
 *
 * แก้แถว site_url ใน DB แล้วมีผลภายใน 60 วินาทีโดยไม่ต้อง deploy ใหม่
 * ถ้าตาราง/แถวยังไม่มีหรือ DB ล่ม จะถอยไปใช้ NEXT_PUBLIC_APP_URL
 */
export function getSiteUrl(): Promise<string> {
  return cached(`config:${SITE_URL_KEY}`, CACHE_TTL_MS, loadSiteUrl);
}
