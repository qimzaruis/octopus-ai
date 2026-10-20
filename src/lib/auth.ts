import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/config";
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { cached, invalidateCache } from "@/lib/catalog-cache";

/** อายุแคช profile ผู้ใช้ (ms) — แอดมินแก้เครดิต/แผน/แบนเมื่อไหร่ก็ล้างทันที */
const PROFILE_TTL_MS = 15_000;

/**
 * แคช "ผู้ใช้ของ request นี้" ผูกกับ access token
 *
 * หนึ่งการเปิดหน้า layout + page (+ API ที่เรียกซ้อน) เรียก getSessionUser() ซ้ำหลายรอบ
 * และแต่ละรอบคือการเดินทางไปถึง Supabase Auth จริง (วัดจากเครื่องผู้ใช้ได้ ~135ms ต่อรอบ
 * และบน Vercel ก็เป็น request ไป GoTrue ฟรี ๆ เท่าจำนวนครั้งที่เรียกซ้ำ)
 * เก็บผลไว้รอบเดียวจึงเร็วขึ้นทั้งหน้าและประหยัด quota ฝั่ง auth
 *
 * กุญแจคือค่า digest ของ token ไม่ได้เก็บ token เต็ม ๆ และไม่ได้แตะ `session.user`
 * เลย — supabase-js จะเตือนใน log ทุกครั้งที่อ่านอ็อบเจกต์นั้นบนเซิร์ฟเวอร์
 * เพราะมันยังไม่ผ่านการยืนยัน ตัวที่ยืนยันจริงคือ getUser() ข้างใน loader
 */
type SessionMemo = { at: number; token: string; uid?: string; value: Promise<SessionUser | null> };
const sessionMemo = new Map<string, SessionMemo>();

/**
 * โปรไฟล์จริงล่าสุดต่อ uid — ใช้เมื่อ DB สะดุดแทนการเดาว่าเป็น free/user
 * (เดาแล้วแอดมินหลุดสิทธิ์และโมเดลที่ต้องใช้แผนจะหายไปชั่วคราว)
 */
const lastGoodProfiles = new Map<string, SessionUser>();

function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function memoGet(key: string, token: string): SessionMemo | null {
  const hit = sessionMemo.get(key);
  if (!hit) return null;
  if (hit.at + PROFILE_TTL_MS <= Date.now() || hit.token !== token) {
    sessionMemo.delete(key);
    return null;
  }
  return hit;
}

function memoSet(key: string, token: string, value: Promise<SessionUser | null>): void {
  // ผู้ใช้ที่เลิกเข้าเว็บไปแล้วไม่ควรทิ้งของค้างไว้ในหน่วยความจำของ lambda
  if (sessionMemo.size > 500) {
    const cutoff = Date.now() - PROFILE_TTL_MS;
    for (const [k, entry] of sessionMemo) if (entry.at <= cutoff) sessionMemo.delete(k);
  }
  const entry: SessionMemo = { at: Date.now(), token, value };
  sessionMemo.set(key, entry);
  // จำ uid ไว้เผื่อแอดมินแก้บัญชีนี้แล้วต้องล้างของเก่าทิ้ง
  void value.then((u) => { entry.uid = u?.id; }).catch(() => undefined);
}

/**
 * ล้างแคช session ของผู้ใช้หนึ่ง — แอดมินแก้เครดิต/แผน/แบนเมื่อไหร่ต้องล้างทันที
 * ไม่งั้นค่าเก่ายังถูกใช้ต่อได้อีก 15 วินาที
 */
export function invalidateSessionUser(userId: string): void {
  for (const [key, entry] of sessionMemo) if (entry.uid === userId) sessionMemo.delete(key);
  invalidateCache(`session:${userId}`);
}

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

// ถ้า DB เข้าถึงไม่ได้ ให้ข้ามการ query ไปชั่วคราว (circuit breaker) เพื่อไม่ให้ทุกหน้าค้าง
// (state กลางอยู่ใน @/lib/db-circuit)

