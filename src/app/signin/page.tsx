import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import AsciiArt from "@/components/AsciiArt";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getSessionUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

async function loadAsciiArt(): Promise<string> {
  try {
    return await readFile(
      path.join(process.cwd(), "public", "ascii-art.txt"),
      "utf8",
    );
  } catch {
    return "";
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const t = await getT();
  const asciiArt = await loadAsciiArt();

  const sp = await searchParams;
  const nextPath =
    sp.next && sp.next.startsWith("/") ? sp.next : "/dashboard";

  return (
    /* overflow-x-clip เพื่อไม่ให้ sticky nav เสีย (เหมือนหน้าแรก) */
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-ink-950">
      <SiteNav active="signin" />

      {/* 100svh ไม่ใช่ 100vh: บน Chrome Android แถบ URL หด-ขยายทําให้ 100vh สูงกว่า
          พื้นที่จริง การ์ดเลยถูกดันตกขอบล่างแล้ว scroll ไม่ถึง ("ฟอร์มหายครึ่งใบ") */}
      <main className="relative flex min-h-[calc(100svh-4rem)] flex-1 items-center overflow-hidden">
        {/* ASCII art เต็มจอเป็นพื้นหลัง — จัดมาสคอตไว้ฝั่งซ้าย (focusX) */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {asciiArt && (
            <AsciiArt text={asciiArt} cover focusX={0.34} />
          )}
          <div className="absolute left-[-8%] top-1/3 h-[560px] w-[880px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.14),transparent)]" />
          <div className="absolute right-[-6%] top-1/4 h-[440px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.10),transparent)]" />
        </div>

        {/* ---------- ฟอร์มเข้าสู่ระบบ ---------- */}
        {/* ขนาดจอต่ำกว่า xl (แท็บเล็ต/ไอแพด/จอเล็ก)การ์ดอยู่กึ่งกลาง
            เดสก์ท็อปเท่านั้นที่ย้ายไปฝั่งขวาเพื่อเว้นที่ให้มาสคอต */}
        <div className="safe-inline relative mx-auto w-full max-w-6xl py-10 sm:py-14">
          <div className="animate-fade-up mx-auto w-full max-w-sm xl:mr-0">
            <div className="rounded-xl bg-ink-900 p-5 shadow-[0_0_48px_-16px_rgba(139,92,246,0.45)] ring-1 ring-white/[0.06] sm:p-7">
              <h2 className="text-h3 font-semibold text-fg">{t("เข้าสู่ระบบ")}</h2>
              <p className="mt-1.5 text-body-sm text-fg-muted">
                {t("ใช้อีเมลองค์กรหรือบัญชี Google ของคุณก็ได้")}
              </p>

              {sp.error && (
                <p
                  role="alert"
                  className="mt-4 rounded-md bg-rose-500/10 px-3.5 py-3 text-caption text-rose-300"
                >
                  <Icon name="fa-circle-exclamation" className="mr-1.5" />
                  {t("การยืนยันตัวตนไม่สําเร็จ กรุณาลองอีกครั้ง")}
                </p>
              )}

              <div className="mt-6">
                <LoginForm nextPath={nextPath} />
              </div>
            </div>

            <p className="mt-5 rounded-lg bg-ink-950/85 px-4 py-2.5 text-center text-caption leading-relaxed text-fg-subtle ring-1 ring-white/[0.08] backdrop-blur-sm">
              {t("ยังไม่มีบัญชี? การเข้าสู่ระบบด้วย Google จะสร้างบัญชีให้อัตโนมัติครั้งแรก")}
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}