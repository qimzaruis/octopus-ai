import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { models, providers, routeTargets, routes } from "@/db/schema";
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";
import { getPlan, cycleStart, dayStart, computeQuota, type QuotaUsage } from "@/lib/plans";
import { getUsage, type UsageBucket } from "@/lib/data/usage";
import { modelPlanRequirements } from "@/lib/data/plans";
import { cached } from "@/lib/catalog-cache";
import { brandNames } from "@/lib/public-text";

/** อายุแคชของข้อมูล catalog (route/ปลายทาง/แผน) — ล้างทันทีที่แอดมินบันทึก */
const CATALOG_TTL_MS = 60_000;

/** แผนขั้นต่ำที่จำเป็นต้องมีเพื่อใช้โมเดล/route นี้ (null = ใช้ได้ทุกแผน) */
export type PlanRequirement = {
  requiredPlanTier: number | null;
  requiredPlanLabel: string | null;
};

/**
 * โมเดลทั้งหมดสําหรับหน้า admin เท่านั้น
 *
 * มีชื่อ provider ต้นทางอยู่ในนี้ — ห้ามส่งออกจาก route ที่ผู้ใช้เรียกโดยตรง
 */
export type AdminModelDTO = {
  id: number;
  modelId: string;
  displayName: string;
  providerId: number;
  providerName: string;
  contextWindow: number;
  supportsVision: boolean;
  inputPricePerM: number;
  outputPricePerM: number;
  /** โลโก้ที่แสดงแทนชื่อผู้ให้บริการ (null = ใช้ตัวอักษรแรก) */
  logoUrl: string | null;
  /** ค่าใช้จ่ายต่อ request โดยประมาณ (1,000 in + 500 out tokens) */
  sampleCostUsd: number;
  enabled: boolean;
  visibleToUsers: boolean;
} & PlanRequirement;

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
} & PlanRequirement;

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

function toAdminDTO(
  m: ModelRow,
  providerName: string,
  req: PlanRequirement,
): Omit<AdminModelDTO, "enabled" | "visibleToUsers"> {
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
    ...req,
  };
}

const NO_REQ: PlanRequirement = { requiredPlanTier: null, requiredPlanLabel: null };

/**
 * แผนขั้นต่ำของ route = ขั้นที่สูงที่สุดในบรรดาโมเดลปลายทางที่เปิดใช้
 * (เพราะ fallback อาจไปจบที่โมเดลใดก็ได้ในชุด จึงต้องถือสิทธิ์ตามตัวที่เข้มสุด)
 */
function routeRequirement(
  targetModelIds: number[],
  reqs: Map<number, { tier: number; label: string }>,
): PlanRequirement {
  let worst: { tier: number; label: string } | null = null;
  for (const id of targetModelIds) {
    const r = reqs.get(id);
    if (r && (!worst || r.tier > worst.tier)) worst = r;
  }
  return worst
    ? { requiredPlanTier: worst.tier, requiredPlanLabel: worst.label }
    : NO_REQ;
}

/**
 * รายการ route ที่ผู้ใช้เห็นในหน้า /models
 *
 * อ้างอิง route เป็นหลัก (route = "โมเดล" ที่ผู้ใช้เรียก) เพราะผู้ใช้ไม่ควรรู้ว่า
 * เบื้องหลังส่งต่อไปค่ายไหน ถ้า displayMode = model จะแนบรายชื่อโมเดลปลายทางมาด้วย
 *
 * อ่านจากแคชก่อน — ชุด query เดียวกันนี้ถูกเรียกในทุก request ของแชทและ API
 * ถ้าไม่แคชจะเสียเวลาไป Supabase เกิน 1 วินาทีก่อนที่โมเดลจะเริ่มตอบ
 * (แอดมินบันทึกการตั้งค่าเมื่อไหร่ก็ล้างแคชทันทีใน revalidateAdmin)
 */
export async function listPublicRoutes(): Promise<PublicRouteDTO[]> {
  // ตอน DB ถูกข้าม อย่าเอาผลว่างไปใส่แคช เพราะจะค้างตาถึงครบอายุแม้ DB ฟื้นแล้ว
  if (isDbUnavailable()) return [];
  return cached("public-routes", CATALOG_TTL_MS, loadPublicRoutes);
}

/**
 * อุ่นแคชตั้งแต่ module ถูกโหลด — request แรกหลังเซิร์ฟเวอร์สตาร์ท/รีสตาร์ท
 * จะได้ไม่ต้องรอการเชื่อมต่อใหม่กับ Supabase (วัดได้ ~5 วินาทีถ้าต้องรอแบบนั้น)
 */
if (process.env.DATABASE_URL) {
  void listPublicRoutes().catch(() => undefined);
}

