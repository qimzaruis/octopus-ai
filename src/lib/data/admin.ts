import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, models, providerKeys, providers, routeTargets, routes } from "@/db/schema";
import { isDemoMode } from "@/lib/config";
import { getDemoStore } from "@/lib/demo/store";
import { cooldownUntilFrom, cooldownMinutesLeft, keyHealth, type KeyHealth } from "@/lib/rotation";

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
  /** พร้อมใช้ / ติด cooldown / ปิดใช้งาน */
  health: KeyHealth;
  /** นาทีที่เหลือของ cooldown (0 = ไม่ติด) */
  cooldownMinutes: number;
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
  logoUrl: string | null;
  inputPricePerM: number;
  outputPricePerM: number;
  enabled: boolean;
  targets: RouteTargetDTO[];
};

function maskKey(key: string): string {
  if (!key) return "—";
  if (key.length <= 8) return `${key.slice(0, 3)}••••`;
  return `${key.slice(0, 6)}${"•".repeat(10)}`;
}

function modelLabel(m: ModelDTO, providerName: string): string {
  return `${providerName} / ${m.modelId}`;
}

// ---------------------------------------------------------------------
// อ่านข้อมูล
// ---------------------------------------------------------------------

export async function listProvidersWithModels(): Promise<ProviderDTO[]> {
  if (isDemoMode) {
    const store = getDemoStore();
    return store.providers.map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      enabled: p.enabled,
      keys: store.providerKeys
        .filter((k) => k.providerId === p.id)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.id - b.id)
        .map((k) => ({
          id: k.id,
          label: k.label,
          apiKeyMasked: maskKey(k.apiKey),
          enabled: k.enabled,
          isPrimary: k.isPrimary,
          failureCount: k.failureCount,
          health: keyHealth(k),
          cooldownMinutes: cooldownMinutesLeft(k),
        })),
      models: store.models
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
  }

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
      .map((k) => ({
        id: k.id,
        label: k.label,
        apiKeyMasked: maskKey(k.apiKey),
        enabled: k.enabled,
        isPrimary: k.isPrimary,
        failureCount: k.failureCount,
        health: keyHealth(k),
        cooldownMinutes: cooldownMinutesLeft(k),
      })),
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
}

