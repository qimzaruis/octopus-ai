import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { creditTransactions, users } from "@/db/schema";
import { isDemoMode } from "@/lib/config";
import { DEMO_EXTRA_USERS, DEMO_USERS, getDemoStore, type DemoUser } from "@/lib/demo/store";
import { getPlan } from "@/lib/plans";
import { getUserMetrics, type UserMetrics } from "@/lib/data/models";

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
  if (isDemoMode) {
    const store = getDemoStore();
    const rows = store.users.length
      ? store.users
      : [DEMO_USERS.user, DEMO_USERS.admin, ...DEMO_EXTRA_USERS];
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
        planLabel: getPlan(u.plan).label,
        credits: u.credits,
        banned: u.banned,
        bannedReason: u.bannedReason,
        createdAt: new Date("2026-08-01").toISOString(),
        metrics,
      });
    }
    return out.sort((a, b) => b.metrics.costUsd - a.metrics.costUsd);
  }

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
      planLabel: getPlan(u.plan).label,
      credits: Number(u.credits),
      banned: u.banned,
      bannedReason: u.bannedReason,
      createdAt: u.createdAt.toISOString(),
      metrics,
    });
  }
  return out;
}

export async function listCreditTransactions(userId: string, limit = 12): Promise<CreditTxDTO[]> {
  if (isDemoMode) {
    // ไม่มีข้อมูลธุรกรรมในเดโม — คืนค่าว่างเพื่อให้ UI แสดง empty state
    return [];
  }
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
}

export type ActionResult = { ok: boolean; error?: string };

/** ระงับ / คืนสิทธิ์ผู้ใช้ */
export async function setUserBanned(
  userId: string,
  banned: boolean,
  reason: string,
): Promise<ActionResult> {
  if (isDemoMode) {
    const store = getDemoStore();
    const u = store.users.find((x) => x.id === userId);
    if (!u) return { ok: false, error: "ไม่พบผู้ใช้" };
    if (u.role === "admin") return { ok: false, error: "ระงับบัญชีแอดมินไม่ได้" };
    u.banned = banned;
    u.bannedReason = banned ? reason.trim() : "";
    return { ok: true };
  }
  const db = getDb();
  const target = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!target) return { ok: false, error: "ไม่พบผู้ใช้" };
  if (target.role === "admin") return { ok: false, error: "ระงับบัญชีแอดมินไม่ได้" };
  await db
    .update(users)
    .set({ banned, bannedReason: banned ? reason.trim() : "" })
    .where(eq(users.id, userId));
  return { ok: true };
}

/** เปลี่ยนแผนการใช้งาน */
export async function setUserPlan(userId: string, plan: string): Promise<ActionResult> {
  if (plan !== "free" && plan !== "pro") return { ok: false, error: "แผนไม่ถูกต้อง" };
  if (isDemoMode) {
    const u = getDemoStore().users.find((x) => x.id === userId);
    if (!u) return { ok: false, error: "ไม่พบผู้ใช้" };
    u.plan = plan;
    return { ok: true };
  }
  await getDb().update(users).set({ plan }).where(eq(users.id, userId));
  return { ok: true };
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

  if (isDemoMode) {
    const u = getDemoStore().users.find((x) => x.id === userId);
    if (!u) return { ok: false, error: "ไม่พบผู้ใช้" };
    u.credits = Math.max(0, Number((u.credits + amount).toFixed(6)));
    return { ok: true };
  }

  const db = getDb();
  const target = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!target) return { ok: false, error: "ไม่พบผู้ใช้" };
  const next = Math.max(0, Number((Number(target.credits) + amount).toFixed(6)));
  await db.update(users).set({ credits: next }).where(eq(users.id, userId));
  await db.insert(creditTransactions).values({
    userId,
    amount,
    type: "admin_adjust",
    note: note.trim() || (amount > 0 ? "แอดมินเติมเครดิต" : "แอดมินหักเครดิต"),
  });
  return { ok: true };
}

export type { DemoUser };