import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { plans as plansTable, routes } from "@/db/schema";
import { isDemoMode } from "@/lib/config";
import { getDemoStore } from "@/lib/demo/store";
import { DEFAULT_PLANS, CYCLE_DAY_OPTIONS, type Plan } from "@/lib/plans";

/**
 * แผนการใช้งาน — อ่าน/เขียนจากตาราง plans
 * ตอนอ่าน DB ไม่ได้ให้ตกกลับไปใช้ค่าเริ่มต้น เพื่อไม่ให้หน้าเว็บล่ม
 */

function rowToPlan(r: typeof plansTable.$inferSelect): Plan {
  return {
    key: r.key,
    label: r.label || r.key,
    cycleDays: r.cycleDays,
    cycleQuotaUsd: Number(r.cycleQuotaUsd),
    dailyQuotaUsd: Number(r.dailyQuotaUsd),
    cycleRequests: r.cycleRequests,
    concurrentModels: r.concurrentModels,
    fallback: r.fallback,
  };
}

export async function listPlans(): Promise<Plan[]> {
  if (isDemoMode) return getDemoStore().plans;

  try {
    const rows = await getDb().select().from(plansTable).orderBy(asc(plansTable.key));
    if (rows.length === 0) return Object.values(DEFAULT_PLANS);
    return rows.map(rowToPlan);
  } catch {
    // ตารางยังไม่ถูกสร้าง (ยังไม่รัน setup.sql) — ใช้ค่าเริ่มต้นไปก่อน
    return Object.values(DEFAULT_PLANS);
  }
}

export async function getPlanByKey(key: string): Promise<Plan> {
  const all = await listPlans();
  return all.find((p) => p.key === key) ?? DEFAULT_PLANS.free;
}

export type ActionResult = { ok: boolean; error?: string };

export async function updatePlan(input: {
  key: string;
  label: string;
  cycleDays: number;
  cycleQuotaUsd: number;
  dailyQuotaUsd: number;
  cycleRequests: number;
  concurrentModels: number;
  fallback: boolean;
}): Promise<ActionResult> {
  const label = input.label.trim() || input.key;
  if (!CYCLE_DAY_OPTIONS.includes(input.cycleDays as (typeof CYCLE_DAY_OPTIONS)[number])) {
    return { ok: false, error: "วงรอบต้องเป็น 1, 7 หรือ 30 วัน" };
  }
  if (!Number.isFinite(input.cycleQuotaUsd) || input.cycleQuotaUsd < 0) {
    return { ok: false, error: "โควต้าต่อรอบต้องไม่ติดลบ" };
  }
  if (!Number.isFinite(input.dailyQuotaUsd) || input.dailyQuotaUsd < 0) {
    return { ok: false, error: "โควต้าต่อวันต้องไม่ติดลบ" };
  }
  if (input.dailyQuotaUsd > 0 && input.dailyQuotaUsd > input.cycleQuotaUsd) {
    return { ok: false, error: "โควต้าต่อวันต้องไม่เกินโควต้าต่อรอบ" };
  }

  if (isDemoMode) {
    const store = getDemoStore();
    const p = store.plans.find((x) => x.key === input.key);
    if (!p) return { ok: false, error: "ไม่พบแผนนี้" };
    Object.assign(p, {
      label,
      cycleDays: input.cycleDays,
      cycleQuotaUsd: input.cycleQuotaUsd,
      dailyQuotaUsd: input.dailyQuotaUsd,
      cycleRequests: input.cycleRequests,
      concurrentModels: input.concurrentModels,
      fallback: input.fallback,
    });
    return { ok: true };
  }

  const db = getDb();
  const values = {
    label,
    cycleDays: input.cycleDays,
    cycleQuotaUsd: input.cycleQuotaUsd,
    dailyQuotaUsd: input.dailyQuotaUsd,
    cycleRequests: input.cycleRequests,
    concurrentModels: input.concurrentModels,
    fallback: input.fallback,
    updatedAt: new Date(),
  };
  try {
    const existing = await db.select().from(plansTable).where(eq(plansTable.key, input.key));
    if (existing.length === 0) {
      await db.insert(plansTable).values({ key: input.key, ...values });
    } else {
      await db.update(plansTable).set(values).where(eq(plansTable.key, input.key));
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
  return { ok: true };
}

/** บันทึกข้อมูลของ route (โหมดแสดงผล ชื่อ ราคา โลโก้) */
export async function updateRouteSettings(input: {
  id: number;
  displayMode: string;
  displayName: string;
  logoUrl: string | null;
  inputPricePerM: number;
  outputPricePerM: number;
}): Promise<ActionResult> {
  const mode = input.displayMode === "model" ? "model" : "router";
  if (!Number.isFinite(input.inputPricePerM) || input.inputPricePerM < 0) {
    return { ok: false, error: "ราคา input ต้องไม่ติดลบ" };
  }
  if (!Number.isFinite(input.outputPricePerM) || input.outputPricePerM < 0) {
    return { ok: false, error: "ราคา output ต้องไม่ติดลบ" };
  }

  if (isDemoMode) {
    const r = getDemoStore().routes.find((x) => x.id === input.id);
    if (!r) return { ok: false, error: "ไม่พบ route" };
    r.displayMode = mode;
    r.displayName = input.displayName.trim();
    r.logoUrl = input.logoUrl;
    r.inputPricePerM = input.inputPricePerM;
    r.outputPricePerM = input.outputPricePerM;
    return { ok: true };
  }

  await getDb()
    .update(routes)
    .set({
      displayMode: mode,
      displayName: input.displayName.trim(),
      logoUrl: input.logoUrl,
      inputPricePerM: input.inputPricePerM,
      outputPricePerM: input.outputPricePerM,
    })
    .where(eq(routes.id, input.id));
  return { ok: true };
}