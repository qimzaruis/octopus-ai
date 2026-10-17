/**
 * Seed ข้อมูลเริ่มต้นลง Supabase Postgres ผ่าน Drizzle
 *
 *   npm run db:seed
 *
 * ทำสิ่งต่อไปนี้ (ข้ามถ้ามีข้อมูลอยู่แล้ว):
 *  - สร้าง providers + models ตัวอย่าง
 *  - สร้าง routes (octopus-fast / octopus-pro) พร้อม targets
 *  - ถ้าตั้ง SEED_DEMO_REQUESTS=1 จะสร้าง user ตัวอย่าง + requests ย้อนหลัง 30 วัน
 *    เพื่อให้ dashboard/กราฟมีข้อมูลให้ดูทันที
 */
import "../lib/dotenv";
import { sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  apiKeys,
  models,
  providerKeys,
  providers,
  requests,
  routeTargets,
  routes,
  users,
} from "./schema";

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

const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";

/** ราคาต่อ 1M tokens (USD) สําหรับ seed */
const PRICE: Record<string, { inP: number; outP: number }> = {
  "gpt-4o-mini": { inP: 0.15, outP: 0.6 },
  "gpt-4o": { inP: 2.5, outP: 10 },
  "claude-3.5-sonnet": { inP: 3, outP: 15 },
  "claude-3-haiku": { inP: 0.25, outP: 1.25 },
  "gemini-1.5-pro": { inP: 1.25, outP: 5 },
  "gemini-1.5-flash": { inP: 0.075, outP: 0.3 },
  "llama-3.1-70b": { inP: 0.59, outP: 0.79 },
};

function costOf(model: string, inTok: number, outTok: number): number {
  const p = PRICE[model] ?? { inP: 1, outP: 3 };
  return (inTok / 1_000_000) * p.inP + (outTok / 1_000_000) * p.outP;
}

