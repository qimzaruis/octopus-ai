import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assets,
  models,
  providerKeyLimits,
  providerKeys,
  providers,
  routeCategories,
  routeTargets,
  routes,
  type ProviderKey,
  type ProviderKeyLimit,
} from "@/db/schema";
import { isDbUnavailable } from "@/lib/db-circuit";
import { invalidateCache } from "@/lib/catalog-cache";
import { resolveCategoryForAsset } from "@/lib/data/categories";
import { readThrough } from "@/lib/data/read-through";
import { categoryRank } from "@/lib/categories";
import {
  cooldownMinutesLeft,
  cooldownUntilFrom,
  keyHealth,
  limitMinutesLeft,
  type KeyHealth,
} from "@/lib/rotation";

export type ModelDTO = {
  id: number;
  providerId: number;
  modelId: string;
  displayName: string;
  contextWindow: number;
  supportsVision: boolean;
  enabled: boolean;
  visibleToUsers: boolean;
  inputPricePerM: number;
  outputPricePerM: number;
  /** โลโก้ที่แสดงแทนชื่อ provider (null = ยังไม่ตั้ง) */
  logoUrl: string | null;
};

/** คีย์ของ provider พร้อมสถานะสุขภาพสําหรับ UI */
export type ProviderKeyDTO = {
  id: number;
  label: string;
  apiKeyMasked: string;
  enabled: boolean;
  isPrimary: boolean;
  failureCount: number;
  /** พร้อมใช้ / ติด cooldown / ติดลิมิตโควต้า / ปิดใช้งาน */
  health: KeyHealth;
  /** นาทีที่เหลือของ cooldown (0 = ไม่ติด) */
  cooldownMinutes: number;
  /** นาทีที่เหลือก่อนเวลารีเซตของค่าย (0 = ไม่ติดลิมิต) */
  limitMinutes: number;
  /** เวลาที่คีย์กลับมาใช้ได้ (ISO) — null = ไม่ติดลิมิต */
  limitUntil: string | null;
  /** หลักฐานสั้น ๆ ที่ทำให้ระบบสรุปว่าติดลิมิต เช่น 402 · insufficient_quota */
  limitReason: string;
};

export type ProviderDTO = {
  id: number;
  name: string;
  baseUrl: string;
  enabled: boolean;
  /** คีย์ทั้งหมดของ provider (คีย์หลักก่อน) */
  keys: ProviderKeyDTO[];
  models: ModelDTO[];
};

/** รูปในคลัง — อัปครั้งเดียวแล้วเลือกใช้ซ้ำได้ */
export type AssetDTO = {
  id: number;
  name: string;
  publicUrl: string;
  storagePath: string;
};

export type RouteTargetDTO = {
  id: number;
  modelRefId: number;
  modelLabel: string; // "provider / model"
  priority: number;
  enabled: boolean;
};

export type RouteDTO = {
  id: number;
  publicModel: string;
  description: string;
  /** router = แสดงเป็นรายการเดียว · model = กางโมเดลปลายทางใต้ route */
  displayMode: string;
  displayName: string;
  categoryId: number | null;
  logoUrl: string | null;
  inputPricePerM: number;
  outputPricePerM: number;
  enabled: boolean;
  targets: RouteTargetDTO[];
};

/** หมวด/แบรนด์ของโมเดล — ชื่อและรูปเป็นค่าเดียวกัน */
export type RouteCategoryDTO = {
  id: number;
  name: string;
  logoUrl: string | null;
  sortOrder: number;
};

function maskKey(key: string): string {
  if (!key) return "—";
  if (key.length <= 8) return `${key.slice(0, 3)}••••`;
  return `${key.slice(0, 6)}${"•".repeat(10)}`;
}

/** คีย์ 1 แถว → DTO ที่ทั้งหน้า providers และ key-limits ใช้ร่วมกัน */
function keyDTO(k: ProviderKey): ProviderKeyDTO {
  return {
    id: k.id,
    label: k.label,
    apiKeyMasked: maskKey(k.apiKey),
    enabled: k.enabled,
    isPrimary: k.isPrimary,
    failureCount: k.failureCount,
    health: keyHealth(k),
    cooldownMinutes: cooldownMinutesLeft(k),
    limitMinutes: limitMinutesLeft(k),
    limitUntil: k.limitUntil ? k.limitUntil.toISOString() : null,
    limitReason: k.limitReason,
  };
}

