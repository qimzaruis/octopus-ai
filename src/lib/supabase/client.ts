"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // ต่อ sb_flow_id มากับ callback เพื่อให้ฝั่ง server หยิบ PKCE verifier
        // ของ flow นั้นได้ตรงตัว แม้ผู้ใช้จะเปิดล็อกอินหลายแท็บ/หลายรอบ
        experimental: { appendPkceFlowIdToRedirects: true },
      },
    },
  );
}
