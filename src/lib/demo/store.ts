/**
 * Demo store — ข้อมูลตัวอย่างสำหรับโหมด Demo (ยังไม่ตั้งค่า Supabase)
 * เจตนาคือให้เห็นหน้า UI ครบทุกส่วนได้ทันที เมื่อใส่ env จริงระบบจะใช้ Drizzle + Supabase แทน
 */
import type {
  ApiKey,
  Asset,
  Model,
  Provider,
  ProviderKey,
  RequestRow,
  Route,
  RouteTarget,
} from "@/db/schema";
import { DEFAULT_PLANS, type Plan } from "@/lib/plans";
import { isDemoMode } from "@/lib/config";

export type DemoUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  credits: number;
  plan: string;
  banned: boolean;
  bannedReason: string;
};

export const DEMO_USERS: Record<"user" | "admin", DemoUser> = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "demo.user@octopus.ai",
    name: "Demo User",
    avatarUrl: null,
    role: "user",
    credits: 12.5,
    plan: "free",
    banned: false,
    bannedReason: "",
  },
  admin: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "admin@octopus.ai",
    name: "Octopus Admin",
    avatarUrl: null,
    role: "admin",
    credits: 500,
    plan: "pro",
    banned: false,
    bannedReason: "",
  },
};

/** ผู้ใช้ตัวอย่างเพิ่มเติมสำหรับหน้า admin (แสดงการจัดการ user ได้จริง) */
export const DEMO_EXTRA_USERS: DemoUser[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    email: "somchai@acme.co.th",
    name: "สมชาย วงศ์ไทย",
    avatarUrl: null,
    role: "user",
    credits: 3.42,
    plan: "free",
    banned: false,
    bannedReason: "",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    email: "nadia@northstar.io",
    name: "Nadia Rahman",
    avatarUrl: null,
    role: "user",
    credits: 41.08,
    plan: "pro",
    banned: false,
    bannedReason: "",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    email: "spam.bot@throwaway.dev",
    name: "Throwaway Bot",
    avatarUrl: null,
    role: "user",
    credits: 0,
    plan: "free",
    banned: true,
    bannedReason: "ยิง request ผิดนโยบายการใช้งาน",
  },
];

// ---------- seeded RNG เพื่อให้กราฟคงที่ทุกครั้งที่ render ----------
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODELS = [
  { provider: "OpenAI", model: "gpt-4o-mini", weight: 34, inP: 0.15, outP: 0.6 },
  { provider: "OpenAI", model: "gpt-4o", weight: 18, inP: 2.5, outP: 10 },
  { provider: "Anthropic", model: "claude-3.5-sonnet", weight: 20, inP: 3, outP: 15 },
  { provider: "Google AI", model: "gemini-1.5-pro", weight: 14, inP: 1.25, outP: 5 },
  { provider: "Groq", model: "llama-3.1-70b", weight: 9, inP: 0.59, outP: 0.79 },
  { provider: "Mistral", model: "mistral-large", weight: 5, inP: 2, outP: 6 },
];

/** ราคาต่อ 1M tokens (USD) — ใช้คํานวณค่าใช้จ่ายของ request */
export function demoModelPrice(model: string): { inP: number; outP: number } {
  const m = MODELS.find((x) => x.model === model);
  return { inP: m?.inP ?? 1, outP: m?.outP ?? 3 };
}

export function demoRequestCost(r: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const { inP, outP } = demoModelPrice(r.model);
  return (r.inputTokens / 1_000_000) * inP + (r.outputTokens / 1_000_000) * outP;
}

const AGENTS = ["web-app", "octopus-cli", "mobile-app", "rag-worker", "slack-bot"];
const PUBLIC_MODELS = ["octopus-fast", "octopus-pro", "octopus-chat"];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeighted(
  rng: () => number,
  arr: { model: string; provider: string; weight: number; inP: number; outP: number }[],
) {
  const total = arr.reduce((s, m) => s + m.weight, 0);
  let r = rng() * total;
  for (const m of arr) {
    r -= m.weight;
    if (r <= 0) return m;
  }
  return arr[0];
}

function genIdCounter(start: number) {
  let i = start;
  return () => i++;
}

const rid = genIdCounter(1000);

/**
 * คลังรูปตัวอย่างในโหมด demo — ชี้ไปที่ไฟล์ใน public/ เพื่อให้เห็น UI ได้ทันที
 * (ของจริงจะถูกอัปโหลดขึ้น Supabase Storage แล้วเก็บ URL เต็มใน DB)
 */
