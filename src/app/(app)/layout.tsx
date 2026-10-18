import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import Sidebar, { type NavSection } from "@/components/Sidebar";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { isDemoMode } from "@/lib/config";
import { formatUsd } from "@/lib/format";
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
        { href: "/images", label: t("สร้างรูปภาพ"), icon: "fa-solid fa-wand-magic-sparkles" },
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
        { href: "/admin/models", label: t("โมเดลที่แสดง"), icon: "fa-solid fa-list-check" },
        { href: "/admin/plans", label: t("แผนและโควต้า"), icon: "fa-solid fa-gauge-high" },
        { href: "/admin/chat", label: t("ตั้งค่า Web Agent"), icon: "fa-solid fa-robot" },
      ],
    });
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <Sidebar
        sections={sections}
        email={user.email}
        name={user.name}
        role={user.role}
        plan={user.plan}
        credits={user.credits}
        demoMode={isDemoMode}
      />

      {/* Topbar — เบลอเฉพาะแถบเดียว (ไม่ใช่ทั้งหน้า) เพื่อลดภาระ GPU */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/[0.07] bg-ink-950/85 px-4 backdrop-blur-sm lg:ml-64 lg:pl-8 lg:pr-8">
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

          <Link
            href="/credits"
            className="flex items-center gap-2 rounded-md bg-white/[0.05] px-3.5 py-2 text-caption font-medium text-fg-muted transition-colors duration-fast hover:bg-white/[0.09]"
          >
            <Icon name="fa-coins" className="text-amber-glow" />
            <span className="tnum">{formatUsd(user.credits)}</span>
            <span className="hidden text-micro text-fg-subtle sm:inline">USD</span>
          </Link>
        </div>
      </header>

      <main className="px-4 pb-24 pt-6 sm:px-6 lg:pb-10 lg:pl-72 lg:pr-8">{children}</main>
    </div>
  );
}