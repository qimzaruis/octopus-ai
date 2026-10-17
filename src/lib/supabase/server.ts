import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client ฝั่ง server
 * Next.js 15+ ทํา cookies() เป็น async — await ไว้เพื่อให้ใช้ได้ทั้ง Next 14 และ 16
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // เรียกจาก Server Component — proxy.ts จะจัดการ refresh session เอง
          }
        },
      },
    },
  );
}