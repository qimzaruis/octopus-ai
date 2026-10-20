import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { creditTransactions, users } from "@/db/schema";
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";
import { readThrough } from "@/lib/data/read-through";
import { listPlans } from "@/lib/data/plans";
import { getUserMetrics, type UserMetrics } from "@/lib/data/models";
import { invalidateSessionUser } from "@/lib/auth";

/** getSessionUser แคช profile ไว้เพื่อความเร็ว — แก้ข้อมูลผู้ใช้เมื่อไหร่ต้องล้างของเก่า */
function invalidateSessionCache(userId: string): void {
  invalidateSessionUser(userId);
}

export type AdminUserDTO = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  plan: string;
  planLabel: string;
  credits: number;
  banned: boolean;
  bannedReason: string;
  createdAt: string;
  metrics: UserMetrics;
};

export type CreditTxDTO = {
  id: number;
  amount: number;
  type: string;
  note: string;
  createdAt: string;
};

function toRole(r: string): "user" | "admin" {
  return r === "admin" ? "admin" : "user";
}

/** รายชื่อผู้ใช้ทั้งหมดพร้อมเมตริกการใช้งาน (สําหรับหน้า admin) */
export async function listUsersWithMetrics(): Promise<AdminUserDTO[]> {
  const result = await readThrough("admin:users", async () => {
    // ป้ายชื่อแผนอ่านจากตาราง plans จริง (แผนใหม่ที่แอดมินเพิ่มก็แสดงถูก)
    const planLabels = new Map((await listPlans()).map((p) => [p.key, p.label || p.key]));
    const labelOf = (key: string) => planLabels.get(key) ?? key;

    const db = getDb();
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    const out: AdminUserDTO[] = [];
    for (const u of rows) {
      const metrics = await getUserMetrics(u.id);
      out.push({
        id: u.id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatarUrl,
        role: toRole(u.role),
        plan: u.plan,
        planLabel: labelOf(u.plan),
        credits: Number(u.credits),
        banned: u.banned,
        bannedReason: u.bannedReason,
        createdAt: u.createdAt.toISOString(),
        metrics,
      });
    }
    return out;
  });
  return result ?? [];
}

export async function listCreditTransactions(userId: string, limit = 12): Promise<CreditTxDTO[]> {
  const result = await readThrough(`credits:${userId}:${limit}`, async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit);
    return rows.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      type: t.type,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    }));
  });
  return result ?? [];
}

export type ActionResult = { ok: boolean; error?: string };

/** ระงับ / คืนสิทธิ์ผู้ใช้ */
export async function setUserBanned(
  userId: string,
  banned: boolean,
  reason: string,
): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  try {
    const db = getDb();
    const target = (await db.select().from(users).where(eq(users.id, userId)))[0];
    if (!target) return { ok: false, error: "ไม่พบผู้ใช้" };
    if (target.role === "admin") return { ok: false, error: "ระงับบัญชีแอดมินไม่ได้" };
    await db
      .update(users)
      .set({ banned, bannedReason: banned ? reason.trim() : "" })
      .where(eq(users.id, userId));
    invalidateSessionCache(userId);
    return { ok: true };
  } catch (err) {
    markDbUnavailable(err);
    return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  }
}

/** เปลี่ยนแผนการใช้งาน */
export async function setUserPlan(userId: string, plan: string): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  // แผนต้องมีอยู่จริงในตาราง plans (แอดมินเพิ่ม/แก้ที่หน้า /admin/plans) — ไม่ hard code
  const { listPlans } = await import("@/lib/data/plans");
  const valid = (await listPlans()).some((p) => p.key === plan);
  if (!valid) return { ok: false, error: "แผนไม่ถูกต้อง" };
  try {
    await getDb().update(users).set({ plan }).where(eq(users.id, userId));
    invalidateSessionCache(userId);
    return { ok: true };
  } catch (err) {
    markDbUnavailable(err);
    return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  }
}

/** ปรับเครดิต (บวก = เติม, ลบ = หัก) พร้อมบันทึกธุรกรรม */
export async function adjustUserCredits(
  userId: string,
  amount: number,
  note: string,
): Promise<ActionResult> {
  if (!Number.isFinite(amount) || amount === 0) {
    return { ok: false, error: "กรอกจํานวนเครดิตที่จะปรับ" };
  }
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  try {
    const db = getDb();
    const target = (await db.select().from(users).where(eq(users.id, userId)))[0];
    if (!target) return { ok: false, error: "ไม่พบผู้ใช้" };
    const next = Math.max(0, Number((Number(target.credits) + amount).toFixed(6)));
    await db.update(users).set({ credits: next }).where(eq(users.id, userId));
    invalidateSessionCache(userId);
    await db.insert(creditTransactions).values({
      userId,
      amount,
      type: "admin_adjust",
      note: note.trim() || (amount > 0 ? "แอดมินเติมเครดิต" : "แอดมินหักเครดิต"),
    });
    return { ok: true };
  } catch (err) {
    markDbUnavailable(err);
    return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  }
}