// ---------------------------------------------------------------------
// อ่านข้อมูล
// ---------------------------------------------------------------------

/** DB อ่านไม่ได้ → คืน snapshot ล่าสุด (หรือรายการว่าง) ห้ามส่งข้อมูลสมมติให้หน้า admin */
export async function listProvidersWithModels(): Promise<ProviderDTO[]> {
  const result = await readThrough("admin:providers", async () => {
    const db = getDb();
    const [providerRows, modelRows, keyRows] = await Promise.all([
      db.select().from(providers).orderBy(asc(providers.id)),
      db.select().from(models).orderBy(asc(models.id)),
      db.select().from(providerKeys).orderBy(asc(providerKeys.id)),
    ]);

    return providerRows.map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      enabled: p.enabled,
      keys: keyRows
        .filter((k) => k.providerId === p.id)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.id - b.id)
        .map(keyDTO),
      models: modelRows
        .filter((m) => m.providerId === p.id)
        .map((m) => ({
          id: m.id,
          providerId: m.providerId,
          modelId: m.modelId,
          displayName: m.displayName,
          contextWindow: m.contextWindow,
          supportsVision: m.supportsVision,
          enabled: m.enabled,
          visibleToUsers: m.visibleToUsers,
          inputPricePerM: m.inputPricePerM,
          outputPricePerM: m.outputPricePerM,
          logoUrl: m.logoUrl ?? null,
        })),
    }));
  });
  return result ?? [];
}

export async function listRoutesWithTargets(): Promise<RouteDTO[]> {
  const buildFrom = (
    routesList: {
      id: number;
      publicModel: string;
      description: string;
      displayMode: string;
      displayName: string;
      categoryId: number | null;
      logoUrl: string | null;
      inputPricePerM: number;
      outputPricePerM: number;
      enabled: boolean;
    }[],
    targetsList: { id: number; routeId: number; modelRefId: number; priority: number; enabled: boolean }[],
    modelLookup: (id: number) => string,
  ): RouteDTO[] =>
    routesList.map((r) => ({
      id: r.id,
      publicModel: r.publicModel,
      description: r.description,
      displayMode: r.displayMode,
      displayName: r.displayName,
      categoryId: r.categoryId ?? null,
      logoUrl: r.logoUrl ?? null,
      inputPricePerM: Number(r.inputPricePerM),
      outputPricePerM: Number(r.outputPricePerM),
      enabled: r.enabled,
      targets: targetsList
        .filter((t) => t.routeId === r.id)
        .sort((a, b) => a.priority - b.priority)
        .map((t) => ({
          id: t.id,
          modelRefId: t.modelRefId,
          modelLabel: modelLookup(t.modelRefId),
          priority: t.priority,
          enabled: t.enabled,
        })),
    }));

  const result = await readThrough("admin:routes", async () => {
    const db = getDb();
    const [routeRows, targetRows, providerRows, modelRows] = await Promise.all([
      db.select().from(routes).orderBy(asc(routes.id)),
      db.select().from(routeTargets).orderBy(asc(routeTargets.priority)),
      db.select().from(providers),
      db.select().from(models),
    ]);

    const lookup = (id: number) => {
      const m = modelRows.find((x) => x.id === id);
      if (!m) return "?";
      const p = providerRows.find((x) => x.id === m.providerId);
      return `${p?.name ?? "?"} / ${m.modelId}`;
    };
    return buildFrom(routeRows, targetRows, lookup);
  });
  return result ?? [];
}

export async function listRouteCategories(): Promise<RouteCategoryDTO[]> {
  const result = await readThrough("admin:categories", async () => {
    const rows = await getDb()
      .select()
      .from(routeCategories)
      .orderBy(asc(routeCategories.sortOrder), asc(routeCategories.id));
    return rows
      .map((c) => ({
        id: c.id,
        name: c.name,
        logoUrl: c.logoUrl ?? null,
        sortOrder: c.sortOrder,
      }))
      .sort(
        (a, b) =>
          categoryRank(a.name) - categoryRank(b.name) ||
          a.sortOrder - b.sortOrder ||
          a.id - b.id,
      );
  });
  return result ?? [];
}

