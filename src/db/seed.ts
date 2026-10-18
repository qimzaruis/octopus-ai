/**
 * Seed ข้อมูลเริ่มต้นลง Supabase Postgres ผ่าน Drizzle
 *
 *   npm run db:seed
 *
 * ทำสิ่งต่อไปนี้ (ข้ามถ้ามีข้อมูลอยู่แล้ว):
 *  - สร้าง providers + models ตัวอย่าง
 *  - สร้าง routes (octopus-fast / octopus-pro) พร้อม targets
 */
import "../lib/dotenv";
import { getDb } from "./index";
import { models, providerKeys, providers, routeTargets, routes } from "./schema";

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

  console.log("\n🎉 Seed เสร็จสิ้น — รีเฟรชหน้าเว็บเพื่อดูข้อมูล");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed ล้มเหลว:", err);
  process.exit(1);
});
