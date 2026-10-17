import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client ที่ใช้ service role key
 *
 * ไฟล์นี้ "ไม่มี" server-only guard เพราะสคริปต์ CLI (เช่น storage:setup ที่รันด้วย tsx)
 * ต้อง import ได้ — การกันหลุดไปฝั่ง client อยู่ใน admin.ts ที่ re-export จากไฟล์นี้
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "ต้องตั้ง NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY เพื่อใช้ Supabase Storage",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** ชื่อ bucket เดียวของระบบ (public read เพื่อให้ next/image โหลดได้) */
export const ASSETS_BUCKET = "octopus-assets";

/** ชนิดไฟล์ที่ยอมรับ — ไม่รับ SVG เพราะฝังสคริปต์ได้ (XSS) */
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** เพดานขนาดไฟล์ (2MB) */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;