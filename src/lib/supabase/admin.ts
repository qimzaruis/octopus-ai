import "server-only";

/**
 * จุดเข้าใช้ service-role client สําหรับโค้ดฝั่ง server ของแอป
 *
 * server-only กันไม่ให้ไฟล์นี้หลุดเข้า bundle ฝั่ง client โดยเด็ดขาด
 * ส่วนตัว implementation อยู่ใน admin-client.ts (ไม่มี guard) เพื่อให้สคริปต์ CLI ใช้ได้
 */
export {
  ASSETS_BUCKET,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  createAdminClient,
} from "@/lib/supabase/admin-client";