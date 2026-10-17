import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_SESSION_COOKIE } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/`);

  if (isDemoMode) {
    response.cookies.delete(DEMO_SESSION_COOKIE);
  } else {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  return response;
}
