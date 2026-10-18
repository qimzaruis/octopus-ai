/**
 * กําหนดโหมดการทํางานของแอป
 *
 * แอปนี้ไม่มีโหมดข้อมูลตัวอย่าง: ทุกหน้าอ่านจาก Supabase + Postgres เสมอ
 * ถ้ายังไม่ได้ตั้ง env ครบ → getDb()/auth จะล้มพร้อมข้อความชัดเจน ดีกว่าแสดง
 * ตัวเลขปลอมให้ผู้ใช้เห็น (ซึ่งเคยทําให้เข้าใจว่า route "octopus-free" ไม่มีอยู่จริง)
 *
 * APP_ENV=development → เปิดใช้ cookie/flow ของเครื่อง dev
 * APP_ENV=production  → ของจริงเท่านั้น
 */

/** ปฏิเสธค่าตัวอย่างที่ค้างมาจากไฟล์ template */
function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return (
    v.length === 0 ||
    v.includes("your_project") ||
    v.includes("your-project") ||
    v.includes("your_anon") ||
    v.includes("your-anon") ||
    v.includes("your_service") ||
    v.includes("replace_me") ||
    v.includes("[ref]") ||
    v.includes("[password]") ||
    v.includes("[region]")
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const databaseUrl = process.env.DATABASE_URL;

/** APP_ENV ไม่ได้ตั้ง → เดาจาก NODE_ENV (next dev = development, next start = production) */
export const appEnv = (process.env.APP_ENV ?? process.env.NODE_ENV ?? "development")
  .trim()
  .toLowerCase();

export const isProductionEnv = appEnv === "production";

export const supabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    !isPlaceholder(supabaseUrl) &&
    !isPlaceholder(supabaseAnonKey),
);

export const databaseConfigured = Boolean(databaseUrl && !isPlaceholder(databaseUrl));

/**
 * โดเมนที่ deploy จริง — ใช้เมื่อ host ไม่ได้ตั้ง NEXT_PUBLIC_APP_URL
 *
 * ถ้าไม่มีค่า fallback นี้ metadata/OG จะไม่มี URL และ mockup ในหน้า landing จะ
 * แสดง "localhost:3000" ของเครื่อง dev ออกไปบนเว็บจริง
 */
const PRODUCTION_SITE_URL = "https://octopus-ai.devs.li";

const rawSiteUrl =
  (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "").trim() || PRODUCTION_SITE_URL;

/**
 * URL ของเว็บนี้แบบไม่มี slash ท้าย (เช่น https://octopus-ai.devs.li)
 *
 * ใช้แทนการ hardcode ชื่อโดเมนใน system prompt ของเอเจนต์, ตัวอย่างโค้ดเรียก API
 * และ metadata ของหน้า — ตั้งผ่าน NEXT_PUBLIC_APP_URL (อ่านได้จากทั้งฝั่ง server และ client)
 * ถ้าไม่ตั้ง ใช้โดเมนที่ deploy จริง (PRODUCTION_SITE_URL) แทนที่จะปล่อยว่าง
 */
export const siteUrl = rawSiteUrl.replace(/\/+$/, "");

/** โดเมนเปล่าสำหรับแสดงในข้อความ (ไม่มี https://) — คืนค่า fallback เมื่อไม่ตั้ง env */
export function siteHost(fallback = ""): string {
  if (!siteUrl) return fallback;
  return siteUrl.replace(/^https?:\/\//, "");
}