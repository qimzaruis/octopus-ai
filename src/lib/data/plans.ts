import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { models, planModels, plans as plansTable, routes } from "@/db/schema";
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";
import { DEFAULT_PLANS, CYCLE_DAY_OPTIONS, type Plan } from "@/lib/plans";
import { cached } from "@/lib/catalog-cache";

/** อายุแคชข้อมูลแผน — แอดมินบันทึกแล้วล้างทันที */
const CATALOG_TTL_MS = 60_000;

/**
 * แผนการใช้งาน — อ่าน/เขียนจากตาราง plans
 * ตอนอ่าน DB ไม่ได้ให้ตกกลับไปใช้ DEFAULT_PLANS (ค่ากําหนดของระบบ ไม่ใช่ข้อมูลแต่งขึ้น)
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
    tier: r.tier,
  };
}

/**
 * ตารางแผนทั้งหมด — แคชไว้เพราะถูกอ่านในทุก request ที่เช็คโควต้า
 * (หน้า /admin/plans บันทึกเมื่อไหร่จะล้างแคชผ่าน revalidateAdmin)
 */
export function listPlans(): Promise<Plan[]> {
  // อย่าแคชผลตอน DB ถูกข้าม (ของว่างจะค้างจนครบอายุแคช ทั้งที่ DB ฟื้นแล้ว)
  if (isDbUnavailable()) return Promise.resolve(Object.values(DEFAULT_PLANS));
  return cached("plans", CATALOG_TTL_MS, loadPlans);
}

async function loadPlans(): Promise<Plan[]> {
  try {
    const rows = await getDb()
      .select()
      .from(plansTable)
      .orderBy(asc(plansTable.tier), asc(plansTable.key));
    if (rows.length === 0) return Object.values(DEFAULT_PLANS);
    return rows.map(rowToPlan);
  } catch (err) {
    markDbUnavailable(err);
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

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

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

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

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

// ---------------------------------------------------------------------------
// โมเดลที่แต่ละแผนใช้งานได้ (แอดมินจัดชุดจากหน้า /admin/plans)
// ---------------------------------------------------------------------------

export type PlanModelRequirement = { tier: number; label: string };

/**
 * แผนขั้นต่ำที่ใช้งานโมเดลแต่ละตัวได้
 * โมเดลที่ไม่ถูกกำหนดไว้ในแผนใดเลย = undefined หมายถึงใช้ได้ทุกแผน
 */
export async function modelPlanRequirements(): Promise<Map<number, PlanModelRequirement>> {
  const map = new Map<number, PlanModelRequirement>();
  const collect = (pairs: { planKey: string; modelRefId: number }[], plans: Plan[]) => {
    for (const r of pairs) {
      const plan = plans.find((p) => p.key === r.planKey);
      if (!plan) continue;
      const cur = map.get(r.modelRefId);
      if (!cur || plan.tier < cur.tier) {
        map.set(r.modelRefId, { tier: plan.tier, label: plan.label });
      }
    }
  };

  // DB อ่านไม่ได้ = ไม่มีข้อมูลสิทธิ์รายโมเดล คืน map ว่าง (ไม่บล็อกโมเดลใด)
  if (isDbUnavailable()) return map;
  try {
    const [rows, plans] = await Promise.all([getDb().select().from(planModels), listPlans()]);
    collect(rows, plans);
    return map;
  } catch (err) {
    markDbUnavailable(err);
    return map;
  }
}

/** โมเดลที่แอดมินกำหนดให้แต่ละแผน (planKey → model ids) สำหรับหน้า /admin/plans */
export async function listPlanModelAssignments(): Promise<Record<string, number[]>> {
  const out: Record<string, number[]> = {};
  if (isDbUnavailable()) return out;
  try {
    const rows = await getDb().select().from(planModels);
    for (const r of rows) (out[r.planKey] ??= []).push(r.modelRefId);
    return out;
  } catch (err) {
    markDbUnavailable(err);
    return out;
  }
}

/** แทนที่ชุดโมเดลของแผนทั้งชุด */
export async function setPlanModels(
  planKey: string,
  modelRefIds: number[],
): Promise<ActionResult> {
  const ids = [...new Set(modelRefIds.filter((n) => Number.isFinite(n)))];

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  try {
    await db.delete(planModels).where(eq(planModels.planKey, planKey));
    if (ids.length > 0) {
      await db.insert(planModels).values(ids.map((id) => ({ planKey, modelRefId: id })));
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
  return { ok: true };
}

/** ตรวจว่าแผนนี้ใช้โมเดลนี้ได้ไหม — โมเดลที่ไม่ถูกจำกัดในแผนใดใช้ได้เสมอ */
export async function isModelAllowedForPlan(
  planKey: string,
  modelRefId: number,
): Promise<boolean> {
  const [reqs, plans] = await Promise.all([modelPlanRequirements(), listPlans()]);
  const req = reqs.get(modelRefId);
  if (!req) return true;
  const plan = plans.find((p) => p.key === planKey) ?? DEFAULT_PLANS.free;
  return plan.tier >= req.tier;
}