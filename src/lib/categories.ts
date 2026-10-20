/**
 * ลำดับหมวดบนหน้าจอ — หมวดของ OctopusAI ต้องอยู่บนสุดเสมอ
 * ที่เหลือเรียงตามชื่อ (ภาษาไทยใช้ collation ของเบราว์เซอร์)
 */
export function categoryRank(name: string | null | undefined): number {
  return /octopus/i.test(name ?? "") ? 0 : 1;
}

export function compareCategories(a: string, b: string): number {
  return categoryRank(a) - categoryRank(b) || a.localeCompare(b, "th");
}
