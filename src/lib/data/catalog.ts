/**
 * Catalog snapshot ของทั้งระบบ — ทางอ่านเดียวของตารางที่เปลี่ยนน้อยแต่ถูกอ่านทุก request
 *
 * ตารางกลุ่มนี้ (providers / models / routes / route_targets / plans / plan_models)
 * มีแค่แอดมินที่แก้ได้ แต่เดิมแต่ละหน้าที่อ่านต้องยิง query ของตัวเองซ้ำชุดเดียวกัน
 * (listPublicRoutes 6 รอบ, resolveTargets 4 รอบ, internalIdentities 2 รอบ)
 * รวมเป็น statement เดียวที่ aggregate ทั้ง 6 ตาราง = เดินทางไป Supabase ครั้งเดียว
 *
 * ตัว snapshot แคช 60 วินาทีและล้างทันทีที่แอดมินบันทึก (revalidateAdmin → invalidateCatalog)
 * ช่วงที่ DB อ่านไม่ออกจะคืน snapshot ชุดสุดท้ายที่อ่านสำเร็จแทนค่าว่าง
 * (ของเก่ายังดีกว่าให้ระบบตอบว่า "ไม่มีโมเดลนี้")
 */

import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";
import { cached } from "@/lib/catalog-cache";

export const CATALOG_TTL_MS = 60_000;

/** แถวที่ json_agg ส่งมา — คีย์ยังเป็น snake_case ตามคอลัมน์ในตาราง */
type JsonRow = Record<string, unknown>;

export type CatalogProvider = {
  id: number;
  name: string;
  baseUrl: string;
  enabled: boolean;
};

export type CatalogModel = {
  id: number;
  providerId: number;
  modelId: string;
  displayName: string;
  contextWindow: number;
  supportsVision: boolean;
  enabled: boolean;
  inputPricePerM: number;
  outputPricePerM: number;
  logoUrl: string | null;
};

export type CatalogRoute = {
  id: number;
  publicModel: string;
  displayName: string;
  description: string;
  displayMode: string;
  logoUrl: string | null;
  inputPricePerM: number;
  outputPricePerM: number;
  enabled: boolean;
};

export type CatalogTarget = {
  id: number;
  routeId: number;
  modelRefId: number;
  priority: number;
  enabled: boolean;
};

export type CatalogPlan = {
  key: string;
  label: string;
  cycleDays: number;
  cycleQuotaUsd: number;
  dailyQuotaUsd: number;
  cycleRequests: number;
  concurrentModels: number;
  fallback: boolean;
  tier: number;
};

export type CatalogPlanModel = { planKey: string; modelRefId: number };

export type Catalog = {
  providers: CatalogProvider[];
  models: CatalogModel[];
  routes: CatalogRoute[];
  targets: CatalogTarget[];
  plans: CatalogPlan[];
  planModels: CatalogPlanModel[];
};

const EMPTY: Catalog = {
  providers: [],
  models: [],
  routes: [],
  targets: [],
  plans: [],
  planModels: [],
};

