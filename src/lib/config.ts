/**
 * กําหนดโหมดการทํางานของแอป
 *
 * APP_ENV=development  → โหมดพัฒนา: ใช้ข้อมูล Demo เป็นค่าเริ่มต้น (ไม่ต้องมี Google login
 *                        ก็เข้าใช้งานได้ทันที) เหมาะกับตอนที่ DB ยังไม่พร้อม
 * APP_ENV=production   → โหมดจริง: บังคับใช้ Supabase + Postgres เท่านั้น
 *
 * DEMO_MODE=1 / DEMO_MODE=0 บังคับทับได้เสมอทุก APP_ENV
 *   DEMO_MODE=0 ในโหมดพัฒนา = ใช้ของจริง (Google login + DB) เพื่อทดสอบเต็มระบบ
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

/** ตัวเลือกบังคับโหมด: "1" = Demo, "0" = ของจริง */
const demoOverride = process.env.DEMO_MODE?.trim();

/**
 * โหมด Demo
 * - ตั้ง env จริงครบ (Supabase + DATABASE_URL) = ใช้ของจริงเสมอ แม้รัน `next dev`
 *   (เดิม development บังคับ Demo ตลอด ทำให้หน้า /models แสดงโมเดลตัวอย่าง
 *    ทั้งที่ฐานข้อมูลจริงมีข้อมูลอยู่แล้ว)
 * - ยังไม่ตั้ง env = Demo เพื่อให้อ่านหน้าเว็บได้ทันที
 * - DEMO_MODE=1 บังคับใช้ข้อมูลตัวอย่าง / DEMO_MODE=0 บังคับของจริง
 */
export const isDemoMode = (() => {
  if (demoOverride === "1") return true;
  if (demoOverride === "0") return false;
  return !(supabaseConfigured && databaseConfigured);
})();

const rawSiteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "").trim();

/**
 * URL ของเว็บนี้แบบไม่มี slash ท้าย (เช่น https://octopus-ai.flashhub.net)
 *
 * ใช้แทนการ hardcode ชื่อโดเมนใน system prompt ของเอเจนต์, ตัวอย่างโค้ดเรียก API
 * และ metadata ของหน้า — ตั้งผ่าน NEXT_PUBLIC_APP_URL (อ่านได้จากทั้งฝั่ง server และ client)
 * คืนค่าว่างถ้ายังไม่ตั้ง เพื่อให้ caller ไปใช้ origin ของเบราว์เซอร์แทน
 */
export const siteUrl = rawSiteUrl.replace(/\/+$/, "");

/** โดเมนเปล่าสำหรับแสดงในข้อความ (ไม่มี https://) — คืนค่า fallback เมื่อไม่ตั้ง env */
export function siteHost(fallback = ""): string {
  if (!siteUrl) return fallback;
  return siteUrl.replace(/^https?:\/\//, "");
}