// ---------------------------------------------------------------------
// Provider CRUD
// ---------------------------------------------------------------------

export type ActionResult = { ok: boolean; error?: string };

export async function upsertProvider(input: {
  id?: number;
  name: string;
  baseUrl: string;
}): Promise<ActionResult> {
  const name = input.name.trim();
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  if (!name || !baseUrl) return { ok: false, error: "กรอกชื่อและ Base URL ให้ครบ" };

  // เขียนไม่ได้ = บอกผู้ใช้ตรง ๆ ห้ามตอบว่าสำเร็จทั้งที่ไม่ได้แตะ DB
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  if (input.id) {
    await db.update(providers).set({ name, baseUrl }).where(eq(providers.id, input.id));
  } else {
    await db.insert(providers).values({ name, baseUrl });
  }
  return { ok: true };
}

// ---------------------------------------------------------------------
// Provider keys (หลายคีย์ต่อ provider + สถิติหมุน)
// ---------------------------------------------------------------------

/** เพิ่มคีย์ใหม่ให้ provider — คีย์แรกที่เพิ่มจะเป็นคีย์หลักอัตโนมัติ */
export async function addProviderKey(input: {
  providerId: number;
  label: string;
  apiKey: string;
}): Promise<ActionResult> {
  const apiKey = input.apiKey.trim();
  const label = input.label.trim() || "main";
  if (!input.providerId) return { ok: false, error: "ไม่พบ provider" };
  if (!apiKey) return { ok: false, error: "กรอก API key ก่อน" };

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  const siblings = await db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.providerId, input.providerId));
  await db.insert(providerKeys).values({
    providerId: input.providerId,
    label,
    apiKey,
    isPrimary: siblings.length === 0,
  });
  return { ok: true };
}

/** แก้ไขคีย์ — ค่า apiKey ว่าง = คงเดิม (ไม่เขียนทับ) */
export async function updateProviderKey(input: {
  id: number;
  label: string;
  apiKey?: string;
}): Promise<ActionResult> {
  const label = input.label.trim() || "main";

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const patch: {
    label: string;
    apiKey?: string;
    failureCount?: number;
    cooldownUntil?: Date | null;
    limitUntil?: Date | null;
    limitReason?: string;
  } = { label };
  if (input.apiKey?.trim()) {
    patch.apiKey = input.apiKey.trim();
    // เปลี่ยนคีย์ใหม่ = เริ่มสถานะสุขภาพใหม่ทันที ไม่ต้องรอ cooldown ของคีย์เก่า
    patch.failureCount = 0;
    patch.cooldownUntil = null;
    patch.limitUntil = null;
    patch.limitReason = "";
  }
  await getDb().update(providerKeys).set(patch).where(eq(providerKeys.id, input.id));
  return { ok: true };
}

export async function toggleProviderKey(id: number, enabled: boolean): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().update(providerKeys).set({ enabled }).where(eq(providerKeys.id, id));
  return { ok: true };
}

/** ตั้งคีย์นี้เป็นคีย์หลัก — คีย์อื่นของ provider เดียวกันถูกถอดตําแหน่ง */
export async function setPrimaryProviderKey(id: number): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  const k = (await db.select().from(providerKeys).where(eq(providerKeys.id, id)))[0];
  if (!k) return { ok: false, error: "ไม่พบคีย์" };
  await db
    .update(providerKeys)
    .set({ isPrimary: false })
    .where(eq(providerKeys.providerId, k.providerId));
  await db.update(providerKeys).set({ isPrimary: true }).where(eq(providerKeys.id, id));
  return { ok: true };
}

export async function deleteProviderKey(id: number): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().delete(providerKeys).where(eq(providerKeys.id, id));
  return { ok: true };
}

