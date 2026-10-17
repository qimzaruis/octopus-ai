import { NextResponse, type NextRequest } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";

/** ล็อกอินจำลองสำหรับโหมด Demo */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const role = searchParams.get("role") === "admin" ? "admin" : "user";

  if (!isDemoMode) {
    return NextResponse.redirect(`${origin}/signin`);
  }

  const response = NextResponse.redirect(`${origin}/dashboard`);
  response.cookies.set(DEMO_SESSION_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