export async function listRoutesWithTargets(): Promise<RouteDTO[]> {
  const buildFrom = (
    routesList: {
      id: number;
      publicModel: string;
      description: string;
      displayMode: string;
      displayName: string;
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

  if (isDemoMode) {
    const store = getDemoStore();
    const lookup = (id: number) => {
      const m = store.models.find((x) => x.id === id);
      if (!m) return "?";
      const p = store.providers.find((x) => x.id === m.providerId);
      return modelLabel(
        { ...m } as ModelDTO,
        p?.name ?? "?",
      );
    };
    return buildFrom(store.routes, store.routeTargets, lookup);
  }

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

  if (isDemoMode) {
    const store = getDemoStore();
    if (input.id) {
      const p = store.providers.find((x) => x.id === input.id);
      if (!p) return { ok: false, error: "ไม่พบ provider" };
      p.name = name;
      p.baseUrl = baseUrl;
    } else {
      const id = Math.max(0, ...store.providers.map((x) => x.id)) + 1;
      store.providers.push({
        id,
        name,
        baseUrl,
        apiKey: "",
        enabled: true,
        createdAt: new Date(),
      });
    }
    return { ok: true };
  }

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

  if (isDemoMode) {
    const store = getDemoStore();
    const siblings = store.providerKeys.filter((k) => k.providerId === input.providerId);
    const id = Math.max(0, ...store.providerKeys.map((k) => k.id)) + 1;
    store.providerKeys.push({
      id,
      providerId: input.providerId,
      label,
      apiKey,
      enabled: true,
      isPrimary: siblings.length === 0,
      failureCount: 0,
      cooldownUntil: null,
      lastErrorAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
    });
    return { ok: true };
  }

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

  if (isDemoMode) {
    const k = getDemoStore().providerKeys.find((x) => x.id === input.id);
    if (!k) return { ok: false, error: "ไม่พบคีย์" };
    k.label = label;
    if (input.apiKey?.trim()) k.apiKey = input.apiKey.trim();
    return { ok: true };
  }

  const patch: { label: string; apiKey?: string } = { label };
  if (input.apiKey?.trim()) patch.apiKey = input.apiKey.trim();
  await getDb().update(providerKeys).set(patch).where(eq(providerKeys.id, input.id));
  return { ok: true };
}

export async function toggleProviderKey(id: number, enabled: boolean): Promise<ActionResult> {
  if (isDemoMode) {
    const k = getDemoStore().providerKeys.find((x) => x.id === id);
    if (!k) return { ok: false, error: "ไม่พบคีย์" };
    k.enabled = enabled;
    return { ok: true };
  }
  await getDb().update(providerKeys).set({ enabled }).where(eq(providerKeys.id, id));
  return { ok: true };
}

/** ตั้งคีย์นี้เป็นคีย์หลัก — คีย์อื่นของ provider เดียวกันถูกถอดตําแหน่ง */
export async function setPrimaryProviderKey(id: number): Promise<ActionResult> {
  if (isDemoMode) {
    const store = getDemoStore();
    const k = store.providerKeys.find((x) => x.id === id);
    if (!k) return { ok: false, error: "ไม่พบคีย์" };
    store.providerKeys
      .filter((x) => x.providerId === k.providerId)
      .forEach((x) => {
        x.isPrimary = x.id === id;
      });
    return { ok: true };
  }

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
  if (isDemoMode) {
    const store = getDemoStore();
    const k = store.providerKeys.find((x) => x.id === id);
    store.providerKeys = store.providerKeys.filter((x) => x.id !== id);
    // ถ้าลบตัวหลักไป ให้ตัวแรกที่เหลือเป็นหลักแทน เพื่อไม่ให้ provider ไม่มีคีย์หลัก
    if (k?.isPrimary) {
      const rest = store.providerKeys.filter((x) => x.providerId === k.providerId);
      if (rest[0]) rest[0].isPrimary = true;
    }
    return { ok: true };
  }
  await getDb().delete(providerKeys).where(eq(providerKeys.id, id));
  return { ok: true };
}

/**
 * บันทึกผลการใช้คีย์ — ใช้โดย gateway/worker ตอนยิง request จริง
 *
 * สําเร็จ   → รีเซ็ต failureCount + ปลด cooldown + อัปเดต lastUsedAt
 * ล้มเหลว   → failureCount++ แล้วตั้ง cooldown ตามลําดับ backoff
 *
 * ยังไม่มีจุดเรียกในระบบตอนนี้ (ยังไม่มี gateway) แต่พร้อมให้ต่อทันที
 */
export async function recordKeyResult(
  keyId: number,
  ok: boolean,
  _kind?: "error" | "rate_limit",
): Promise<ActionResult> {
  const now = new Date();

  if (isDemoMode) {
    const k = getDemoStore().providerKeys.find((x) => x.id === keyId);
    if (!k) return { ok: false, error: "ไม่พบคีย์" };
    if (ok) {
      k.failureCount = 0;
      k.cooldownUntil = null;
      k.lastUsedAt = now;
    } else {
      k.failureCount += 1;
      k.lastErrorAt = now;
      k.cooldownUntil = cooldownUntilFrom(k.failureCount, now);
    }
    return { ok: true };
  }

  const db = getDb();
  const k = (await db.select().from(providerKeys).where(eq(providerKeys.id, keyId)))[0];
  if (!k) return { ok: false, error: "ไม่พบคีย์" };

  if (ok) {
    await db
      .update(providerKeys)
      .set({ failureCount: 0, cooldownUntil: null, lastUsedAt: now })
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
// คลังรูป (assets)
// ---------------------------------------------------------------------

export async function listAssets(): Promise<AssetDTO[]> {
  if (isDemoMode) {
    return getDemoStore().assets.map((a) => ({
      id: a.id,
      name: a.name,
      publicUrl: a.publicUrl,
      storagePath: a.storagePath,
    }));
  }
  const rows = await getDb().select().from(assets).orderBy(asc(assets.id));
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    publicUrl: a.publicUrl,
    storagePath: a.storagePath,
  }));
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

  if (isDemoMode) {
    const store = getDemoStore();
    const id = Math.max(0, ...store.assets.map((a) => a.id)) + 1;
    store.assets.push({
      id,
      name,
      storagePath: input.storagePath,
      publicUrl: input.publicUrl,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      createdAt: new Date(),
    });
    return {
      ok: true,
      asset: { id, name, publicUrl: input.publicUrl, storagePath: input.storagePath },
    };
  }

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
  if (isDemoMode) {
    const store = getDemoStore();
    const a = store.assets.find((x) => x.id === id);
    store.assets = store.assets.filter((x) => x.id !== id);
    // โมเดลที่เคยใช้รูปนี้กลับไปใช้ตัวอักษรแทน
    if (a) {
      store.models.forEach((m) => {
        if (m.logoUrl === a.publicUrl) m.logoUrl = null;
      });
    }
    return { ok: true };
  }

  const db = getDb();
  const a = (await db.select().from(assets).where(eq(assets.id, id)))[0];
  await db.delete(assets).where(eq(assets.id, id));
  if (a) {
    await db.update(models).set({ logoUrl: null }).where(eq(models.logoUrl, a.publicUrl));
  }
  return { ok: true };
}

/** ตั้ง/ล้างโลโก้ของโมเดล (null = กลับไปแสดงตัวอักษรแรกของ provider) */
export async function setModelLogo(id: number, logoUrl: string | null): Promise<ActionResult> {
  if (isDemoMode) {
    const m = getDemoStore().models.find((x) => x.id === id);
    if (!m) return { ok: false, error: "ไม่พบโมเดล" };
    m.logoUrl = logoUrl;
    return { ok: true };
  }
  await getDb().update(models).set({ logoUrl }).where(eq(models.id, id));
  return { ok: true };
}

export async function toggleProvider(id: number, enabled: boolean): Promise<ActionResult> {
  if (isDemoMode) {
    const p = getDemoStore().providers.find((x) => x.id === id);
    if (!p) return { ok: false, error: "ไม่พบ provider" };
    p.enabled = enabled;
    return { ok: true };
  }
  await getDb().update(providers).set({ enabled }).where(eq(providers.id, id));
  return { ok: true };
}

export async function deleteProvider(id: number): Promise<ActionResult> {
  if (isDemoMode) {
    const store = getDemoStore();
    store.providers = store.providers.filter((x) => x.id !== id);
    store.models = store.models.filter((m) => m.providerId !== id);
    return { ok: true };
  }
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

  if (isDemoMode) {
    const store = getDemoStore();
    const dup = store.models.some(
      (m) => m.providerId === input.providerId && m.modelId === modelId,
    );
    if (dup) return { ok: false, error: "มีโมเดลนี้ใน provider แล้ว" };
    const id = Math.max(0, ...store.models.map((m) => m.id)) + 1;
    store.models.push({
      id,
      providerId: input.providerId,
      modelId,
      displayName: input.displayName.trim() || modelId,
      contextWindow: input.contextWindow || 128000,
      supportsVision: input.supportsVision,
      enabled: true,
      visibleToUsers: true,
      inputPricePerM: 0,
      outputPricePerM: 0,
      logoUrl: input.logoUrl ?? null,
      createdAt: new Date(),
    });
    return { ok: true };
  }

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
  if (isDemoMode) {
    const m = getDemoStore().models.find((x) => x.id === id);
    if (!m) return { ok: false, error: "ไม่พบโมเดล" };
    m.enabled = enabled;
    return { ok: true };
  }
  await getDb().update(models).set({ enabled }).where(eq(models.id, id));
  return { ok: true };
}

export async function deleteModel(id: number): Promise<ActionResult> {
  if (isDemoMode) {
    const store = getDemoStore();
    store.models = store.models.filter((m) => m.id !== id);
    return { ok: true };
  }
  await getDb().delete(models).where(eq(models.id, id));
  return { ok: true };
}

/** เปิด/ปิดการมองเห็นโมเดลในหน้าผู้ใช้ (visible_to_users) */
export async function setModelVisibility(id: number, visible: boolean): Promise<ActionResult> {
  if (isDemoMode) {
    const m = getDemoStore().models.find((x) => x.id === id);
    if (!m) return { ok: false, error: "ไม่พบโมเดล" };
    m.visibleToUsers = visible;
    return { ok: true };
  }
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
  if (isDemoMode) {
    const m = getDemoStore().models.find((x) => x.id === id);
    if (!m) return { ok: false, error: "ไม่พบโมเดล" };
    m.enabled = opts.enabled;
    m.visibleToUsers = opts.visibleToUsers;
    return { ok: true };
  }
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
  if (isDemoMode) {
    const m = getDemoStore().models.find((x) => x.id === id);
    if (!m) return { ok: false, error: "ไม่พบโมเดล" };
    m.inputPricePerM = inputPricePerM;
    m.outputPricePerM = outputPricePerM;
    return { ok: true };
  }
  await getDb()
    .update(models)
    .set({ inputPricePerM, outputPricePerM })
    .where(eq(models.id, id));
  return { ok: true };
}

// ---------------------------------------------------------------------
// Route CRUD
// ---------------------------------------------------------------------

export async function upsertRoute(input: {
  id?: number;
  publicModel: string;
  description: string;
}): Promise<ActionResult> {
  const publicModel = input.publicModel.trim().toLowerCase().replace(/\s+/g, "-");
  if (!publicModel) return { ok: false, error: "กรอกชื่อโมเดลสาธารณะ" };

  if (isDemoMode) {
    const store = getDemoStore();
    const dup = store.routes.some(
      (r) => r.publicModel === publicModel && r.id !== input.id,
    );
    if (dup) return { ok: false, error: "มีชื่อ route นี้แล้ว" };
    if (input.id) {
      const r = store.routes.find((x) => x.id === input.id);
      if (!r) return { ok: false, error: "ไม่พบ route" };
      r.publicModel = publicModel;
      r.description = input.description.trim();
    } else {
      const id = Math.max(0, ...store.routes.map((r) => r.id)) + 1;
      store.routes.push({
        id,
        publicModel,
        description: input.description.trim(),
        // ค่าเริ่มต้น: ใช้ชื่อจาก publicModel และโหมด router (แสดงเป็นรายการเดียว)
        displayMode: "router",
        displayName: publicModel
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" "),
        logoUrl: null,
        inputPricePerM: 0,
        outputPricePerM: 0,
        enabled: true,
        createdAt: new Date(),
      });
    }
    return { ok: true };
  }

  const db = getDb();
  try {
    if (input.id) {
      await db
        .update(routes)
        .set({ publicModel, description: input.description.trim() })
        .where(eq(routes.id, input.id));
    } else {
      await db.insert(routes).values({
        publicModel,
        description: input.description.trim(),
        displayName: publicModel
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" "),
      });
    }
  } catch {
    return { ok: false, error: "มีชื่อ route นี้แล้ว" };
  }
  return { ok: true };
}

