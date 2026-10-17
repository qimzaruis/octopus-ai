import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/auth";
import { isDemoMode, supabaseConfigured } from "@/lib/config";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/`);

  // ล้างทั้ง cookie เดโม และ session จริง (ถ้ามี) — ไม่ว่าจะอยู่ในโหมด Demo หรือไม่
  // เพราะผู้ใช้อาจ login Google จริงได้แม้ APP_ENV=development
  response.cookies.delete(DEMO_SESSION_COOKIE);
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
