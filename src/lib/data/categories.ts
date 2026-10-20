import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, routeCategories, routes } from "@/db/schema";

export type ResolvedCategory = {
  id: number;
  name: string;
  logoUrl: string | null;
} | null;

/**
 * หมวด = รูปในคลัง — ชื่อหมวดคือชื่อรูป ไม่ต้องสร้างหมวดแยก
 *
 * ถ้ามีหมวดชื่อนี้อยู่แล้วแต่รูปต่าง ให้เปลี่ยนรูปหมวดและอัปเดต route ทุกตัว
 * ในหมวดนั้นให้ใช้รูปใหม่ (หมวดกับรูปเป็นค่าเดียวกัน)
 */
export async function resolveCategoryForAsset(
  logoUrl: string | null,
): Promise<ResolvedCategory> {
  if (!logoUrl) return null;

  const db = getDb();
  const asset = (await db.select().from(assets).where(eq(assets.publicUrl, logoUrl)))[0];
  if (!asset || !asset.name.trim()) return null;
  const name = asset.name.trim();

  const existing = (
    await db.select().from(routeCategories).where(eq(routeCategories.name, name))
  )[0];
  if (existing) {
    if (existing.logoUrl !== logoUrl) {
      await db
        .update(routeCategories)
        .set({ logoUrl })
        .where(eq(routeCategories.id, existing.id));
      await db.update(routes).set({ logoUrl }).where(eq(routes.categoryId, existing.id));
    }
    return { id: existing.id, name: existing.name, logoUrl };
  }

  const inserted = await db
    .insert(routeCategories)
    .values({ name, logoUrl })
    .returning();
  const category = inserted[0];
  return category
    ? { id: category.id, name: category.name, logoUrl: category.logoUrl ?? null }
    : null;
}