/**
 * ดึง user ปัจจุบัน:
 * - มี Supabase session จริง → ใช้ session นั้น + แถว users ใน DB (role/credits)
 * คืน null ถ้าไม่ได้เข้าสู่ระบบ
 *
 * ตัวนี้คือทางเข้าเดียวของทั้งแอป จึงวางแคชไว้ที่นี่ชั้นหนึ่ง: layout, page และ API route
 * ของ request เดียวมักเรียกซ้ำ 2-3 รอบ และทุกรอบคือการเดินทางไปถึง Supabase Auth
 * (อ่านเพิ่มใน sessionMemo ด้านบน)
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!supabaseConfigured) {
    return null;
  }

  const supabase = await createClient();

  // อ่าน access token จาก cookie เพื่อใช้เป็นที่ตั้งกุญแจแคชเท่านั้น
  // (ไม่แตะ session.user เลย เพราะค่าจาก storage ยังไม่ผ่านการยืนยัน — ตัวที่ยืนยันจริงคือ getUser())
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  if (!token) return null;

  const key = tokenKey(token);
  const hit = memoGet(key, token);
  if (hit) return cloneUser(await hit.value);

  const value = resolveSessionUser(supabase).catch((err) => {
    sessionMemo.delete(key); // promise ที่ล้มเหลวต้องไม่ถูกใช้ตอบ request ถัดไปอีก 15 วินาที
    throw err;
  });
  memoSet(key, token, value);
  return cloneUser(await value);
}

function cloneUser(u: SessionUser | null): SessionUser | null {
  return u ? { ...u } : null;
}

async function resolveSessionUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SessionUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;

  // circuit breaker: ถ้า DB เพิ่งล้ม ให้ใช้โปรไฟล์จริงล่าสุดก่อน แล้วค่อย fallback จาก session
  if (isDbUnavailable()) {
    const known = lastGoodProfiles.get(user.id);
    if (known) {
      console.warn("[auth] DB ถูกข้ามชั่วคราว (circuit breaker) → ใช้โปรไฟล์ล่าสุด");
      return { ...known };
    }
    console.warn("[auth] DB ถูกข้ามชั่วคราว (circuit breaker) → ใช้ profile จาก session");
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

  try {
    // จำกัดเวลา DB query ไม่ให้ค้างนานเมื่อ DB เข้าถึงไม่ได้ (fallback profile)
    // ครั้งแรกมักช้าเพราะต้องเปิด connection ใหม่ไป Supabase (cold start)
    // ถ้าล้มเพราะ timeout ให้ลองอีกรอบสักครั้งก่อนประกาศว่า DB ใช้ไม่ได้
    const loadProfile = async (): Promise<SessionUser> => {
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

      const profile: SessionUser = {
        id: row.id,
        email: row.email,
        name: row.name,
        avatarUrl: row.avatarUrl,
        role: (row.role === "admin" ? "admin" : "user") as "user" | "admin",
        credits: Number(row.credits),
        plan: row.plan,
        banned: row.banned,
        bannedReason: row.bannedReason,
      };
      if (lastGoodProfiles.size > 1000) lastGoodProfiles.clear();
      lastGoodProfiles.set(profile.id, profile);
      return profile;
    };
    /**
     * อ่าน profile จากแคชก่อน — query หนึ่งรอบไป Supabase จากเครื่องผู้ใช้คิดเป็น ~350ms
     * ซึ่งทุกหน้า/ทุกข้อความแชทต้องอ่านซ้ำของเดิม
     * ค้างได้ไม่เกิน 15 วินาที และจะล้างทิ้งทันทีที่แอดมินแก้เครดิต/แผน/สถานะแบน
     */
    const queryProfile = async (): Promise<SessionUser> => {
      const key = `session:${user.id}`;
      try {
        const profile = await cached(key, PROFILE_TTL_MS, loadProfile);
        return { ...profile }; // คืนสำเนา กันผู้เรียกแก้ของในแคช
      } catch (err) {
        invalidateCache(key);
        throw err;
      }
    };
    const withTimeout = (p: Promise<SessionUser>, label: string) =>
      Promise.race([
        p,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(label)), 8000),
        ),
      ]);

    let result: SessionUser;
    try {
      result = await withTimeout(queryProfile(), "DB query timeout (8s)");
    } catch (first) {
      const msg = first instanceof Error ? first.message : String(first);
      if (!/timeout/i.test(msg)) throw first;
      console.warn("[auth] DB query ครั้งแรก timeout — ลองใหม่อีกครั้ง");
      result = await withTimeout(queryProfile(), "DB query timeout (retry)");
    }
    return result;
  } catch (err) {
    // DB ยังไม่พร้อม (เช่น ยังไม่รัน setup.sql / connection ล้ม) — อย่าให้ทั้งหน้าล่ม
    // ใช้โปรไฟล์จาก session ของ Supabase ไปพลาง ๆ
    markDbUnavailable(err);
    console.error("[auth] อ่าน/สร้าง profile จาก DB ไม่สําเร็จ:", err);
    const known = lastGoodProfiles.get(user.id);
    if (known) return { ...known };
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
