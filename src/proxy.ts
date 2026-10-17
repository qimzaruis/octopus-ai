import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, supabaseConfigured } from "@/lib/config";

const PROTECTED_PREFIXES = ["/dashboard", "/requests", "/keys", "/credits", "/admin"];
const DEMO_SESSION_COOKIE = "octopus_demo_session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // โหมด Demo: ยอมรับ cookie เดโม หรือ session ของ Supabase จริง (แล้วแต่ทางที่ผู้ใช้เข้า)
  // — โหมดพัฒนารับได้ทั้งสองทาง เพื่อให้ทดสอบ Google login ได้โดยไม่ต้องปิดโหมด Demo
  if (isDemoMode) {
    const hasDemoSession = Boolean(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
    const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

    if (hasDemoSession || !isProtected) {
      return NextResponse.next();
    }

    // ไม่มี cookie เดโม — ลองดูว่ามี Supabase session จริงไหมก่อนตัดสินใจ
    if (supabaseConfigured) {
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
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
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
      if (user) return response;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

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

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
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