const DEMO_ASSETS = [
  { id: 1, name: "Codex", path: "demo/codex.png", url: "/Agent-lg/trimmed/codex.png", size: 12_400 },
  { id: 2, name: "Claude Code", path: "demo/claude-code.png", url: "/Agent-lg/trimmed/claude-code.png", size: 15_800 },
  { id: 3, name: "DeepSeek", path: "demo/deepseek.png", url: "/Agent-lg/trimmed/deepseek.png", size: 9_600 },
  { id: 4, name: "Gemini", path: "demo/gemini.png", url: "/Agent-lg/trimmed/zcode.png", size: 11_200 },
];

/** โมเดลไหนใช้รูปไหนจากคลัง — สาธิตว่าอัปครั้งเดียวแล้วเลือกใช้ซ้ำได้ */
const DEMO_MODEL_LOGOS: Record<string, string> = {
  "gpt-4o-mini": "/Agent-lg/trimmed/codex.png",
  "gpt-4o": "/Agent-lg/trimmed/codex.png",
  "claude-3.5-sonnet": "/Agent-lg/trimmed/claude-code.png",
  "gemini-1.5-pro": "/Agent-lg/trimmed/zcode.png",
};

/**
 * คอลัมน์สถิติวันนี้ของตาราง models — ของจริงถูกเขียนโดย logRequest
 * โหมด demo ไม่มีคอลัมน์เหล่านี้ในฐานข้อมูล จึงใช้ค่าเริ่มต้นคงที่
 */
export const DEMO_MODEL_UPTIME = {
  uptimeDay: null,
  uptime: 100,
  uptimeRequests: 0,
  uptimeOk: 0,
  uptimeLatencyMs: 0,
  uptimeTokens: 0,
};

export type DemoStore = {
  providers: Provider[];
  providerKeys: ProviderKey[];
  assets: Asset[];
  models: Model[];
  routes: Route[];
  routeTargets: RouteTarget[];
  plans: Plan[];
  planModels: { planKey: string; modelRefId: number }[];
  apiKeys: ApiKey[];
  requests: RequestRow[];
  users: DemoUser[];
};