/**
 * บันทึกผลการใช้คีย์ — ใช้โดย gateway ตอนยิง request จริง
 *
 * สําเร็จ   → รีเซ็ต failureCount + ปลด cooldown/ลิมิต + อัปเดต lastUsedAt
 * ล้มเหลว   → failureCount++ แล้วตั้ง cooldown ตามลําดับ backoff
 *
 * คีย์ที่ "โควต้าของค่ายหมด" ไม่ใช้ฟังก์ชันนี้ แต่ใช้ markKeyLimited() ซึ่งพัก
 * ถึงเวลารีเซตของค่าย (backoff สั้น ๆ ไม่มีประโยชน์กับลิมิตแบบทั้งวัน)
 */
export async function recordKeyResult(
  keyId: number,
  ok: boolean,
  _kind?: "error" | "rate_limit",
): Promise<ActionResult> {
  const now = new Date();

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  const k = (await db.select().from(providerKeys).where(eq(providerKeys.id, keyId)))[0];
  if (!k) return { ok: false, error: "ไม่พบคีย์" };

  if (ok) {
    await db
      .update(providerKeys)
      .set({ failureCount: 0, cooldownUntil: null, limitUntil: null, limitReason: "", lastUsedAt: now })
      .where(eq(providerKeys.id, keyId));
  } else {
    const next = k.failureCount + 1;
    await db
      .update(providerKeys)
      .set({ failureCount: next, lastErrorAt: now, cooldownUntil: cooldownUntilFrom(next, now) })
      .where(eq(providerKeys.id, keyId));
  }
  return { ok: true };
}

// ---------------------------------------------------------------------
// คีย์ติดลิมิตโควต้า (พักถึงเวลารีเซตของค่าย)
// ---------------------------------------------------------------------

/**
 * ตั้งสถานะ "ติดลิมิต" ให้คีย์ — gateway เรียกเมื่อ response ตรงกติกาของ provider นั้น
 *
 * ไม่แตะ failureCount/cooldown เพราะสาเหตุไม่ใช่ระบบพังชั่วคราว แต่เป็นโควต้าหมด
 * และต้องล้างแคชบัญชีคีย์ด้วย ไม่งั้น request ถัดไปยังเห็นคีย์นี้ว่าใช้ได้
 */
export async function markKeyLimited(
  keyId: number,
  until: Date,
  reason: string,
): Promise<ActionResult> {
  const now = new Date();

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  await getDb()
    .update(providerKeys)
    .set({ limitUntil: until, limitReason: reason, lastLimitedAt: now, lastErrorAt: now })
    .where(eq(providerKeys.id, keyId));
  invalidateCache("keys:");
  return { ok: true };
}

/** ปลดลิมิตก่อนเวลา — แอดมินกดเมื่อเติมเครดิต/อัปเกรดแผนแล้วไม่ต้องรอรีเซต */
export async function clearKeyLimit(keyId: number): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb()
    .update(providerKeys)
    .set({ limitUntil: null, limitReason: "" })
    .where(eq(providerKeys.id, keyId));
  invalidateCache("keys:");
  return { ok: true };
}

// ---------------------------------------------------------------------
// กติกาจับลิมิตต่อ provider (หน้า /admin/key-limits)
// ---------------------------------------------------------------------

/** กติกา + ชื่อ provider + สถานะคีย์แต่ละตัว ของ provider รายหนึ่ง */
export type KeyLimitDTO = {
  providerId: number;
  providerName: string;
  baseUrl: string;
  rule: ProviderKeyLimit | null;
  keys: ProviderKeyDTO[];
};

/** ทุก provider เรียงตาม id (แถวไหนยังไม่มีกติกา = rule null) */
export async function listKeyLimits(): Promise<KeyLimitDTO[]> {
  const result = await readThrough("admin:key-limits", async () => {
    const db = getDb();
    const [providerRows, keyRows, ruleRows] = await Promise.all([
      db.select().from(providers).orderBy(asc(providers.id)),
      db.select().from(providerKeys).orderBy(asc(providerKeys.id)),
      db.select().from(providerKeyLimits),
    ]);
    return providerRows.map((p) => ({
      providerId: p.id,
      providerName: p.name,
      baseUrl: p.baseUrl,
      rule: ruleRows.find((r) => r.providerId === p.id) ?? null,
      keys: keyRows
        .filter((k) => k.providerId === p.id)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.id - b.id)
        .map(keyDTO),
    }));
  });
  return result ?? [];
}

