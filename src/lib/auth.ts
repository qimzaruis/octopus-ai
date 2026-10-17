import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode, supabaseConfigured } from "@/lib/config";
import { DEMO_USERS } from "@/lib/demo/store";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  credits: number;
  plan: string;
  banned: boolean;
  bannedReason: string;
};

export const DEMO_SESSION_COOKIE = "octopus_demo_session";

/**
 * ดึง user ปัจจุบัน:
 * - มี Supabase session จริง → ใช้ session นั้น + แถว users ใน DB (role/credits)
 * - ไม่มี session จริง แต่มี cookie เดโม (โหมด Demo) → ใช้ผู้ใช้ตัวอย่าง
 * คืน null ถ้าไม่ได้เข้าสู่ระบบ
 *
 * ลําดับนี้สําคัญ: ในโหมดพัฒนา ผู้ใช้อาจ login Google จริงได้ด้วย
 * ถ้ามี session จริงต้องให้ความสําคัญก่อน cookie เดโมเสมอ
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const demoRole = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;

  // ไม่ได้ตั้ง Supabase จริง → ใช้ได้แค่ cookie เดโม
  if (!supabaseConfigured) {
    if (isDemoMode && (demoRole === "user" || demoRole === "admin")) {
      return { ...DEMO_USERS[demoRole] };
    }
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // ไม่มี session จริง — ตกไปใช้ cookie เดโมได้เฉพาะในโหมด Demo
    if (isDemoMode && (demoRole === "user" || demoRole === "admin")) {
      return { ...DEMO_USERS[demoRole] };
    }
    return null;
  }

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    let row = rows[0];
    if (!row) {
      // เข้าสู่ระบบครั้งแรก — สร้าง profile (คนแรกของระบบเป็น admin อัตโนมัติ)
      const existingCount = await db.select({ id: users.id }).from(users).limit(1);
      const inserted = await db
        .insert(users)
        .values({
          id: user.id,
          email: user.email ?? "",
          name: meta.full_name ?? meta.name ?? (user.email ?? "ผู้ใช้"),
          avatarUrl: meta.avatar_url ?? meta.picture ?? null,
          role: existingCount.length === 0 ? "admin" : "user",
        })
        .returning();
      row = inserted[0];
    }

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl,
      role: row.role === "admin" ? "admin" : "user",
      credits: Number(row.credits),
      plan: row.plan,
      banned: row.banned,
      bannedReason: row.bannedReason,
    };
  } catch (err) {
    // DB ยังไม่พร้อม (เช่น ยังไม่รัน setup.sql / connection ล้ม) — อย่าให้ทั้งหน้าล่ม
    // ใช้โปรไฟล์จาก session ของ Supabase ไปพลาง ๆ
    console.error("[auth] อ่าน/สร้าง profile จาก DB ไม่สําเร็จ:", err);
    return {
      id: user.id,
      email: user.email ?? "",
      name: meta.full_name ?? meta.name ?? (user.email ?? "ผู้ใช้"),
      avatarUrl: meta.avatar_url ?? meta.picture ?? null,
      role: "user",
      credits: 0,
      plan: "free",
      banned: false,
      bannedReason: "",
    };
  }
}