function buildStore(): DemoStore {
  const rng = mulberry32(20261014);

  const providers: Provider[] = [
    { id: 1, name: "OpenAI", baseUrl: "https://api.openai.com/v1", apiKey: "", enabled: true, createdAt: new Date() },
    { id: 2, name: "Anthropic", baseUrl: "https://api.anthropic.com/v1", apiKey: "", enabled: true, createdAt: new Date() },
    { id: 3, name: "Google AI", baseUrl: "https://generativelanguage.googleapis.com/v1beta", apiKey: "", enabled: true, createdAt: new Date() },
    { id: 4, name: "Groq", baseUrl: "https://api.groq.com/openai/v1", apiKey: "", enabled: false, createdAt: new Date() },
    { id: 5, name: "Mistral", baseUrl: "https://api.mistral.ai/v1", apiKey: "", enabled: false, createdAt: new Date() },
  ];

  const now0 = new Date();
  // OpenAI มี 2 คีย์ เพื่อสาธิตการหมุน; Groq มีคีย์ที่ติด cooldown ให้เห็นสถานะใน UI
  const providerKeys: ProviderKey[] = [
    { id: 1, providerId: 1, label: "main", apiKey: "sk-proj-demo-************", enabled: true, isPrimary: true, failureCount: 0, cooldownUntil: null, lastErrorAt: null, lastUsedAt: new Date(now0.getTime() - 60_000), createdAt: new Date() },
    { id: 2, providerId: 1, label: "backup-1", apiKey: "sk-proj-demo-backup-******", enabled: true, isPrimary: false, failureCount: 0, cooldownUntil: null, lastErrorAt: null, lastUsedAt: null, createdAt: new Date() },
    { id: 3, providerId: 2, label: "main", apiKey: "sk-ant-demo-************", enabled: true, isPrimary: true, failureCount: 0, cooldownUntil: null, lastErrorAt: null, lastUsedAt: new Date(now0.getTime() - 120_000), createdAt: new Date() },
    { id: 4, providerId: 3, label: "main", apiKey: "AIza-demo-************", enabled: true, isPrimary: true, failureCount: 0, cooldownUntil: null, lastErrorAt: null, lastUsedAt: new Date(now0.getTime() - 300_000), createdAt: new Date() },
    { id: 5, providerId: 4, label: "main", apiKey: "gsk_demo-************", enabled: true, isPrimary: true, failureCount: 3, cooldownUntil: new Date(now0.getTime() + 600_000), lastErrorAt: new Date(now0.getTime() - 30_000), lastUsedAt: new Date(now0.getTime() - 400_000), createdAt: new Date() },
    { id: 6, providerId: 5, label: "main", apiKey: "mistral-demo-************", enabled: true, isPrimary: true, failureCount: 0, cooldownUntil: null, lastErrorAt: null, lastUsedAt: null, createdAt: new Date() },
  ];

  const models: Model[] = MODELS.map((m, i) => ({
    id: i + 1,
    providerId: providers.find((p) => p.name === m.provider)!.id,
    modelId: m.model,
    displayName: m.model,
    contextWindow: [128000, 128000, 200000, 1000000, 131072, 128000][i] ?? 128000,
    supportsVision: i < 4,
    enabled: m.provider !== "Groq",
    // ซ่อน mistral เป็นตัวอย่างว่า admin คุมการมองเห็นได้
    visibleToUsers: m.model !== "mistral-large",
    inputPricePerM: m.inP,
    outputPricePerM: m.outP,
    // ผูกโลโก้จากคลัง (demo) ให้บางโมเดล เพื่อสาธิตว่าผู้ใช้เห็นรูปแทนชื่อค่าย
    logoUrl: DEMO_MODEL_LOGOS[m.model] ?? null,
    ...DEMO_MODEL_UPTIME,
    createdAt: new Date(),
  }));

  const routes: Route[] = [
    { id: 1, publicModel: "octopus-fast", description: "โมเดลเร็ว ราคาถูก เหมาะกับงานทั่วไป", displayMode: "router", displayName: "Octopus Fast", logoUrl: "/Agent-lg/trimmed/codex.png", inputPricePerM: 0.5, outputPricePerM: 1.5, enabled: true, createdAt: new Date() },
    { id: 2, publicModel: "octopus-pro", description: "โมเดลฉลาดพิเศษ สําหรับงานซับซ้อน", displayMode: "model", displayName: "Octopus Pro", logoUrl: "/Agent-lg/trimmed/claude-code.png", inputPricePerM: 3, outputPricePerM: 15, enabled: true, createdAt: new Date() },
    { id: 3, publicModel: "octopus-chat", description: "สนทนาทั่วไป ประหยัดสูงสุด", displayMode: "router", displayName: "Octopus Chat", logoUrl: null, inputPricePerM: 0.2, outputPricePerM: 0.6, enabled: false, createdAt: new Date() },
  ];

  const byModel = (name: string) => models.find((m) => m.modelId === name)!.id;
  const routeTargets: RouteTarget[] = [
    { id: 1, routeId: 1, modelRefId: byModel("gpt-4o-mini"), priority: 1, enabled: true },
    { id: 2, routeId: 1, modelRefId: byModel("llama-3.1-70b"), priority: 2, enabled: true },
    { id: 3, routeId: 2, modelRefId: byModel("claude-3.5-sonnet"), priority: 1, enabled: true },
    { id: 4, routeId: 2, modelRefId: byModel("gpt-4o"), priority: 2, enabled: true },
    { id: 5, routeId: 2, modelRefId: byModel("gemini-1.5-pro"), priority: 3, enabled: true },
    { id: 6, routeId: 3, modelRefId: byModel("mistral-large"), priority: 1, enabled: true },
  ];

// สร้าง requests ให้ผู้ใช้ทุกคน (2 หลัก + 3 ตัวอย่าง) — คนละ seed เพื่อให้ pattern ต่างกัน
  const allUsers = [DEMO_USERS.user, DEMO_USERS.admin, ...DEMO_EXTRA_USERS];
  const requests: RequestRow[] = [];
  const now = Date.now();

  for (const [userIdx, u] of allUsers.entries()) {
    const userRng = mulberry32(777 + userIdx * 13);
    // ผู้ใช้ที่ถูกแบน / เครดิต 0 → แทบไม่มี request
    const count = u.banned ? 3 : u.role === "admin" ? 640 : 180 + userIdx * 90;
    for (let i = 0; i < count; i++) {
      // กระจายแบบ bias มาทางช่วงล่าสุด ให้กราฟเห็นแนวโน้มเติบโต
      const daysAgoRaw = Math.pow(userRng(), 1.6) * 35;
      const daysAgo = Math.floor(daysAgoRaw);
      const hour = Math.floor(userRng() * 24);
      const created = new Date(now - daysAgo * 86400_000);
      created.setHours(hour, Math.floor(userRng() * 60), Math.floor(userRng() * 60), 0);

      const m = pickWeighted(userRng, MODELS);
      const roll = userRng();
      const status = roll > 0.94 ? "error" : roll > 0.88 ? "rate_limited" : "success";
      const httpStatus = status === "success" ? 200 : status === "rate_limited" ? 429 : 500;
      const inTok = Math.floor(200 + userRng() * 3800);
      const outTok = status === "success" ? Math.floor(80 + userRng() * 1600) : 0;
      const latency =
        status === "success"
          ? Math.floor(300 + userRng() * 2700)
          : Math.floor(400 + userRng() * 4000);

      requests.push({
        id: rid(),
        userId: u.id,
        apiKeyId: u.id === DEMO_USERS.user.id ? (userRng() > 0.5 ? 1 : 2) : null,
        providerName: m.provider,
        model: m.model,
        publicModel: pick(userRng, PUBLIC_MODELS),
        agent: pick(userRng, AGENTS),
        status,
        httpStatus,
        inputTokens: inTok,
        outputTokens: outTok,
        latencyMs: latency,
        costUsd: demoRequestCost({ model: m.model, inputTokens: inTok, outputTokens: outTok }),
        error:
          status === "error"
            ? "upstream provider timeout after 30s"
            : status === "rate_limited"
              ? "429 Too Many Requests — cooldown 60s"
              : null,
        createdAt: created,
      });
    }
  }

  requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const apiKeys: ApiKey[] = [
    { id: 1, userId: DEMO_USERS.user.id, name: "Development", keyPrefix: "sk-oct-9fK2", secret: "sk-oct-9fK2xW4nQ7mBvT8zP1sD3hJ5lR6yU", revoked: false, lastUsedAt: new Date(now - 3600_000 * 2), createdAt: new Date(now - 86400_000 * 20) },
    { id: 2, userId: DEMO_USERS.user.id, name: "Production", keyPrefix: "sk-oct-Xr7p", secret: "sk-oct-Xr7pQ2mN8vLk4jH6gF3dS1aZ5xC9", revoked: false, lastUsedAt: new Date(now - 3600_000 * 6), createdAt: new Date(now - 86400_000 * 9) },
    { id: 3, userId: DEMO_USERS.admin.id, name: "Admin CLI", keyPrefix: "sk-oct-Adm1", secret: "sk-oct-Adm1nStr8X6vP4kM2bV9cQ7wE3", revoked: false, lastUsedAt: new Date(now - 3600_000 * 30), createdAt: new Date(now - 86400_000 * 30) },
  ];

  // คลังรูปตัวอย่าง — ให้เห็น UI เลือกใช้ซ้ำได้ทันทีในโหมด demo
  const assets: Asset[] = DEMO_ASSETS.map((a) => ({
    id: a.id,
    name: a.name,
    storagePath: a.path,
    publicUrl: a.url,
    mimeType: "image/png",
    sizeBytes: a.size,
    createdAt: new Date(),
  }));

  return {
    providers,
    providerKeys,
    assets,
    models,
    routes,
    routeTargets,
    plans: demoPlans(),
    planModels: demoPlanModels(),
    apiKeys,
    requests,
    users: allUsers,
  };
}