/** ตั้ง/แก้กติกาของ provider หนึ่งราย — ต้องมีเงื่อนไขจับอย่างน้อยหนึ่งช่อง */
export async function upsertKeyLimit(input: {
  providerId: number;
  enabled: boolean;
  httpStatuses: number[];
  errorCodes: string[];
  keywords: string[];
  resetTime: string;
  resetTimezone: string;
}): Promise<ActionResult> {
  if (!input.providerId) return { ok: false, error: "ไม่พบ provider" };
  if (!/^\d{1,2}:\d{2}$/.test(input.resetTime.trim())) {
    return { ok: false, error: "เวลารีเซตต้องเป็น HH:MM" };
  }
  if (input.enabled && input.httpStatuses.length === 0 && input.errorCodes.length === 0 && input.keywords.length === 0) {
    return { ok: false, error: "กรอกเงื่อนไขจับอย่างน้อยหนึ่งช่อง (status / code / คำสำคัญ)" };
  }

  const row = {
    enabled: input.enabled,
    httpStatuses: input.httpStatuses,
    errorCodes: input.errorCodes,
    keywords: input.keywords,
    resetTime: input.resetTime.trim(),
    resetTimezone: input.resetTimezone.trim() || "UTC",
    updatedAt: new Date(),
  };

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  const exists = (
    await db.select().from(providerKeyLimits).where(eq(providerKeyLimits.providerId, input.providerId))
  )[0];
  if (exists) {
    await db.update(providerKeyLimits).set(row).where(eq(providerKeyLimits.providerId, input.providerId));
  } else {
    await db.insert(providerKeyLimits).values({ providerId: input.providerId, ...row });
  }
  invalidateCache("keylimit:");
  return { ok: true };
}

// ---------------------------------------------------------------------
// คลังรูป (assets)
// ---------------------------------------------------------------------

export async function listAssets(): Promise<AssetDTO[]> {
  const result = await readThrough("admin:assets", async () => {
    const rows = await getDb().select().from(assets).orderBy(asc(assets.id));
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      publicUrl: a.publicUrl,
      storagePath: a.storagePath,
    }));
  });
  return result ?? [];
}

export async function createAsset(input: {
  name: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ ok: boolean; error?: string; asset?: AssetDTO }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "ตั้งชื่อรูปก่อนบันทึก" };

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const inserted = await getDb()
    .insert(assets)
    .values({
      name,
      storagePath: input.storagePath,
      publicUrl: input.publicUrl,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    })
    .returning();
  const a = inserted[0];
  return {
    ok: true,
    asset: { id: a.id, name: a.name, publicUrl: a.publicUrl, storagePath: a.storagePath },
  };
}

export async function deleteAsset(id: number): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  const a = (await db.select().from(assets).where(eq(assets.id, id)))[0];
  await db.delete(assets).where(eq(assets.id, id));
  if (a) {
    await db.update(models).set({ logoUrl: null }).where(eq(models.logoUrl, a.publicUrl));
    await db
      .update(routeCategories)
      .set({ logoUrl: null })
      .where(eq(routeCategories.logoUrl, a.publicUrl));
    await db.update(routes).set({ logoUrl: null }).where(eq(routes.logoUrl, a.publicUrl));
  }
  return { ok: true };
}

/** ตั้ง/ล้างโลโก้ของโมเดล (null = กลับไปแสดงตัวอักษรแรกของ provider) */
export async function setModelLogo(id: number, logoUrl: string | null): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().update(models).set({ logoUrl }).where(eq(models.id, id));
  return { ok: true };
}

export async function toggleProvider(id: number, enabled: boolean): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().update(providers).set({ enabled }).where(eq(providers.id, id));
  return { ok: true };
}

export async function deleteProvider(id: number): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().delete(providers).where(eq(providers.id, id));
  return { ok: true };
}

// ---------------------------------------------------------------------
// Model CRUD
// ---------------------------------------------------------------------

