import "server-only";
import { randomUUID } from "node:crypto";
import {
  ALLOWED_IMAGE_TYPES,
  ASSETS_BUCKET,
  MAX_IMAGE_BYTES,
  createAdminClient,
} from "@/lib/supabase/admin";
import { createAsset } from "@/lib/data/admin";

/** นามสกุลไฟล์ตามชนิดที่อนุญาต */
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type UploadAssetResult = { ok: boolean; error?: string; publicUrl?: string };

/**
 * อัปโหลดรูปขึ้น Supabase Storage แล้วบันทึกเข้าแฟ้ม assets
 *
 * ความปลอดภัย:
 * - รับเฉพาะ png/jpeg/webp (ไม่รับ SVG เพราะฝังสคริปต์ได้)
 * - จํากัดขนาด 2MB
 * - ตั้งชื่อไฟล์ใหม่แบบสุ่ม ไม่ใช้ชื่อจากผู้ใช้ (กัน path traversal / ชนกัน)
 */
export async function uploadAsset(input: {
  file: File | null;
  name: string;
}): Promise<UploadAssetResult> {
  const { file } = input;
  const name = input.name.trim();

  if (!file || file.size === 0) return { ok: false, error: "เลือกไฟล์รูปก่อน" };
  if (!name) return { ok: false, error: "ตั้งชื่อรูปก่อนบันทึก" };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "รับเฉพาะไฟล์ PNG, JPG หรือ WEBP" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "ไฟล์ใหญ่เกิน 2MB" };
  }

  const ext = EXT[file.type] ?? "png";
  const storagePath = `${randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upError } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (upError) {
    return { ok: false, error: `อัปโหลดไม่สําเร็จ: ${upError.message}` };
  }

  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(storagePath);
  const publicUrl = data.publicUrl;

  const saved = await createAsset({
    name,
    storagePath,
    publicUrl,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (!saved.ok) return { ok: false, error: saved.error };

  return { ok: true, publicUrl };
}

/** ลบไฟล์ออกจาก Storage ด้วย (ใช้คู่กับ deleteAsset ที่ลบแถวใน DB) */
export async function removeAssetFile(storagePath: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(ASSETS_BUCKET).remove([storagePath]);
}