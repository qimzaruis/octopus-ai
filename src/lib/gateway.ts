/**
 * Gateway — ทางเข้าเรียกโมเดลจริงของทั้งแอป (Web Agent และ API สาธารณะ /v1)
 *
 * ผู้ใช้เรียกด้วย "route" (เช่น octopus-free) แล้วระบบไล่โมเดลปลายทางตาม priority
 * ของ route นั้น จนกว่าจะมีค่ายไหนตอบกลับมา (fallback อัตโนมัติ)
 *
 * การหมุน API key ของแต่ละค่ายใช้ pickKey() ใน lib/rotation (primary → ใช้นานสุดแล้ว
 * → fail น้อยสุด) และบันทึกผลสำเร็จ/ล้มเหลวผ่าน recordKeyResult() เพื่อให้คีย์ที่
 * พังบ่อยถูกพัก (cooldown) เอง ส่วนทุก request ที่ผ่านจะถูกเขียนลงตาราง requests
 * เพื่อให้หน้า dashboard / requests เห็นตัวเลขจริง
 */

import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  models,
  providerKeys,
  providers,
  requests,
  routeTargets,
  routes,
} from "@/db/schema";
import { isDemoMode } from "@/lib/config";
import { isDbUnavailable } from "@/lib/db-circuit";
import { cached, invalidateCache } from "@/lib/catalog-cache";
import { getDemoStore } from "@/lib/demo/store";
import { pickKey, type RotatableKey } from "@/lib/rotation";
import { recordKeyResult } from "@/lib/data/admin";

/** การเรียกเครื่องมือที่โมเดลขอ (OpenAI function calling) */
export type UpstreamToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** ข้อความรูปแบบ OpenAI ที่ส่งต่อไปยังค่ายต้นทาง */
export type UpstreamMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
  /** ฝ่าย assistant: รายการเครื่องมือที่โมเดลขอเรียก */
  tool_calls?: UpstreamToolCall[];
  /** ฝ่าย tool: id ของ call ที่ข้อความนี้ตอบกลับ */
  tool_call_id?: string;
  /** ฝ่าย tool: ชื่อเครื่องมือ (บางค่ายขอให้ส่งไปด้วย) */
  name?: string;
};

/** ปลายทาง 1 ตัวของ route = โมเดลของค่ายที่เรียกได้จริง */
export type GatewayTarget = {
  modelRefId: number;
  /** id ที่ต้องส่งให้ค่ายต้นทาง */
  modelId: string;
  providerId: number;
  providerName: string;
  baseUrl: string;
  inputPricePerM: number;
  outputPricePerM: number;
  supportsVision: boolean;
  contextWindow: number;
};

export type GatewayUsage = { inputTokens: number; outputTokens: number };

export type GatewayErrorCode =
  | "no_route"
  | "no_target"
  | "no_provider_key"
  | "upstream_error";

