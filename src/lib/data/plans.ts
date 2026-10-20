import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { models, planModels, plans as plansTable, routeCategories, routes } from "@/db/schema";
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";
import { DEFAULT_PLANS, CYCLE_DAY_OPTIONS, type Plan } from "@/lib/plans";
import { getCatalog, type Catalog } from "@/lib/data/catalog";

/** อายุแคชข้อมูลแผน — อ่านจาก catalog snapshot ชุดเดียวกับหน้าอื่น */

/**
 * ตารางแผนทั้งหมด — มาจาก snapshot เดียวกับ route/ปลายทาง (1 query สำหรับทั้งกลุ่ม)
 * ตอนอ่าน DB ไม่ได้ให้ตกกลับไปใช้ DEFAULT_PLANS (ค่ากําหนดของระบบ ไม่ใช่ข้อมูลแต่งขึ้น)
 */
export async function listPlans(): Promise<Plan[]> {
  const { plans } = await getCatalog();
  if (plans.length === 0) return Object.values(DEFAULT_PLANS);
  return plans.map((r) => ({
    key: r.key,
    label: r.label || r.key,
    cycleDays: r.cycleDays,
    cycleQuotaUsd: r.cycleQuotaUsd,
    dailyQuotaUsd: r.dailyQuotaUsd,
    cycleRequests: r.cycleRequests,
    concurrentModels: r.concurrentModels,
    fallback: r.fallback,
    tier: r.tier,
  }));
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

/** บันทึกข้อมูลของ route (โหมดแสดงผล ชื่อ ราคา หมวด/โลโก้) */
export async function updateRouteSettings(input: {
  id: number;
  displayMode: string;
  displayName: string;
  categoryId: number | null;
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

  const db = getDb();
  const categoryId =
    Number.isFinite(input.categoryId) && input.categoryId ? input.categoryId : null;
  const category = categoryId
    ? (await db.select().from(routeCategories).where(eq(routeCategories.id, categoryId)))[0]
    : null;
  if (categoryId && !category) return { ok: false, error: "ไม่พบหมวดที่เลือก" };

  await db
    .update(routes)
    .set({
      displayMode: mode,
      displayName: input.displayName.trim(),
      categoryId: category?.id ?? null,
      // รูปของ route มาจากหมวดเสมอ — ไม่มีหมวดก็ไม่มีรูป
      logoUrl: category?.logoUrl ?? null,
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
 * แผนขั้นต่ำที่ใช้งานโมเดลแต่ละตัวได้ — มาจาก snapshot เดียวกัน (ไม่ต้อง query เพิ่ม)
 * โมเดลที่ไม่ถูกกำหนดไว้ในแผนใดเลย = undefined หมายถึงใช้ได้ทุกแผน
 */
export async function modelPlanRequirements(): Promise<Map<number, PlanModelRequirement>> {
  const catalog = await getCatalog();
  return planRequirementsOf(catalog);
}

/** สร้าง map modelRefId → แผนต่ำสุดที่สิทธิ์ใช้โมเดลนั้น */
export function planRequirementsOf(catalog: Catalog): Map<number, PlanModelRequirement> {
  const byKey = new Map(catalog.plans.map((p) => [p.key, p]));
  const map = new Map<number, PlanModelRequirement>();
  for (const r of catalog.planModels) {
    const plan = byKey.get(r.planKey);
    if (!plan) continue;
    const cur = map.get(r.modelRefId);
    if (!cur || plan.tier < cur.tier) {
      map.set(r.modelRefId, { tier: plan.tier, label: plan.label || plan.key });
    }
  }
  return map;
}

/** โมเดลที่แอดมินกำหนดให้แต่ละแผน (planKey → model ids) สำหรับหน้า /admin/plans */
export async function listPlanModelAssignments(): Promise<Record<string, number[]>> {
  const out: Record<string, number[]> = {};
  for (const r of (await getCatalog()).planModels) (out[r.planKey] ??= []).push(r.modelRefId);
  return out;
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