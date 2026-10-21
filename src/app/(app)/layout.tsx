import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import Sidebar, { type NavSection } from "@/components/Sidebar";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (user.banned) redirect("/banned");

  const t = await getT();

  const sections: NavSection[] = [
    {
      title: t("ภาพรวม"),
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "fa-solid fa-chart-pie" },
        { href: "/models", label: t("โมเดล"), icon: "fa-solid fa-cube" },
        { href: "/requests", label: t("ประวัติการเรียกใช้"), icon: "fa-solid fa-clock-rotate-left" },
      ],
    },
    {
      title: t("บริการ"),
      items: [
        { href: "/agent", label: "Web Agent", icon: "fa-solid fa-robot" },
        { href: "/images", label: t("สร้างรูปภาพ"), icon: "fa-solid fa-image" },
      ],
    },
    {
      title: t("จัดการ"),
      items: [
        { href: "/keys", label: "API Keys", icon: "fa-solid fa-key" },
        { href: "/credits", label: t("เครดิต"), icon: "fa-solid fa-coins" },
        { href: "/subscription", label: "Subscription Plan", icon: "fa-solid fa-gauge-high" },
      ],
    },
  ];

  if (user.role === "admin") {
    sections.push({
      title: t("แอดมิน"),
      items: [
        { href: "/admin", label: t("สรุปการใช้งานรวม"), icon: "fa-solid fa-user-shield" },
        { href: "/admin/users", label: t("ผู้ใช้"), icon: "fa-solid fa-users" },
        { href: "/admin/providers", label: "Providers", icon: "fa-solid fa-plug" },
        { href: "/admin/key-limits", label: t("จำกัดคีย์"), icon: "fa-solid fa-signal" },
        { href: "/admin/models", label: t("โมเดลที่แสดง"), icon: "fa-solid fa-list-check" },
        { href: "/admin/plans", label: t("แผนและโควต้า"), icon: "fa-solid fa-gauge-high" },
        { href: "/admin/chat", label: t("ตั้งค่า Web Agent"), icon: "fa-solid fa-robot" },
      ],
    });
  }

  return (
    <div className="min-h-dvh bg-ink-950">
      <Sidebar
        sections={sections}
        email={user.email}
        name={user.name}
        role={user.role}
        plan={user.plan}
        credits={user.credits}
      />

      {/* Topbar — เบลอเฉพาะแถบเดียว (ไม่ใช่ทั้งหน้า) เพื่อลดภาระ GPU
          min-h-16 + pt(env): ในเบราว์เซอร์ค่าเป็น 0 จึงได้ 64px เท่าเดิม
          แต่บน PWA ติดตั้งที่มีรอยบาก แถบจะไม่ทับ status bar */}
      <header className="sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b border-white/[0.07] bg-ink-950/85 pl-4 pr-16 pt-[env(safe-area-inset-top)] backdrop-blur-sm lg:ml-64 lg:pl-8 lg:pr-8">
        <div className="lg:hidden">
          <Link href="/dashboard" className="text-body-sm font-semibold text-fg">
            Octopus <span className="text-brand-300">AI</span>
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <LanguageSwitcher variant="compact" />

          <Link
            href="/keys"
            className="hidden items-center gap-2 rounded-md bg-white/[0.05] px-3.5 py-2 text-caption font-medium text-fg-muted transition-colors duration-fast hover:bg-white/[0.09] hover:text-fg sm:flex"
          >
            <Icon name="fa-key" className="text-label" /> API Keys
          </Link>

        </div>
      </header>

      {/* ปุ่มเมนูย้ายไปขวาบนแล้ว — เหลือแค่ระยะพ้น gesture bar ของ iOS */}
      <main className="px-4 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:pb-10 lg:pl-72 lg:pr-8">
        {children}
      </main>
    </div>
  );
}