import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * หน้าที่ไม่ต้องล็อกอิน
 *
 * กันด้วย "allowlist ของหน้าสาธารณะ" ไม่ใช่ blacklist ของหน้าล็อกอิน เพราะNext ให้
 * layout เรียก redirect() ตอน render แล้ว — ตัว response ยังเป็น 307 พร้อม body ที่มี
 * flight payload ของหน้า đó (รวมราคา/ปลายทางที่ผู้ใช้คนอื่นเห็นได้) การบล็อกตั้งแต่
 * ชั้นนี้จึงเป็นชั้นเดียวที่มั่นใจว่าไม่มีข้อมูลหลุดไปกับ request ไม่ล็อกอิน
 */
const PUBLIC_PAGES = new Set(["/", "/signin", "/terms", "/privacy", "/banned"]);
const PUBLIC_PREFIXES = ["/auth/", "/api/", "/v1/"];

function requiresSession(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return false;
  return !PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && requiresSession(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
