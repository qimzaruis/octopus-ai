import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/config";
import { invalidateSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/`);

  // ล้าง session จริงของผู้ใช้
  if (supabaseConfigured) {
    try {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user.id) invalidateSessionUser(session.user.id);
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[auth] signOut ไม่สำเร็จ:", err);
    }
  }

  return response;
}
