import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/config";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/`);

  // ล้าง session จริงของผู้ใช้ — แคชฝั่งเซิร์ฟเวอร์ผูกกับ access token
  // เมื่อ cookie หายแล้วกุญแจนั้นไม่มีใครเรียกได้อีก และจะหมดอายุเองใน 15 วินาที
  if (supabaseConfigured) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[auth] signOut ไม่สำเร็จ:", err);
    }
  }

  return response;
}