/** ข้อผิดพลาดที่แปลงเป็น status code ตอบลูกค้าได้ทันที */
export class GatewayError extends Error {
  constructor(
    public code: GatewayErrorCode,
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

// ---------------------------------------------------------------------------
// resolve route → ปลายทาง
// ---------------------------------------------------------------------------

/** อายุแคชของรายการปลายทาง (route → model) — ล้างทันทีที่แอดมินบันทึกการตั้งค่า */
const CATALOG_TTL_MS = 60_000;

/**
 * เรียงตาม priority แล้ว (หลักก่อน) — ตัวที่ถูกปิดใช้จะถูกกรองออก
 *
 * ผลลัพธ์ถูกแคชไว้สั้น ๆ เพราะทุก request ต้องอ่านชุด query เดียวกันนี้
 * และแอดมินเป็นคนแก้ตารางนี้เท่านั้น (ล้างแคชให้ตอนบันทึก)
 */
export function resolveTargets(publicModel: string): Promise<GatewayTarget[]> {
  const name = publicModel.trim();
  if (!name) return Promise.resolve([]);
  // ตอน DB ถูกข้าม อย่าแคชผลว่างไว้ ไม่งั้น route จะหายไปจนครบอายุแคชทั้งที่ DB ฟื้นแล้ว
  if (isDemoMode || isDbUnavailable()) return loadTargets(name);
  return cached(`targets:${name}`, CATALOG_TTL_MS, () => loadTargets(name));
}

async function loadTargets(publicModel: string): Promise<GatewayTarget[]> {
  const name = publicModel.trim();
  if (!name) return [];

  if (isDemoMode) {
    const store = getDemoStore();
    const route = store.routes.find((r) => r.publicModel === name && r.enabled);
    if (!route) return [];
    return store.routeTargets
      .filter((t) => t.routeId === route.id && t.enabled)
      .sort((a, b) => a.priority - b.priority)
      .flatMap((t) => {
        const m = store.models.find((x) => x.id === t.modelRefId && x.enabled);
        const p = store.providers.find((x) => x.id === m?.providerId && x.enabled);
        if (!m || !p) return [];
        return [
          {
            modelRefId: m.id,
            modelId: m.modelId,
            providerId: p.id,
            providerName: p.name,
            baseUrl: p.baseUrl,
            inputPricePerM: Number(m.inputPricePerM),
            outputPricePerM: Number(m.outputPricePerM),
            supportsVision: m.supportsVision,
            contextWindow: m.contextWindow,
          },
        ];
      });
  }

  const db = getDb();
  const [routeRows, targetRows, modelRows, providerRows] = await Promise.all([
    db.select().from(routes).where(eq(routes.enabled, true)),
    db.select().from(routeTargets).orderBy(asc(routeTargets.priority)),
    db.select().from(models),
    db.select().from(providers),
  ]);
  const route = routeRows.find((r) => r.publicModel === name);
  if (!route) return [];

  return targetRows
    .filter((t) => t.routeId === route.id && t.enabled)
    .sort((a, b) => a.priority - b.priority)
    .flatMap((t) => {
      const m = modelRows.find((x) => x.id === t.modelRefId && x.enabled);
      const p = providerRows.find((x) => x.id === m?.providerId && x.enabled);
      if (!m || !p) return [];
      return [
        {
          modelRefId: m.id,
          modelId: m.modelId,
          providerId: p.id,
          providerName: p.name,
          baseUrl: p.baseUrl,
          inputPricePerM: Number(m.inputPricePerM),
          outputPricePerM: Number(m.outputPricePerM),
          supportsVision: m.supportsVision,
          contextWindow: m.contextWindow,
        },
      ];
    });
}

type UsableKey = RotatableKey & { apiKey: string };

/**
 * บัญชีคีย์ของค่ายหนึ่ง — แคชไว้เพราะอ่านทีละ query (~350ms) ทุกครั้งที่เรียกโมเดล
 * เอเจนต์หนึ่งคำตอบอาจเรียกซ้ำหลายรอบ และถ้าคีย์ไหนพังเราจะล้างแคชนี้ทันที
 * จึงไม่มีทางเลือกคีย์ที่เพิ่งล้มกลับมาใช้ซ้ำจากข้อมูลเก่า
 */
const KEYS_TTL_MS = 30_000;

function keysOf(providerId: number): Promise<UsableKey[]> {
  if (isDemoMode) return loadKeys(providerId);
  return cached(`keys:${providerId}`, KEYS_TTL_MS, () => loadKeys(providerId));
}

async function loadKeys(providerId: number): Promise<UsableKey[]> {
  if (isDemoMode) {
    return getDemoStore()
      .providerKeys.filter((k) => k.providerId === providerId)
      .map((k) => ({
        id: k.id,
        enabled: k.enabled,
        isPrimary: k.isPrimary,
        failureCount: k.failureCount,
        cooldownUntil: k.cooldownUntil,
        lastUsedAt: k.lastUsedAt,
        apiKey: k.apiKey,
      }));
  }
  const rows = await getDb()
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.providerId, providerId));
  return rows.map((k) => ({
    id: k.id,
    enabled: k.enabled,
    isPrimary: k.isPrimary,
    failureCount: k.failureCount,
    cooldownUntil: k.cooldownUntil,
    lastUsedAt: k.lastUsedAt,
    apiKey: k.apiKey,
  }));
}

