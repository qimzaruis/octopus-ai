import Link from "next/link";
import Logo from "@/components/Logo";
import { getT } from "@/lib/i18n/server";

/**
 * SiteFooter — ฟุตเตอร์สาธารณะที่ใช้ร่วมกันทุกหน้า
 * แยกชั้นด้วยพื้น ink-900 (section) ไม่ใช้เส้นขอบเป็นตัวแบ่งหลัก
 */
export default async function SiteFooter() {
  const t = await getT();
  const COLUMNS = [
    {
      title: t("ผลิตภัณฑ์"),
      links: [
        { href: "/#platform", label: t("แพลตฟอร์ม") },
        { href: "/#models", label: t("โมเดล") },
        { href: "/#developers", label: t("นักพัฒนา") },
      ],
    },
    {
      title: t("บัญชี"),
      links: [
        { href: "/signin", label: t("เข้าสู่ระบบ") },
        { href: "/keys", label: "API Keys" },
        { href: "/credits", label: t("เครดิต") },
      ],
    },
    {
      title: t("แดชบอร์ด"),
      links: [
        { href: "/dashboard", label: t("ภาพรวมการใช้งาน") },
        { href: "/requests", label: t("ประวัติการเรียกใช้") },
      ],
    },
  ];

  return (
    <footer className="bg-ink-900/60">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <Logo size={26} />
              <span className="text-body-sm font-semibold text-fg">
                Octopus <span className="text-brand-300">AI</span>
              </span>
            </div>
            <p className="mt-3 text-caption leading-relaxed text-fg-subtle">
              {t("ทางเข้าหนึ่งเดียวสู่ทุกโมเดล AI — เชื่อมต่อ วิเคราะห์ และควบคุมได้จากที่เดียว")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title} className="space-y-2.5">
                <p className="text-label font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                  {col.title}
                </p>
                {col.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="block text-body-sm text-fg-muted transition-colors duration-fast hover:text-fg"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.07] pt-6 sm:flex-row">
          <p className="text-caption text-fg-subtle">
            © 2026 Octopus AI — One Gateway to Every AI
          </p>
          <nav className="flex items-center gap-5">
            <Link
              href="/terms"
              className="text-caption text-fg-subtle transition-colors duration-fast hover:text-fg"
            >
              {t("ข้อกําหนดการใช้งาน")}
            </Link>
            <Link
              href="/privacy"
              className="text-caption text-fg-subtle transition-colors duration-fast hover:text-fg"
            >
              {t("นโยบายความเป็นส่วนตัว")}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}