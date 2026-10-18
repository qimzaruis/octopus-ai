"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";

const NAV = [
  { hash: "platform", label: "แพลตฟอร์ม" },
  { hash: "models", label: "โมเดล" },
  { hash: "developers", label: "นักพัฒนา" },
];

/**
 * SiteNav — แถบนําทางสาธารณะ (landing / signin)
 * sticky ตั้งแต่ต้น แต่จะได้พื้นหลังทึบ + เส้นคั่นก็ต่อเมื่อเลื่อนลงมาหรือเปิดเมนูมือถือ
 * ทําให้อ่านง่ายทั้งตอนอยู่บนสุดและตอนเลื่อนอยู่กลางหน้า
 *
 * พื้นหลังกับเส้นคั่นวางไว้ที่ <header> ทั้งก้อน (รวมแผงเมนู) เพื่อให้บาร์กับ
 * เมนูเปิดเป็นสีเดียวกันเป๊ะ — ถ้าแยกทาสีในแผงเอง ค่า alpha จะซ้อนทับกันเป็นสองชั้น
 */
export default function SiteNav({ active }: { active?: "signin" }) {
  const pathname = usePathname();
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  /** ถ้าอยู่หน้าแรกแล้ว เลื่อนหาส่วนนั้นเลย; ถ้าอยู่หน้าอื่นให้ Link พากลับหน้าแรกก่อน */
  function handleSectionClick(e: React.MouseEvent, hash: string) {
    if (pathname !== "/") return;
    const el = document.getElementById(hash);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  }

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-base ease-enter ${
        scrolled || menuOpen
          ? "border-white/[0.07] bg-ink-950/85 backdrop-blur-md"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo size={28} />
          <span className="whitespace-nowrap text-body-sm font-semibold tracking-tight text-fg">
            Octopus <span className="text-brand-300">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((l) => (
            <Link
              key={l.hash}
              href={`/#${l.hash}`}
              onClick={(e) => handleSectionClick(e, l.hash)}
              className="whitespace-nowrap rounded-md px-3.5 py-2 text-body-sm text-fg-muted transition-colors duration-fast hover:bg-white/[0.06] hover:text-fg"
            >
              {t(l.label)}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          {active === "signin" ? (
            <Link href="/" className="btn-secondary whitespace-nowrap !px-4 !py-2 text-body-sm" aria-current="page">
              <Icon name="fa-house" className="text-label" /> {t("หน้าแรก")}
            </Link>
          ) : (
            <Link href="/signin" className="btn-primary whitespace-nowrap !px-4 !py-2 text-body-sm">
              {t("เริ่มใช้งาน")} <Icon name="fa-arrow-right" className="text-label" />
            </Link>
          )}

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.06] text-fg transition hover:bg-white/[0.11] md:hidden"
          >
            <Icon name={menuOpen ? "fa-xmark" : "fa-bars"} className="text-sm" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="px-6 pb-3 pt-1 md:hidden">
          {NAV.map((l) => (
            <Link
              key={l.hash}
              href={`/#${l.hash}`}
              onClick={(e) => handleSectionClick(e, l.hash)}
              className="block rounded-md px-3 py-2.5 text-body-sm text-fg-muted transition hover:bg-white/[0.06] hover:text-fg"
            >
              {t(l.label)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}