/** ชุดโมเดลต่อแผนตัวอย่าง — ฟรีได้บางส่วน ที่เหลือต้อง Pro */
function demoPlanModels(): { planKey: string; modelRefId: number }[] {
  const free = [1, 4, 6];
  const pro = [1, 2, 3, 4, 5, 6, 7];
  return [
    ...free.map((modelRefId) => ({ planKey: "free", modelRefId })),
    ...pro.map((modelRefId) => ({ planKey: "pro", modelRefId })),
  ];
}

/** แผนการใช้งานเริ่มต้น (คัดลอกค่า เพื่อให้ mutation ในโหมด demo ไม่ทับค่าต้นฉบับ) */
function demoPlans(): Plan[] {
  return Object.values(DEFAULT_PLANS).map((p) => ({ ...p }));
}

// เก็บไว้ใน globalThis เพื่อให้ mutation (เช่นสร้าง key) อยู่รอดข้าม request ใน dev server
const g = globalThis as unknown as { __octopusDemoStore?: DemoStore };

export function getDemoStore(): DemoStore {
  if (!g.__octopusDemoStore) {
    g.__octopusDemoStore = buildStore();
  }
  return g.__octopusDemoStore;
}

/** ชุดว่างที่ใช้เฉพาะตอน DB ใช้ไม่ได้ชั่วคราว — สร้างใหม่ทุกครั้งไม่ให้ ai แก้ค่าค้างไว้ */
function emptyStore(): DemoStore {
  return {
    providers: [],
    providerKeys: [],
    assets: [],
    models: [],
    routes: [],
    routeTargets: [],
    plans: demoPlans(),
    planModels: [],
    apiKeys: [],
    requests: [],
    users: [],
  };
}

/**
 * แหล่งข้อมูลที่ data layer ใช้เมื่อไม่อ่านฐานข้อมูลจริง
 *
 * - โหมด Demo (ยังไม่ได้ตั้ง env) → ข้อมูลตัวอย่าง เพื่อให้ดูหน้าเว็บได้ทันที
 * - DB ใช้ไม่ได้ชั่วคราว (circuit breaker) → ชุดว่าง
 *   เดิมกรณีหลังคืนข้อมูลตัวอย่างปนกับบัญชีจริง ทำให้เห็น "โมเดลปลอม"
 *   เช่น Octopus Fast/Octopus Pro ทั้งที่ข้อมูลจริงอยู่ใน Supabase
 */
export function demoSource(): DemoStore {
  return isDemoMode ? getDemoStore() : emptyStore();
}