// ---------------------------------------------------------------------------
// เรียกต้นทาง
// ---------------------------------------------------------------------------

export type InvokeInput = {
  /** ชื่อ route ที่ผู้ใช้เรียก เช่น octopus-free */
  publicModel: string;
  messages: UpstreamMessage[];
  stream: boolean;
  temperature?: number;
  maxTokens?: number;
  /** รายการเครื่องมือ (OpenAI tools schema) — ฝั่ง client เป็นผู้รันแล้วส่งผลกลับ */
  tools?: unknown[];
  /** จำกัดเฉพาะปลายทางที่ผู้ใช้มีสิทธิ์ใช้ (เช่น โมเดลที่รับรูปได้) */
  filter?: (t: GatewayTarget) => boolean;
};

export type InvokeResult = {
  /** stream ดิบจากค่ายต้นทาง (SSE เมื่อ stream=true) */
  body: ReadableStream<Uint8Array>;
  target: GatewayTarget;
  httpStatus: number;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path}`;
}

/**
 * ไล่ยิงปลายทางตาม priority
 *
 * คีย์ไหนล้มจะถูกบันทึกเพื่อให้ rotation พักคีย์นั้น แล้วลองคีย์/ค่ายถัดไป
 * ถ้าหมดทุกทางแล้วจึงโยน GatewayError ให้ caller แปลงเป็น response
 */
export async function invokeUpstream(input: InvokeInput): Promise<InvokeResult> {
  const all = await resolveTargets(input.publicModel);
  const targets = input.filter ? all.filter(input.filter) : all;
  if (all.length === 0) {
    throw new GatewayError("no_route", `ไม่พบโมเดล "${input.publicModel}"`, 404);
  }
  if (targets.length === 0) {
    throw new GatewayError("no_target", "บัญชีของคุณไม่มีสิทธิ์ใช้โมเดลนี้", 403);
  }

  let lastError = "";
  let attempted = false;
  for (const target of targets) {
    const keys = await keysOf(target.providerId);
    const usable = keys.filter((k) => k.enabled && k.apiKey.trim());
    if (usable.length === 0) {
      lastError = `${target.providerName}: ยังไม่ได้ตั้งค่า API key`;
      continue;
    }

    const payload: Record<string, unknown> = {
      model: target.modelId,
      messages: input.messages,
      stream: input.stream,
    };
    if (input.temperature !== undefined) payload.temperature = input.temperature;
    if (input.maxTokens !== undefined) payload.max_tokens = input.maxTokens;
    if (input.tools?.length) payload.tools = input.tools;
    if (input.stream) payload.stream_options = { include_usage: true };

    const picked = pickKey(usable);
    if (!picked) {
      lastError = `${target.providerName}: คีย์ทุกตัวกำลังถูกพัก (cooldown)`;
      continue;
    }

    attempted = true;

    let res: Response;
    try {
      res = await fetch(joinUrl(target.baseUrl, "chat/completions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${picked.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      lastError = `${target.providerName}: ${(err as Error).message}`;
      await markKey(picked.id, false);
      invalidateCache("keys:"); // ห้ามเลือกคีย์ที่เพิ่งพังกลับมาใช้ซ้ำจากแคชเก่า
      continue;
    }

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      lastError = `${target.providerName} ตอบกลับ ${res.status}: ${detail.slice(0, 300)}`;
      await markKey(picked.id, res.status !== 400 && res.status !== 404);
      invalidateCache("keys:");
      continue;
    }

    // จดว่าคีย์นี้สำเร็จแบบไม่รอ — ถ้า await จะเพิ่ม ~350ms ให้ผู้ใช้ต้องรอฟรี ๆ
    // หลังค่ายต้นทางตอบมาแล้ว (ผลข้างเคียงมีแค่สถิติ "ใช้นานสุดแล้ว" ที่คลาดเคลื่อนไม่กี่ร้อย ms)
    void markKey(picked.id, true);
    return { body: res.body, target, httpStatus: res.status };
  }

  throw new GatewayError(
    attempted ? "upstream_error" : "no_provider_key",
    lastError || "ทุกค่ายต้นทางล้มเหลว",
    attempted ? 502 : 503,
  );
}

/** คีย์ล้มบ่อยถูกพักอัตโนมัติ — ในโหมด demo ใช้ store ใน memory */
async function markKey(keyId: number, ok: boolean): Promise<void> {
  try {
    await recordKeyResult(keyId, ok);
  } catch (err) {
    console.error("[gateway] บันทึกสถานะคีย์ไม่สำเร็จ:", err);
  }
}

/**
 * ข้อความที่ปลอดภัยสําหรับแสดงให้ผู้ใช้เห็น
 *
 * รายละเอียดดิบของ GatewayError มีชื่อค่ายต้นทางปนอยู่ ซึ่งเราตั้งใจไม่เปิดเผย
 * จึงคงไว้แต่สถานะกว้าง ๆ ส่วนรายละเอียดเต็มอยู่ใน log ฝั่งเซิร์ฟเวอร์กับตาราง requests
 */
export function userSafeMessage(err: unknown): string {
  const code = err instanceof GatewayError ? err.code : null;
  switch (code) {
    case "no_route":
      return "ไม่พบโมเดลที่เลือกในรายการที่เปิดใช้";
    case "no_target":
      return "บัญชีของคุณใช้โมเดลนี้ไม่ได้";
    case "no_provider_key":
      return "ยังไม่ได้ตั้งค่าการเชื่อมต่อโมเดลนี้ กรุณาแจ้งผู้ดูแลระบบ";
    case "upstream_error":
      return "โมเดลต้นทางตอบกลับผิดพลาด กรุณาลองใหม่";
    default:
      return "เกิดข้อผิดพลาดขณะเรียกโมเดล กรุณาลองใหม่";
  }
}

// ---------------------------------------------------------------------------
// คํานวณ token / ค่าใช้จ่าย และเขียน log
// ---------------------------------------------------------------------------

/** ประมาณ token จากจำนวนอักขระ เมื่อค่ายต้นทางไม่ส่ง usage มา */
export function estimateTokensFromChars(chars: number): number {
  if (chars <= 0) return 0;
  return Math.max(1, Math.round(chars / 3.5));
}

export function estimateTokens(text: string): number {
  return estimateTokensFromChars(text.length);
}

/**
 * target ปลอมไว้ log request ที่ล้มก่อนถึงค่ายต้นทาง (ยังไม่รู้ว่าจะไปลงค่ายไหน)
 * ไม่มีชื่อยี่ห้อปลายทางปนอยู่ ผู้ใช้จึงไม่เห็นข้อมูลภายใน
 */
export function failedTarget(publicModel: string): GatewayTarget {
  return {
    modelRefId: 0,
    modelId: publicModel,
    providerId: 0,
    providerName: "",
    baseUrl: "",
    inputPricePerM: 0,
    outputPricePerM: 0,
    supportsVision: false,
    contextWindow: 0,
  };
}

export function costOf(target: GatewayTarget, usage: GatewayUsage): number {
  return (
    (usage.inputTokens / 1_000_000) * target.inputPricePerM +
    (usage.outputTokens / 1_000_000) * target.outputPricePerM
  );
}

export type LogInput = {
  userId: string;
  apiKeyId?: number | null;
  target: GatewayTarget;
  publicModel: string;
  agent: string;
  status: "success" | "error" | "rate_limited";
  httpStatus: number;
  usage: GatewayUsage;
  latencyMs: number;
  error?: string | null;
};

/**
 * คอลัมน์สถิติวันนี้ของตาราง models — หน้ารายละเอียดโมเดลอ่านค่าตรง ๆ ไม่ต้อง scan requests
 *
 * ปกติสร้างโดย migration (supabase/migrations/0004_model_uptime.sql) แต่รัน add column
 * if not exists เผื่อไว้สำหรับ DB ที่ยังไม่ถูก migration ไม่งั้น query ที่แตะตาราง models พังหมด
 */
let uptimeColsReady: Promise<void> | null = null;

export function ensureUptimeColumns(): Promise<void> {
  if (!uptimeColsReady) {
    uptimeColsReady = (async () => {
      // เช็คก่อนว่า DB มีคอลัมน์แล้วหรือไม่ จะได้ไม่ต้องรัน DDL ซ้ำทุกครั้งที่ process เริ่ม
      const found = await getDb().execute(sql.raw(
        `select 1 from information_schema.columns
          where table_name = 'models' and column_name = 'uptime_requests' limit 1`,
      ));
      if ((found as unknown[]).length > 0) return;
      await getDb().execute(sql.raw(`alter table models
         add column if not exists uptime_day date,
         add column if not exists uptime numeric(5,2) not null default 100,
         add column if not exists uptime_requests integer not null default 0,
         add column if not exists uptime_ok integer not null default 0,
         add column if not exists uptime_latency_ms integer not null default 0,
         add column if not exists uptime_tokens bigint not null default 0`));
    })()
      .then(() => undefined)
      .catch((err) => {
        // DB ไม่มีสิทธิ์ทำ DDL — ค้างสถานะไว้รอบเดียว แล้วปล่อยให้ตาราง requests เป็นแหล่งความจริง
        uptimeColsReady = Promise.resolve();
        console.error("[gateway] สร้างคอลัมน์ uptime ไม่สำเร็จ:", err);
      });
  }
  return uptimeColsReady;
}

/** วันนี้ (YYYY-MM-DD) ตามเวลากรุงเทพฯ — ไทยไม่มีการเปลี่ยน DST จึงบวก 7 ชม. ตรง ๆ ได้ */
export function bangkokDay(now = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** +1 ให้คอลัมน์สถิติของโมเดลที่ถูกเรียกจริง — ถ้าวันเปลี่ยนจะเริ่มนับใหม่เอง */
async function bumpModelUptime(input: LogInput): Promise<void> {
  try {
    await ensureUptimeColumns();
    const day = bangkokDay();
    const ok = input.status === "success" ? 1 : 0;
    const latency = Math.max(0, Math.round(input.latencyMs));
    const tokens = Math.max(0, input.usage.inputTokens + input.usage.outputTokens);
    // ทุกนิพจน์ฝั่งขวาใช้ค่าเดิมของแถวก่อน update ทั้ง statement จึงatomic ไม่ต้องอ่าน-เขียนซ้ำ
    await getDb().execute(sql`
      update models set
        uptime_day = ${day},
        uptime_requests = case when uptime_day = ${day} then uptime_requests + 1 else 1 end,
        uptime_ok = case when uptime_day = ${day} then uptime_ok + ${ok} else ${ok} end,
        uptime_latency_ms = case when uptime_day = ${day} then uptime_latency_ms + ${latency} else ${latency} end,
        uptime_tokens = case when uptime_day = ${day} then uptime_tokens + ${tokens} else ${tokens} end,
        uptime = round(
          (case when uptime_day = ${day} then uptime_ok + ${ok} else ${ok} end)::numeric
          / (case when uptime_day = ${day} then uptime_requests + 1 else 1 end)
          * 100, 2)
      where id = ${input.target.modelRefId}
    `);
  } catch (err) {
    console.error("[gateway] อัปเดตคอลัมน์ uptime ไม่สำเร็จ:", err);
  }
}

/** เขียน request ลงฐานข้อมูล — ล้มเหลวได้แต่ห้ามทำให้ request ของลูกค้าพังตาม */
export async function logRequest(input: LogInput): Promise<void> {
  const costUsd = costOf(input.target, input.usage);
  const row = {
    userId: input.userId,
    apiKeyId: input.apiKeyId ?? null,
    providerName: input.target.providerName,
    model: input.target.modelId,
    publicModel: input.publicModel,
    agent: input.agent,
    status: input.status,
    httpStatus: input.httpStatus,
    inputTokens: input.usage.inputTokens,
    outputTokens: input.usage.outputTokens,
    latencyMs: input.latencyMs,
    costUsd,
    error: input.error ?? null,
    createdAt: new Date(),
  };

  try {
    if (isDemoMode) {
      const store = getDemoStore();
      const id = Math.max(0, ...store.requests.map((r) => r.id)) + 1;
      store.requests.unshift({ ...row, id } as (typeof store.requests)[number]);
      return;
    }
    await getDb().insert(requests).values(row);
    await bumpModelUptime(input);
  } catch (err) {
    console.error("[gateway] เขียน log request ไม่สำเร็จ:", err);
  }
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

/**
 * ดึงข้อมูลจาก SSE ของค่ายต้นทาง: ข้อความที่สะสม + usage (ถ้ามี)
 *
 * ใช้ร่วมกันทั้งฝั่ง API (passthrough) และ Web Agent (แปลงเป็นข้อความล้วน)
 */
export type SseAccumulator = {
  /** เติม chunk เข้าไป แล้วคืนค่าที่เป็น delta ข้อความของ chunk นั้น (สำหรับโหมดข้อความล้วน) */
  push(chunk: string): string;
  usage(): GatewayUsage;
  text(): string;
  /** เครื่องมือที่โมเดลขอ (รวม fragment ที่ไหลมาเป็นชิ้น ๆ แล้ว) — ว่างถ้าโมเดลตอบเป็นข้อความ */
  toolCalls(): UpstreamToolCall[];
  /** เหตุผลที่ต้นทางหยุด: stop | tool_calls | length (length = ถูกตัดเพราะครบ token) */
  finishReason(): string;
};

/** ชิ้นส่วน tool_call ที่ไหลมาคนละ chunk ต้องรวมตาม index ก่อนจึงใช้ได้ */
type ToolCallSlot = { id: string; name: string; args: string };

export function createSseAccumulator(estimatePrompt: () => number): SseAccumulator {
  let buffer = "";
  let acc = "";
  let finish = "";
  let usage: GatewayUsage | null = null;
  const slots = new Map<number, ToolCallSlot>();

  function collectToolCalls(raw: unknown) {
    if (!Array.isArray(raw)) return;
    raw.forEach((fragment, position) => {
      if (!fragment || typeof fragment !== "object") return;
      const f = fragment as {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      };
      const index = typeof f.index === "number" ? f.index : position;
      const slot = slots.get(index) ?? { id: "", name: "", args: "" };
      if (f.id) slot.id = f.id;
      if (f.function?.name) slot.name = f.function.name;
      if (f.function?.arguments) slot.args += f.function.arguments;
      slots.set(index, slot);
    });
  }

  function handleData(data: string): string {
    let delta = "";
    try {
      const json = JSON.parse(data) as {
        choices?: {
          delta?: { content?: string; tool_calls?: unknown[] };
          message?: { content?: string; tool_calls?: unknown[] };
          finish_reason?: string | null;
        }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = json.choices?.[0];
      if (choice?.finish_reason) finish = choice.finish_reason;
      delta = choice?.delta?.content ?? "";
      if (!delta) delta = choice?.message?.content ?? "";
      collectToolCalls(choice?.delta?.tool_calls ?? choice?.message?.tool_calls);
      if (json.usage) {
        usage = {
          inputTokens: Number(json.usage.prompt_tokens ?? 0),
          outputTokens: Number(json.usage.completion_tokens ?? 0),
        };
      }
    } catch {
      /* chunk ไม่สมบูรณ์ — ข้ามได้ */
    }
    acc += delta;
    return delta;
  }

  return {
    push(chunk: string): string {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      let out = "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        out += handleData(data);
      }
      return out;
    },
    usage() {
      const u = usage;
      if (u && (u.inputTokens || u.outputTokens)) return u;
      return { inputTokens: estimatePrompt(), outputTokens: estimateTokens(acc) };
    },
    text() {
      return acc;
    },
    finishReason() {
      return finish;
    },
    toolCalls() {
      return [...slots.entries()]
        .sort((a, b) => a[0] - b[0])
        .filter(([, s]) => s.name)
        .map(([i, s]) => ({
          id: s.id || `call_${i + 1}`,
          type: "function" as const,
          function: { name: s.name, arguments: s.args.trim() || "{}" },
        }));
    },
  };
}
