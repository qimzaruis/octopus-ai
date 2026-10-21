import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  /**
   * supabase-js 2.117+ เก็บ PKCE verifier แยกตาม flow และต่อ `sb_flow_id`
   * มากับ callback URL — ต้องส่ง flowId ไปด้วย ไม่งั้นการแลก code จะหยิบ
   * verifier ตัวเก่า/คนละ flow แล้วล้มเหลว (โดยเฉพาะเมื่อผู้ใช้ลองหลายรอบ)
   */
  const rawFlowId = searchParams.get("sb_flow_id");
  const flowId =
    rawFlowId && /^[A-Za-z0-9_-]{8,64}$/.test(rawFlowId) ? rawFlowId : undefined;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    console.error(
      "[auth/callback] exchangeCodeForSession failed:",
      error.code ?? "(no code)",
      error.message,
      "flowId:",
      flowId ?? "(none)",
    );
  }

  return NextResponse.redirect(`${origin}/signin?error=auth`);
}
