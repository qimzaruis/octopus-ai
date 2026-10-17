import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

/**
 * โหลด env ให้สคริปต์ CLI (drizzle-kit, tsx seed)
 *
 * Next.js โหลด .env.local ให้เองอยู่แล้ว แต่เครื่องมือที่รันนอก Next ไม่โหลด
 * ลําดับความสําคัญเหมือน Next: .env.local ชนะ .env (โหลดตัวที่ชนะก่อน + ไม่ override)
 */
for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) config({ path, override: false });
}