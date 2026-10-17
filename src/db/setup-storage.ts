/**
 * สร้าง bucket สำหรับเก็บรูป (octopus-assets) แบบ idempotent
 *
 *   npm run storage:setup
 *
 * bucket เป็น public เพื่อให้ next/image โหลดรูปผ่าน URL ตรงได้
 * รันซ้ำได้ปลอดภัย — ถ้ามี bucket อยู่แล้วจะข้ามให้
 */
import "../lib/dotenv";
import { ASSETS_BUCKET, createAdminClient } from "@/lib/supabase/admin-client";

async function main() {
  const supabase = createAdminClient();

  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("✖ อ่านรายการ bucket ไม่สําเร็จ:", listError.message);
    process.exit(1);
  }

  if (existing.some((b) => b.name === ASSETS_BUCKET)) {
    console.log(`✔ bucket "${ASSETS_BUCKET}" มีอยู่แล้ว — ข้าม`);
    return;
  }

  const { error } = await supabase.storage.createBucket(ASSETS_BUCKET, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  });

  if (error) {
    console.error("✖ สร้าง bucket ไม่สําเร็จ:", error.message);
    process.exit(1);
  }

  console.log(`✔ สร้าง bucket "${ASSETS_BUCKET}" เรียบร้อย (public read, จำกัด 2MB, png/jpeg/webp)`);
}

main().catch((err) => {
  console.error("✖ ผิดพลาด:", err instanceof Error ? err.message : err);
  process.exit(1);
});