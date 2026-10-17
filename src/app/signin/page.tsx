import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import Badge from "@/components/Badge";
import LoginForm from "@/components/LoginForm";
import LiveUsagePanel from "@/components/LiveUsagePanel";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getSessionUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

const TRUST = [
  { icon: "fa-solid fa-bolt", text: "แดชบอร์ดใช้งานแบบเรียลไทม์" },
  { icon: "fa-solid fa-key", text: "API key ของคุณเอง สูงสุด 3 คีย์" },
  { icon: "fa-solid fa-route", text: "routing พร้อม fallback อัตโนมัติ" },
  { icon: "fa-solid fa-chart-line", text: "ติดตาม token และค่าใช้จ่ายครบ" },
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const t = await getT();

  const sp = await searchParams;
  const nextPath =
    sp.next && sp.next.startsWith("/") ? sp.next : "/dashboard";

  return (
    /* overflow-x-clip เพื่อไม่ให้ sticky nav เสีย (เหมือนหน้าแรก) */
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-ink-950">
      <SiteNav active="signin" />

      <main className="relative flex-1">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          {/* ---------- ฝั่งแบรนด์ ---------- */}
          <div className="animate-fade-up">
            <Badge tone="brand">Unified AI Gateway</Badge>

            <h1 className="mt-6 font-display text-h1 font-semibold text-fg">
              {t("ทางเข้าหนึ่งเดียว")}
              <br />
              <span className="text-brand-300">{t("สู่ทุกโมเดล AI")}</span>
            </h1>

            <p className="mt-5 max-w-md text-body text-fg-muted">
              {t("จัดการโมเดล คีย์ และค่าใช้จ่ายทั้งหมดของทีมคุณจากที่เดียว — เริ่มได้ภายในไม่กี่นาที ไม่ต้องตั้งโครงสร้างพื้นฐานเอง")}
            </p>

            <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
              {TRUST.map((item) => (
                <li
                  key={item.text}
                  className="flex items-center gap-3 rounded-md bg-white/[0.04] px-3.5 py-3 text-body-sm text-fg-muted"
                >
                  <i className={`${item.icon} text-caption text-brand-300`} />
                  {t(item.text)}
                </li>
              ))}
            </ul>

            <div className="mt-10 hidden lg:block">
              <LiveUsagePanel />
            </div>
          </div>

          {/* ---------- ฝั่งฟอร์ม ---------- */}
          <div className="animate-fade-up mx-auto w-full max-w-sm [animation-delay:100ms] lg:mx-0 lg:ml-auto">
            <div className="rounded-xl bg-ink-900 p-7 shadow-floating">
              <div className="flex items-center gap-2.5 lg:hidden">
                <Logo size={26} />
                <span className="text-body-sm font-semibold text-fg">
                  Octopus <span className="text-brand-300">AI</span>
                </span>
              </div>

<h2 className="text-h3 font-semibold text-fg">{t("เข้าสู่ระบบ")}</h2>
              <p className="mt-1.5 text-body-sm text-fg-muted">
                {t("ใช้อีเมลองค์กรหรือบัญชี Google ของคุณก็ได้")}
              </p>

              {sp.error && (
                <p
                  role="alert"
                  className="mt-4 rounded-md bg-rose-500/10 px-3.5 py-3 text-caption text-rose-300"
                >
                  <i className="fa-solid fa-circle-exclamation mr-1.5" />
                  {t("การยืนยันตัวตนไม่สําเร็จ กรุณาลองอีกครั้ง")}
                </p>
              )}

              <div className="mt-6">
                <LoginForm nextPath={nextPath} demoMode={isDemoMode} />
              </div>

<p className="mt-6 border-t border-white/[0.07] pt-5 text-center text-caption leading-relaxed text-fg-subtle">
                {t("เข้าสู่ระบบแสดงว่าคุณยอมรับข้อกําหนดการใช้งานและนโยบายความเป็นส่วนตัว")}
              </p>
            </div>

            {isDemoMode && (
              <p className="mt-4 text-center text-caption text-fg-subtle">
                <i className="fa-solid fa-flask mr-1.5 text-amber-glow" />
                {t("โหมด Demo — ทดลองได้โดยไม่ต้องตั้งค่า Supabase")}
              </p>
            )}

            <p className="mt-5 text-center text-caption text-fg-subtle">
              {t("ยังไม่มีบัญชี? การเข้าสู่ระบบด้วย Google จะสร้างบัญชีให้อัตโนมัติครั้งแรก")}
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}