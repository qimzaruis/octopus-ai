import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { models, providers, routeTargets, routes } from "@/db/schema";
import { isDemoMode } from "@/lib/config";
import { getDemoStore } from "@/lib/demo/store";
import { getPlan, cycleStart, dayStart, computeQuota, type QuotaUsage } from "@/lib/plans";
import { getUsage, type UsageBucket } from "@/lib/data/usage";

/** โมเดลที่ผู้ใช้เห็นได้ (enabled + visibleToUsers) */
export type PublicModelDTO = {
  id: number;
  modelId: string;
  displayName: string;
  providerName: string;
  providerId: number;
  contextWindow: number;
  supportsVision: boolean;
  inputPricePerM: number;
  outputPricePerM: number;
  /** โลโก้ที่แสดงแทนชื่อผู้ให้บริการ (null = ใช้ตัวอักษรแรก) */
  logoUrl: string | null;
  /** ค่าใช้จ่ายต่อ request โดยประมาณ (1,000 in + 500 out tokens) */
  sampleCostUsd: number;
};

/** โมเดลทั้งหมดสําหรับหน้า admin (รวมที่ซ่อนจากผู้ใช้) */
export type AdminModelDTO = PublicModelDTO & { enabled: boolean; visibleToUsers: boolean };

/**
 * รายการที่ผู้ใช้เห็นในหน้า /models — อ้างอิง "route" เป็นหลัก
 *
 * displayMode = "router" → แสดงเป็นรายการเดียว (ผู้ใช้ไม่เห็นว่าข้างในใช้โมเดลอะไร)
 * displayMode = "model"  → แสดงกลุ่ม แล้วกางรายชื่อโมเดลปลายทางใต้ลงไป
 */
export type PublicRouteDTO = {
  id: number;
  publicModel: string;
  displayName: string;
  description: string;
  displayMode: string;
  logoUrl: string | null;
  inputPricePerM: number;
  outputPricePerM: number;
  /** โมเดลปลายทาง (fallback) เรียงตามลําดับ — แสดงเมื่อ displayMode = model */
  targets: { label: string; contextWindow: number; supportsVision: boolean }[];
};

type ModelRow = {
  id: number;
  providerId: number;
  modelId: string;
  displayName: string;
  contextWindow: number;
  supportsVision: boolean;
  inputPricePerM: number;
  outputPricePerM: number;
  logoUrl: string | null;
};

function toPublicDTO(m: ModelRow, providerName: string): PublicModelDTO {
  return {
    id: m.id,
    providerId: m.providerId,
    modelId: m.modelId,
    displayName: m.displayName,
    providerName,
    contextWindow: m.contextWindow,
    supportsVision: m.supportsVision,
    inputPricePerM: m.inputPricePerM,
    outputPricePerM: m.outputPricePerM,
    logoUrl: m.logoUrl,
    sampleCostUsd:
      (1000 / 1_000_000) * m.inputPricePerM + (500 / 1_000_000) * m.outputPricePerM,
  };
}

/** รายการโมเดลที่ผู้ใช้เรียกใช้ได้จริง */
export async function listPublicModels(): Promise<PublicModelDTO[]> {
  if (isDemoMode) {
    const store = getDemoStore();
    return store.models
      .filter((m) => m.enabled && m.visibleToUsers)
      .map((m) =>
        toPublicDTO(m, store.providers.find((p) => p.id === m.providerId)?.name ?? "?"),
      )
      .sort(
        (a, b) =>
          a.providerName.localeCompare(b.providerName) || a.modelId.localeCompare(b.modelId),
      );
  }

  const db = getDb();
  const [modelRows, providerRows] = await Promise.all([
    db
      .select()
      .from(models)
      .where(eq(models.visibleToUsers, true))
      .orderBy(asc(models.providerId), asc(models.modelId)),
    db.select().from(providers),
  ]);
  return modelRows
    .filter((m) => m.enabled)
    .map((m) => toPublicDTO(m, providerRows.find((p) => p.id === m.providerId)?.name ?? "?"));
}

/**
 * รายการ route ที่ผู้ใช้เห็นในหน้า /models
 *
 * อ้างอิง route เป็นหลัก (route = "โมเดล" ที่ผู้ใช้เรียก) เพราะผู้ใช้ไม่ควรรู้ว่า
 * เบื้องหลังส่งต่อไปค่ายไหน ถ้า displayMode = model จะแนบรายชื่อโมเดลปลายทางมาด้วย
 */
