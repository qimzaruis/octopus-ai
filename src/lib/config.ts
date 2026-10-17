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
 * - development (ค่าเริ่มต้น): Demo — ใช้งานได้ทันทีโดยไม่ต้อง login Google / ไม่ต้องมี DB
 * - production: ใช้ของจริง ถ้า env ครบ; ถ้า env ไม่ครบให้ตกไป Demo เพื่อไม่ให้หน้าเว็บล่ม
 * - DEMO_MODE บังคับทับได้เสมอ
 */
export const isDemoMode = (() => {
  if (demoOverride === "1") return true;
  if (demoOverride === "0") return false;
  if (isProductionEnv) return !(supabaseConfigured && databaseConfigured);
  return true;
})();