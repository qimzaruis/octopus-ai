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
const PUBLIC_PREFIXES = ["/auth/", "/api/", "/v1/", "/s/"];

function requiresSession(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return false;
  return !PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * ผลการยืนยัน session ต่อ cookie ชุดหนึ่ง — เก็บสั้น ๆ ไว้ในเครื่อง
 *
 * ทุก navigation ต้องเรียก auth.getUser() ซึ่งคือหนึ่ง request ข้ามเครือข่ายไปถึง
 * GoTrue จริง ๆ (log dev วัดได้ 0.5–2.8 วินาทีต่อ request) ทั้งที่ผู้ใช้คนเดิมกดไป
 * หลายหน้าในนาทีเดียว จำผลไว้ 15 วินาทีจึงตัดค่าเดินทางนั้นออกได้ทั้งแถบ
 *
 * กุญแจคือค่า cookie auth ทั้งก้อน: token หมุน/ล็อกเอาต์/หมดอายุ = คนละกุญแจทันที
 * note: นี่เป็นแค่ประตู "ต้องพาไปหน้าล็อกอินไหม" — หน้าที่มีข้อมูลผู้ใช้ยังเรียก
 * getSessionUser() เพื่อยืนยันซ้ำเสมอ
 */
const VERIFY_TTL_MS = 15_000;
const verified = new Map<string, { at: number; signedIn: boolean }>();

function authCookieKey(request: NextRequest): string | null {
  const parts = request.cookies
    .getAll()
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
    .map((c) => `${c.name}=${c.value}`);
  return parts.length > 0 ? parts.join(";") : null;
}

function remember(key: string, signedIn: boolean): void {
  if (verified.size > 200) {
    const cutoff = Date.now() - VERIFY_TTL_MS;
    for (const [k, entry] of verified) if (entry.at <= cutoff) verified.delete(k);
  }
  verified.set(key, { at: Date.now(), signedIn });
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  /**
   * Supabase ดีดกลับ Site URL (หน้าแรก) พร้อม `?code=` เมื่อ redirectTo
   * ไม่อยู่ใน Additional Redirect URLs — code ต้องถูกแลกเป็น session ที่
   * /auth/callback เท่านั้น ไม่อย่างนั้นผู้ใช้จะเห็นหน้าแรกเฉย ๆ ทั้งที่ล็อกอินแล้ว
   * (เกิดกับโดเมนใหม่ที่ยังไม่ได้ใส่ allowlist)
   */
  if (pathname !== "/auth/callback" && !pathname.startsWith("/s/")) {
    const code = searchParams.get("code");
    if (code) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/callback";
      return NextResponse.redirect(url);
    }
  }

  // OAuth ถูกปฏิเสธ/ผิดพลาด → Supabase ดีด error มาที่หน้าแรกเช่นกัน
  if (pathname === "/") {
    const authError = searchParams.get("error") ?? searchParams.get("error_code");
    if (authError) {
      const url = request.nextUrl.clone();
      url.pathname = "/signin";
      url.search = "?error=auth";
      return NextResponse.redirect(url);
    }
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

  // ไม่มี cookie session เลย = ยังไม่ได้ล็อกอิน ไม่ต้องเสียเวลาถามเซิร์ฟเวอร์
  const cookieKey = authCookieKey(request);
  let signedIn = false;
  if (!cookieKey) {
    signedIn = false;
  } else {
    const hit = verified.get(cookieKey);
    if (hit && hit.at + VERIFY_TTL_MS > Date.now()) {
      signedIn = hit.signedIn;
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      signedIn = Boolean(user);
      remember(cookieKey, signedIn);
    }
  }

  if (!signedIn && requiresSession(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  /* ไฟล์ static ไม่มีข้อมูลของผู้ใช้ใคร — กันออกจาก matcher เลย
     (เดิมมีแค่ svg|png|jpg|jpeg|gif|webp|ico|css|js ทำให้ /media/octopus_hero.mp4
     กับ .webm ของมาสคอตหน้าแรกโดนขอ session → 307 ไป /signin
     คนที่เปิดหน้าแรกแบบยังไม่ล็อกอินจึงเห็นฮีโร่เงียบไม่มีวิดีโอ
     และทุก request ถูกลากไปเรียก auth.getUser() โดยไม่จำเป็น) */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|mp4|webm|mov|woff|woff2|ttf|txt|xml|json)$).*)",
  ],
};