export async function toggleRoute(id: number, enabled: boolean): Promise<ActionResult> {
  if (isDemoMode) {
    const r = getDemoStore().routes.find((x) => x.id === id);
    if (!r) return { ok: false, error: "ไม่พบ route" };
    r.enabled = enabled;
    return { ok: true };
  }
  await getDb().update(routes).set({ enabled }).where(eq(routes.id, id));
  return { ok: true };
}

export async function deleteRoute(id: number): Promise<ActionResult> {
  if (isDemoMode) {
    const store = getDemoStore();
    store.routes = store.routes.filter((r) => r.id !== id);
    store.routeTargets = store.routeTargets.filter((t) => t.routeId !== id);
    return { ok: true };
  }
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

  if (isDemoMode) {
    const store = getDemoStore();
    const existing = store.routeTargets.filter((t) => t.routeId === input.routeId);
    if (existing.some((t) => t.modelRefId === input.modelRefId)) {
      return { ok: false, error: "โมเดลนี้อยู่ใน route แล้ว" };
    }
    const id = Math.max(0, ...store.routeTargets.map((t) => t.id)) + 1;
    store.routeTargets.push({
      id,
      routeId: input.routeId,
      modelRefId: input.modelRefId,
      priority: existing.length + 1,
      enabled: true,
    });
    return { ok: true };
  }

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
  if (isDemoMode) {
    const store = getDemoStore();
    const target = store.routeTargets.find((t) => t.id === targetId);
    if (!target) return { ok: false, error: "ไม่พบ target" };
    const siblings = store.routeTargets
      .filter((t) => t.routeId === target.routeId)
      .sort((a, b) => a.priority - b.priority);
    const idx = siblings.findIndex((t) => t.id === targetId);
    const swapWith = siblings[idx + direction];
    if (!swapWith) return { ok: true };
    const tmp = target.priority;
    target.priority = swapWith.priority;
    swapWith.priority = tmp;
    return { ok: true };
  }

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
  if (isDemoMode) {
    const t = getDemoStore().routeTargets.find((x) => x.id === targetId);
    if (!t) return { ok: false, error: "ไม่พบ target" };
    t.enabled = enabled;
    return { ok: true };
  }
  await getDb().update(routeTargets).set({ enabled }).where(eq(routeTargets.id, targetId));
  return { ok: true };
}

export async function removeRouteTarget(targetId: number): Promise<ActionResult> {
  if (isDemoMode) {
    const store = getDemoStore();
    store.routeTargets = store.routeTargets.filter((t) => t.id !== targetId);
    return { ok: true };
  }
  await getDb().delete(routeTargets).where(eq(routeTargets.id, targetId));
  return { ok: true };
}