export async function listPublicRoutes(): Promise<PublicRouteDTO[]> {
  if (isDemoMode) {
    const store = getDemoStore();
    return store.routes
      .filter((r) => r.enabled)
      .map((r) => ({
        id: r.id,
        publicModel: r.publicModel,
        displayName: r.displayName || r.publicModel,
        description: r.description,
        displayMode: r.displayMode,
        logoUrl: r.logoUrl ?? null,
        inputPricePerM: Number(r.inputPricePerM ?? 0),
        outputPricePerM: Number(r.outputPricePerM ?? 0),
        targets: store.routeTargets
          .filter((t) => t.routeId === r.id && t.enabled)
          .sort((a, b) => a.priority - b.priority)
          .map((t) => {
            const m = store.models.find((x) => x.id === t.modelRefId);
            return {
              label: m?.displayName || m?.modelId || "?",
              contextWindow: m?.contextWindow ?? 0,
              supportsVision: m?.supportsVision ?? false,
            };
          }),
      }));
  }

  const db = getDb();
  const [routeRows, targetRows, modelRows] = await Promise.all([
    db.select().from(routes).where(eq(routes.enabled, true)).orderBy(asc(routes.id)),
    db.select().from(routeTargets).orderBy(asc(routeTargets.priority)),
    db.select().from(models),
  ]);

  return routeRows.map((r) => ({
    id: r.id,
    publicModel: r.publicModel,
    displayName: r.displayName || r.publicModel,
    description: r.description,
    displayMode: r.displayMode,
    logoUrl: r.logoUrl ?? null,
    inputPricePerM: Number(r.inputPricePerM ?? 0),
    outputPricePerM: Number(r.outputPricePerM ?? 0),
    targets: targetRows
      .filter((t) => t.routeId === r.id && t.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map((t) => {
        const m = modelRows.find((x) => x.id === t.modelRefId);
        return {
          label: m?.displayName || m?.modelId || "?",
          contextWindow: m?.contextWindow ?? 0,
          supportsVision: m?.supportsVision ?? false,
        };
      }),
  }));
}

/** โมเดลทั้งหมดสําหรับหน้า admin */
export async function listAllModelsForAdmin(): Promise<AdminModelDTO[]> {
  if (isDemoMode) {
    const store = getDemoStore();
    return store.models.map((m) => ({
      ...toPublicDTO(m, store.providers.find((p) => p.id === m.providerId)?.name ?? "?"),
      enabled: m.enabled,
      visibleToUsers: m.visibleToUsers,
    }));
  }
  const db = getDb();
  const [modelRows, providerRows] = await Promise.all([
    db.select().from(models).orderBy(asc(models.providerId), asc(models.modelId)),
    db.select().from(providers),
  ]);
  return modelRows.map((m) => ({
    ...toPublicDTO(m, providerRows.find((p) => p.id === m.providerId)?.name ?? "?"),
    enabled: m.enabled,
    visibleToUsers: m.visibleToUsers,
  }));
}

// ---------------------------------------------------------------------------
// เมตริกต่อผู้ใช้ (สําหรับหน้า admin)
// ---------------------------------------------------------------------------

export type UserMetrics = {
  userId: string;
  requests: number;
  tokens: number;
  costUsd: number;
  topModel: { model: string; requests: number } | null;
  topAgent: { agent: string; requests: number } | null;
};

async function rowsOf(query: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
  const res = (await getDb().execute(query)) as unknown;
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  return (res as { rows: Record<string, unknown>[] }).rows ?? [];
}

const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

async function userMetricsReal(userId: string): Promise<UserMetrics> {
  const [totals, topModel, topAgent] = await Promise.all([
    rowsOf(sql`
      select count(*)::int as requests,
             coalesce(sum(input_tokens + output_tokens), 0)::int as tokens,
             coalesce(sum(cost_usd), 0)::float8 as cost
      from requests where user_id = ${userId}
    `),
    rowsOf(sql`
      select model, count(*)::int as c from requests where user_id = ${userId}
      group by model order by c desc limit 1
    `),
    rowsOf(sql`
      select agent, count(*)::int as c from requests
      where user_id = ${userId} and agent <> ''
      group by agent order by c desc limit 1
    `),
  ]);
  const r = totals[0] ?? {};
  const tm = topModel[0];
  const ta = topAgent[0];
  return {
    userId,
    requests: n(r.requests),
    tokens: n(r.tokens),
    costUsd: n(r.cost),
    topModel: tm ? { model: String(tm.model), requests: n(tm.c) } : null,
    topAgent: ta ? { agent: String(ta.agent), requests: n(ta.c) } : null,
  };
}

function userMetricsDemo(userId: string): UserMetrics {
  const store = getDemoStore();
  const list = store.requests.filter((r) => r.userId === userId);
  const byModel = new Map<string, number>();
  const byAgent = new Map<string, number>();
  let tokens = 0;
  let cost = 0;
  for (const r of list) {
    tokens += r.inputTokens + r.outputTokens;
    cost += r.costUsd ?? 0;
    byModel.set(r.model, (byModel.get(r.model) ?? 0) + 1);
    if (r.agent) byAgent.set(r.agent, (byAgent.get(r.agent) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => {
    let best: { k: string; v: number } | null = null;
    for (const [k, v] of m) if (!best || v > best.v) best = { k, v };
    return best;
  };
  const tm = top(byModel);
  const ta = top(byAgent);
  return {
    userId,
    requests: list.length,
    tokens,
    costUsd: cost,
    topModel: tm ? { model: tm.k, requests: tm.v } : null,
    topAgent: ta ? { agent: ta.k, requests: ta.v } : null,
  };
}

export async function getUserMetrics(userId: string): Promise<UserMetrics> {
  return isDemoMode ? userMetricsDemo(userId) : userMetricsReal(userId);
}

/**
 * โควต้าของผู้ใช้ในรอบปัจจุบัน (USD) + ข้อมูลกราฟ
 *
 * รอบเป็น rolling window ตาม cycleDays ของแผน (1 / 7 / 30 วัน)
 * พร้อม sub-quota รายวันถ้าแอดมินตั้งไว้
 */
export async function getUserQuota(
  userId: string,
  planKey: string,
): Promise<QuotaUsage & { hourly: UsageBucket[]; daily7: UsageBucket[]; daily30: UsageBucket[] }> {
  const { getPlanByKey } = await import("@/lib/data/plans");
  const plan = await getPlanByKey(planKey);
  const { getSpendInWindows } = await import("@/lib/data/usage");

  const [spend, hourly, daily7, daily30] = await Promise.all([
    getSpendInWindows(userId, {
      cycleSince: cycleStart(plan.cycleDays),
      daySince: dayStart(),
    }),
    getUsage(userId, "hourly"),
    getUsage(userId, "7d"),
    getUsage(userId, "30d"),
  ]);

  return {
    ...computeQuota(plan, spend),
    hourly,
    daily7,
    daily30,
  };
}