async function main() {
  const db = getDb();

  // ---------- providers ----------
  const existingProviders = await db.select().from(providers);
  let providerRows = existingProviders;

  if (existingProviders.length === 0) {
    providerRows = await db
      .insert(providers)
      .values([
        { name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
        { name: "Anthropic", baseUrl: "https://api.anthropic.com/v1" },
        { name: "Google AI", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
        { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", enabled: false },
        { name: "Mistral", baseUrl: "https://api.mistral.ai/v1", enabled: false },
      ])
      .returning();
    console.log(`✔ สร้าง providers ${providerRows.length} รายการ`);
  }

  const pid = (name: string) => providerRows.find((p) => p.name === name)!.id;

  // ---------- provider keys (หลายคีย์ต่อ provider) ----------
  const existingKeys = await db.select().from(providerKeys);
  if (existingKeys.length === 0) {
    // OpenAI ได้ 2 คีย์ เพื่อสาธิตการหมุนเมื่อคีย์หลักล้มเหลว
    await db.insert(providerKeys).values([
      { providerId: pid("OpenAI"), label: "main", apiKey: "sk-proj-REPLACE_ME", isPrimary: true },
      { providerId: pid("OpenAI"), label: "backup-1", apiKey: "sk-proj-REPLACE_ME_BACKUP" },
      { providerId: pid("Anthropic"), label: "main", apiKey: "sk-ant-REPLACE_ME", isPrimary: true },
      { providerId: pid("Google AI"), label: "main", apiKey: "AIza-REPLACE_ME", isPrimary: true },
      { providerId: pid("Groq"), label: "main", apiKey: "gsk_REPLACE_ME", isPrimary: true },
      { providerId: pid("Mistral"), label: "main", apiKey: "mistral-REPLACE_ME", isPrimary: true },
    ]);
    console.log("✔ สร้าง provider keys (OpenAI มี 2 คีย์ไว้สาธิตการหมุน)");
  }

  // ---------- models ----------
  const existingModels = await db.select().from(models);
  if (existingModels.length === 0) {
    await db.insert(models).values([
      { providerId: pid("OpenAI"), modelId: "gpt-4o-mini", displayName: "GPT-4o mini", contextWindow: 128000, supportsVision: true, inputPricePerM: 0.15, outputPricePerM: 0.6 },
      { providerId: pid("OpenAI"), modelId: "gpt-4o", displayName: "GPT-4o", contextWindow: 128000, supportsVision: true, inputPricePerM: 2.5, outputPricePerM: 10 },
      { providerId: pid("Anthropic"), modelId: "claude-3.5-sonnet", displayName: "Claude 3.5 Sonnet", contextWindow: 200000, supportsVision: true, inputPricePerM: 3, outputPricePerM: 15 },
      { providerId: pid("Anthropic"), modelId: "claude-3-haiku", displayName: "Claude 3 Haiku", contextWindow: 200000, inputPricePerM: 0.25, outputPricePerM: 1.25 },
      { providerId: pid("Google AI"), modelId: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro", contextWindow: 1000000, supportsVision: true, inputPricePerM: 1.25, outputPricePerM: 5 },
      { providerId: pid("Google AI"), modelId: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash", contextWindow: 1000000, supportsVision: true, inputPricePerM: 0.075, outputPricePerM: 0.3 },
      { providerId: pid("Groq"), modelId: "llama-3.1-70b", displayName: "Llama 3.1 70B", contextWindow: 131072, enabled: false, inputPricePerM: 0.59, outputPricePerM: 0.79 },
    ]);
    console.log("✔ สร้าง models ตัวอย่าง (พร้อมราคา USD)");
  }

  // ---------- routes ----------
  const existingRoutes = await db.select().from(routes);
  if (existingRoutes.length === 0) {
    const modelRows = await db.select().from(models);
    const mid = (modelId: string) => modelRows.find((m) => m.modelId === modelId)!.id;

    const [fast, pro] = await db
      .insert(routes)
      .values([
        { publicModel: "octopus-fast", description: "โมเดลเร็ว ราคาถูก เหมาะกับงานทั่วไป" },
        { publicModel: "octopus-pro", description: "โมเดลฉลาดพิเศษ สำหรับงานซับซ้อน" },
      ])
      .returning();

    await db.insert(routeTargets).values([
      { routeId: fast.id, modelRefId: mid("gpt-4o-mini"), priority: 1 },
      { routeId: fast.id, modelRefId: mid("gemini-1.5-flash"), priority: 2 },
      { routeId: pro.id, modelRefId: mid("claude-3.5-sonnet"), priority: 1 },
      { routeId: pro.id, modelRefId: mid("gpt-4o"), priority: 2 },
      { routeId: pro.id, modelRefId: mid("gemini-1.5-pro"), priority: 3 },
    ]);
    console.log("✔ สร้าง routes (octopus-fast, octopus-pro) พร้อม fallback targets");
  }

  // ---------- ข้อมูล requests ตัวอย่าง (optional) ----------
  if (process.env.SEED_DEMO_REQUESTS === "1") {
    const existingUser = await db.select().from(users);
    if (!existingUser.some((u) => u.id === DEMO_USER_ID)) {
      await db.insert(users).values({
        id: DEMO_USER_ID,
        email: "demo.user@octopus.ai",
        name: "Demo User",
        role: "user",
        credits: 12.5,
        plan: "free",
      });
      await db.insert(apiKeys).values({
        userId: DEMO_USER_ID,
        name: "Development",
        keyPrefix: "sk-oct-seed1",
        secret: "sk-oct-seed1-REPLACE_ME",
      });
      console.log("✔ สร้าง user ตัวอย่าง (demo.user@octopus.ai)");
    }

    const countRows = await db.execute(
      sql`select count(*)::int as c from requests where user_id = ${DEMO_USER_ID}`,
    );
    const existing = Number(
      (countRows as unknown as { rows: { c: number }[] }).rows?.[0]?.c ?? 0,
    );

    if (existing === 0) {
      const modelPool = [
        { provider: "OpenAI", model: "gpt-4o-mini", weight: 34 },
        { provider: "OpenAI", model: "gpt-4o", weight: 18 },
        { provider: "Anthropic", model: "claude-3.5-sonnet", weight: 20 },
        { provider: "Google AI", model: "gemini-1.5-pro", weight: 14 },
        { provider: "Groq", model: "llama-3.1-70b", weight: 9 },
        { provider: "Mistral", model: "mistral-large", weight: 5 },
      ];
      const agents = ["web-app", "octopus-cli", "mobile-app", "rag-worker", "slack-bot"];
      const publicModels = ["octopus-fast", "octopus-pro", "octopus-chat"];
      const rng = mulberry32(20261014);
      const total = modelPool.reduce((s, m) => s + m.weight, 0);
      const now = Date.now();
      const batch: (typeof requests.$inferInsert)[] = [];

      for (let i = 0; i < 500; i++) {
        const daysAgo = Math.floor(Math.pow(rng(), 1.6) * 30);
        const created = new Date(now - daysAgo * 86400_000);
        created.setHours(
          Math.floor(rng() * 24),
          Math.floor(rng() * 60),
          Math.floor(rng() * 60),
          0,
        );
        let r = rng() * total;
        const picked = modelPool.find((m) => (r -= m.weight) <= 0) ?? modelPool[0];
        const roll = rng();
        const status = roll > 0.94 ? "error" : roll > 0.88 ? "rate_limited" : "success";
        const inTok = Math.floor(200 + rng() * 3800);
        const outTok = status === "success" ? Math.floor(80 + rng() * 1600) : 0;
        batch.push({
          userId: DEMO_USER_ID,
          apiKeyId: 1,
          providerName: picked.provider,
          model: picked.model,
          publicModel: publicModels[Math.floor(rng() * publicModels.length)],
          agent: agents[Math.floor(rng() * agents.length)],
          status,
          httpStatus: status === "success" ? 200 : status === "rate_limited" ? 429 : 500,
          inputTokens: inTok,
          outputTokens: outTok,
          latencyMs: Math.floor(300 + rng() * 2700),
          costUsd: costOf(picked.model, inTok, outTok),
          error:
            status === "error"
              ? "upstream provider timeout after 30s"
              : status === "rate_limited"
                ? "429 Too Many Requests — cooldown 60s"
                : null,
          createdAt: created,
        });
      }
      await db.insert(requests).values(batch);
      console.log(`✔ สร้าง requests ตัวอย่าง ${batch.length} รายการ (ย้อนหลัง 30 วัน)`);
    }
  }

  console.log("\n🎉 Seed เสร็จสิ้น — รีเฟรชหน้าเว็บเพื่อดูข้อมูล");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed ล้มเหลว:", err);
  process.exit(1);
});