export async function addModel(input: {
  providerId: number;
  modelId: string;
  displayName: string;
  contextWindow: number;
  supportsVision: boolean;
  logoUrl?: string | null;
}): Promise<ActionResult> {
  const modelId = input.modelId.trim();
  if (!input.providerId || !modelId) {
    return { ok: false, error: "กรอก model ID ให้ครบ" };
  }

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  try {
    await db.insert(models).values({
      providerId: input.providerId,
      modelId,
      displayName: input.displayName.trim() || modelId,
      contextWindow: input.contextWindow || 128000,
      supportsVision: input.supportsVision,
      logoUrl: input.logoUrl ?? null,
    });
  } catch {
    return { ok: false, error: "มีโมเดลนี้ใน provider แล้ว" };
  }
  return { ok: true };
}

export async function toggleModel(id: number, enabled: boolean): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().update(models).set({ enabled }).where(eq(models.id, id));
  return { ok: true };
}

export async function deleteModel(id: number): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().delete(models).where(eq(models.id, id));
  return { ok: true };
}

/** เปิด/ปิดการมองเห็นโมเดลในหน้าผู้ใช้ (visible_to_users) */
export async function setModelVisibility(id: number, visible: boolean): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().update(models).set({ visibleToUsers: visible }).where(eq(models.id, id));
  return { ok: true };
}

/**
 * ตั้งค่าทั้ง enabled และ visibleToUsers พร้อมกัน
 * ใช้ในหน้ารวม (Routing & Models) ที่ปรับสองสวิตช์ในฟอร์มเดียว
 */
export async function setModelOptions(
  id: number,
  opts: { enabled: boolean; visibleToUsers: boolean },
): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb()
    .update(models)
    .set({ enabled: opts.enabled, visibleToUsers: opts.visibleToUsers })
    .where(eq(models.id, id));
  return { ok: true };
}

/** ตั้งราคาต่อ 1M tokens (USD) */
export async function setModelPricing(
  id: number,
  inputPricePerM: number,
  outputPricePerM: number,
): Promise<ActionResult> {
  if (!Number.isFinite(inputPricePerM) || !Number.isFinite(outputPricePerM)) {
    return { ok: false, error: "ราคาไม่ถูกต้อง" };
  }
  if (inputPricePerM < 0 || outputPricePerM < 0) {
    return { ok: false, error: "ราคาต้องไม่ติดลบ" };
  }
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb()
    .update(models)
    .set({ inputPricePerM, outputPricePerM })
    .where(eq(models.id, id));
  return { ok: true };
}

// ---------------------------------------------------------------------
// Route CRUD
// ---------------------------------------------------------------------