/** อ่าน json_agg ทั้งหกช่องออกมาเป็น array (postgres.js แปลง json ให้แล้ว แต่กันช่องเป็น null/stringไว้) */
function arr(v: unknown): JsonRow[] {
  if (Array.isArray(v)) return v as JsonRow[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as JsonRow[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const b = (v: unknown) => v === true || v === "true";
const s = (v: unknown) => (v == null ? "" : String(v));

function normalize(row: Record<string, unknown>): Catalog {
  return {
    providers: arr(row.providers).map((p) => ({
      id: n(p.id),
      name: s(p.name),
      baseUrl: s(p.base_url ?? p.baseUrl),
      enabled: b(p.enabled),
    })),
    models: arr(row.models).map((m) => ({
      id: n(m.id),
      providerId: n(m.provider_id ?? m.providerId),
      modelId: s(m.model_id ?? m.modelId),
      displayName: s(m.display_name ?? m.displayName),
      contextWindow: n(m.context_window ?? m.contextWindow),
      supportsVision: b(m.supports_vision ?? m.supportsVision),
      enabled: b(m.enabled),
      inputPricePerM: n(m.input_price_per_m ?? m.inputPricePerM),
      outputPricePerM: n(m.output_price_per_m ?? m.outputPricePerM),
      logoUrl: m.logo_url == null && m.logoUrl == null ? null : s(m.logo_url ?? m.logoUrl),
    })),
    routes: arr(row.routes)
      .map((r) => ({
        id: n(r.id),
        publicModel: s(r.public_model ?? r.publicModel),
        displayName: s(r.display_name ?? r.displayName),
        description: s(r.description),
        displayMode: s(r.display_mode ?? r.displayMode),
        logoUrl: r.logo_url == null && r.logoUrl == null ? null : s(r.logo_url ?? r.logoUrl),
        inputPricePerM: n(r.input_price_per_m ?? r.inputPricePerM),
        outputPricePerM: n(r.output_price_per_m ?? r.outputPricePerM),
        enabled: b(r.enabled),
      }))
      .sort((a, b2) => a.id - b2.id),
    targets: arr(row.route_targets ?? row.targets)
      .map((t) => ({
        id: n(t.id),
        routeId: n(t.route_id ?? t.routeId),
        modelRefId: n(t.model_ref_id ?? t.modelRefId),
        priority: n(t.priority),
        enabled: b(t.enabled),
      }))
      .sort((a, b2) => a.priority - b2.priority || a.id - b2.id),
    plans: arr(row.plans).map((p) => ({
      key: s(p.key),
      label: s(p.label),
      cycleDays: n(p.cycle_days ?? p.cycleDays),
      cycleQuotaUsd: n(p.cycle_quota_usd ?? p.cycleQuotaUsd),
      dailyQuotaUsd: n(p.daily_quota_usd ?? p.dailyQuotaUsd),
      cycleRequests: n(p.cycle_requests ?? p.cycleRequests),
      concurrentModels: n(p.concurrent_models ?? p.concurrentModels),
      fallback: b(p.fallback),
      tier: n(p.tier),
    })),
    planModels: arr(row.plan_models ?? row.planModels).map((p) => ({
      planKey: s(p.plan_key ?? p.planKey),
      modelRefId: n(p.model_ref_id ?? p.modelRefId),
    })),
  };
}

const QUERY = sql`
  select
    coalesce((select json_agg(p) from providers p), '[]'::json) as providers,
    coalesce((select json_agg(m) from models m), '[]'::json) as models,
    coalesce((select json_agg(r) from routes r), '[]'::json) as routes,
    coalesce((select json_agg(t) from route_targets t), '[]'::json) as route_targets,
    coalesce((select json_agg(pl order by pl.tier, pl.key) from plans pl), '[]'::json) as plans,
    coalesce((select json_agg(pm) from plan_models pm), '[]'::json) as plan_models
`;

async function loadCatalog(): Promise<Catalog> {
  try {
    const res = (await getDb().execute(QUERY)) as unknown;
    const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows ?? [];
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error("catalog query returned no row");
    const out = normalize(row);
    lastGoodCatalog = out;
    return out;
  } catch (err) {
    markDbUnavailable(err);
    return lastGoodCatalog ?? EMPTY;
  }
}

/** snapshot ชุดสุดท้ายที่อ่านจาก DB สำเร็จ — ของจริง ไม่ใช่ข้อมูลแต่ง */
let lastGoodCatalog: Catalog | null = null;

/**
 * ทางอ่านเดียวของกลุ่มข้อมูล catalog
 * ตอน DB ถูกข้าม (circuit breaker เปิด) อย่าเก็บผลว่างลงแคช — จะทำให้ route หายไป
 * ทั้งที่ DB ฟื้นแล้ว คืน snapshot เก่าที่เพิ่งใช้ได้อยู่แล้วออกไปใช้ก่อน
 */
export function getCatalog(): Promise<Catalog> {
  if (isDbUnavailable()) return Promise.resolve(lastGoodCatalog ?? EMPTY);
  return cached("catalog", CATALOG_TTL_MS, loadCatalog);
}

/** index ที่อ่านบ่อยของ snapshot — สร้างใหม่ทุกครั้งที่แคชหมดอายุ (ตารางเล็กมาก) */
export type CatalogIndex = {
  catalog: Catalog;
  modelById: Map<number, CatalogModel>;
  providerById: Map<number, CatalogProvider>;
  /** route id → ปลายทางที่เปิดใช้ เรียงตาม priority */
  targetsByRoute: Map<number, CatalogTarget[]>;
};

export function indexCatalog(catalog: Catalog): CatalogIndex {
  const modelById = new Map(catalog.models.map((m) => [m.id, m]));
  const providerById = new Map(catalog.providers.map((p) => [p.id, p]));
  const targetsByRoute = new Map<number, CatalogTarget[]>();
  for (const t of catalog.targets) {
    if (!t.enabled) continue;
    const list = targetsByRoute.get(t.routeId);
    if (list) list.push(t);
    else targetsByRoute.set(t.routeId, [t]);
  }
  return { catalog, modelById, providerById, targetsByRoute };
}