/**
 * ชื่อปลายทางที่จะแสดงต่อผู้ใช้
 *
 * displayName/modelId ที่แอดมินกรอกอาจมียี่ห้อค่ายต้นทางปนอยู่ (เช่น "GPT-5 (ชื่อยี่ห้อค่าย)"
 * หรือ "xai/grok-4.5") ซึ่งเราไม่เปิดเผยเด็ดขาด จึงตัดชื่อค่ายและ namespace หน้า
 * สlash ออกก่อน แล้วเก็บเฉพาะตระกูลโมเดลที่เหลือ
 */
function publicTargetLabel(displayName: string, modelId: string, names: string[]): string {
  let out = displayName || modelId || "";
  for (const name of names) {
    const clean = name.trim();
    if (clean.length < 3) continue;
    out = out.replace(new RegExp(clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
  }
  out = out
    .replace(/\/[a-z0-9._-]+/gi, (m) => m.slice(1)) // "xai/grok-4.5" → "grok-4.5"
    .replace(/[([][\s)*-]*[)\]]/g, "") // วงเล็บที่กลายเป็นช่องว่าง
    .replace(/[\s()*-]{2,}/g, " ")
    .replace(/^[\s()*-]+|[\s()*-]+$/g, "")
    .trim();
  if (out) return out;
  const tail = (modelId || "").split("/").pop()?.trim() ?? "";
  return tail || "ปลายทาง";
}

async function loadPublicRoutes(): Promise<PublicRouteDTO[]> {
  const reqs = await modelPlanRequirements();

  try {
    const db = getDb();
    const [routeRows, targetRows, modelRows, providerRows] = await Promise.all([
      db.select().from(routes).where(eq(routes.enabled, true)).orderBy(asc(routes.id)),
      db.select().from(routeTargets).orderBy(asc(routeTargets.priority)),
      db.select().from(models),
      db.select().from(providers),
    ]);
    const names = brandNames(providerRows);

    return routeRows.map((r) => {
      const targets = targetRows
        .filter((t) => t.routeId === r.id && t.enabled)
        .sort((a, b) => a.priority - b.priority);
      return {
        id: r.id,
        publicModel: r.publicModel,
        displayName: r.displayName || r.publicModel,
        description: r.description,
        displayMode: r.displayMode,
        logoUrl: r.logoUrl ?? null,
        inputPricePerM: Number(r.inputPricePerM ?? 0),
        outputPricePerM: Number(r.outputPricePerM ?? 0),
        targets: targets.map((t) => {
          const m = modelRows.find((x) => x.id === t.modelRefId);
          return {
            label: publicTargetLabel(m?.displayName ?? "", m?.modelId ?? "", names),
            contextWindow: m?.contextWindow ?? 0,
            supportsVision: m?.supportsVision ?? false,
          };
        }),
        ...routeRequirement(targets.map((t) => t.modelRefId), reqs),
      };
    });
  } catch (err) {
    markDbUnavailable(err);
    return [];
  }
}

/** โมเดลทั้งหมดสําหรับหน้า admin */
export async function listAllModelsForAdmin(): Promise<AdminModelDTO[]> {
  if (isDbUnavailable()) return [];

  const reqs = await modelPlanRequirements();
  const reqOf = (id: number) => {
    const r = reqs.get(id);
    return r ? { requiredPlanTier: r.tier, requiredPlanLabel: r.label } : NO_REQ;
  };

  try {
    const db = getDb();
    const [modelRows, providerRows] = await Promise.all([
      db.select().from(models).orderBy(asc(models.providerId), asc(models.modelId)),
      db.select().from(providers),
    ]);
    return modelRows.map((m) => ({
      ...toAdminDTO(m, providerRows.find((p) => p.id === m.providerId)?.name ?? "?", reqOf(m.id)),
      enabled: m.enabled,
      visibleToUsers: m.visibleToUsers,
    }));
  } catch (err) {
    markDbUnavailable(err);
    return [];
  }
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

/** ค่า "ยังไม่มีข้อมูล" ตอนอ่าน DB ไม่ได้ — ศูนย์ล้วน ไม่ได้แต่งตัวเลข */
function emptyUserMetrics(userId: string): UserMetrics {
  return {
    userId,
    requests: 0,
    tokens: 0,
    costUsd: 0,
    topModel: null,
    topAgent: null,
  };
}

export async function getUserMetrics(userId: string): Promise<UserMetrics> {
  if (isDbUnavailable()) return emptyUserMetrics(userId);
  try {
    return await userMetricsReal(userId);
  } catch (err) {
    markDbUnavailable(err);
    return emptyUserMetrics(userId);
  }
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