function slugName(publicModel: string): string {
  return publicModel
    .split("-")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/**
 * สร้าง/แก้ route พร้อมทุกค่าที่ผู้ใช้เห็น — ชื่อ, id, รูป/หมวด, ราคา, โหมด,
 * และโมเดลปลายทางตัวแรก (ตอนสร้างใหม่)
 *
 * หมวดกับรูปเป็นค่าเดียวกัน: เลือกรูปจากคลัง แล้วชื่อรูปกลายเป็นชื่อหมวดให้เอง
 */
export async function upsertRoute(input: {
  id?: number;
  publicModel: string;
  description: string;
  displayName?: string;
  displayMode?: string;
  logoUrl?: string | null;
  inputPricePerM?: number;
  outputPricePerM?: number;
  firstTargetModelRefId?: number | null;
}): Promise<ActionResult> {
  const publicModel = input.publicModel.trim().toLowerCase().replace(/\s+/g, "-");
  if (!publicModel) return { ok: false, error: "กรอก id ของโมเดลก่อนบันทึก" };

  const inputPrice = Number(input.inputPricePerM ?? 0);
  const outputPrice = Number(input.outputPricePerM ?? 0);
  if (!Number.isFinite(inputPrice) || inputPrice < 0) {
    return { ok: false, error: "ราคา input ต้องไม่ติดลบ" };
  }
  if (!Number.isFinite(outputPrice) || outputPrice < 0) {
    return { ok: false, error: "ราคา output ต้องไม่ติดลบ" };
  }

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  try {
    const firstTargetId =
      Number.isFinite(input.firstTargetModelRefId) && input.firstTargetModelRefId
        ? input.firstTargetModelRefId
        : null;
    const logoUrl = input.logoUrl?.trim() || null;
    const category = await resolveCategoryForAsset(logoUrl);
    // เลือกรูปที่มีอยู่ในคลังเท่านั้น — ไม่สร้างหมวดลอย ๆ จาก URL มั่ว
    if (logoUrl && !category) {
      return { ok: false, error: "ไม่พบรูปที่เลือก — อัปโหลดเข้าคลังก่อน" };
    }
    const categoryId = category?.id ?? null;
    const categoryLogo = category?.logoUrl ?? null;

    const displayName =
      input.displayName?.trim() || slugName(publicModel) || publicModel;
    const displayMode = input.displayMode === "model" ? "model" : "router";

    if (input.id) {
      await db
        .update(routes)
        .set({
          publicModel,
          description: input.description.trim(),
          displayName,
          displayMode,
          categoryId,
          logoUrl: categoryLogo,
          inputPricePerM: inputPrice,
          outputPricePerM: outputPrice,
        })
        .where(eq(routes.id, input.id));
    } else {
      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(routes)
          .values({
            publicModel,
            description: input.description.trim(),
            displayName,
            displayMode,
            categoryId,
            logoUrl: categoryLogo,
            inputPricePerM: inputPrice,
            outputPricePerM: outputPrice,
          })
          .returning();

        if (firstTargetId && inserted[0]) {
          await tx.insert(routeTargets).values({
            routeId: inserted[0].id,
            modelRefId: firstTargetId,
            priority: 1,
          });
        }
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/duplicate|unique|23505/i.test(msg)) {
      return { ok: false, error: "มี id ของโมเดลนี้แล้ว" };
    }
    console.error("[admin] บันทึก route ไม่สำเร็จ:", err);
    return { ok: false, error: "บันทึก route ไม่สำเร็จ" };
  }
  return { ok: true };
}

export async function toggleRoute(id: number, enabled: boolean): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().update(routes).set({ enabled }).where(eq(routes.id, id));
  return { ok: true };
}

export async function deleteRoute(id: number): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().delete(routes).where(eq(routes.id, id));
  return { ok: true };
}

export async function addRouteTarget(input: {
  routeId: number;
  modelRefId: number;
}): Promise<ActionResult> {
  if (!input.routeId || !input.modelRefId) {
    return { ok: false, error: "เลือกโมเดลปลายทางก่อน" };
  }

  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  const existing = await db
    .select()
    .from(routeTargets)
    .where(eq(routeTargets.routeId, input.routeId));
  if (existing.some((t) => t.modelRefId === input.modelRefId)) {
    return { ok: false, error: "โมเดลนี้อยู่ใน route แล้ว" };
  }
  await db.insert(routeTargets).values({
    routeId: input.routeId,
    modelRefId: input.modelRefId,
    priority: existing.length + 1,
  });
  return { ok: true };
}

export async function moveRouteTarget(targetId: number, direction: -1 | 1): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const db = getDb();
  const target = (
    await db.select().from(routeTargets).where(eq(routeTargets.id, targetId))
  )[0];
  if (!target) return { ok: false, error: "ไม่พบ target" };
  const siblings = (
    await db.select().from(routeTargets).where(eq(routeTargets.routeId, target.routeId))
  ).sort((a, b) => a.priority - b.priority);
  const idx = siblings.findIndex((t) => t.id === targetId);
  const swapWith = siblings[idx + direction];
  if (!swapWith) return { ok: true };
  await db
    .update(routeTargets)
    .set({ priority: swapWith.priority })
    .where(eq(routeTargets.id, target.id));
  await db
    .update(routeTargets)
    .set({ priority: target.priority })
    .where(eq(routeTargets.id, swapWith.id));
  return { ok: true };
}

export async function toggleRouteTarget(
  targetId: number,
  enabled: boolean,
): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().update(routeTargets).set({ enabled }).where(eq(routeTargets.id, targetId));
  return { ok: true };
}

export async function removeRouteTarget(targetId: number): Promise<ActionResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };
  await getDb().delete(routeTargets).where(eq(routeTargets.id, targetId));
  return { ok: true };
}
