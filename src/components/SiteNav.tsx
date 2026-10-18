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

/** id ของแผงเมนูมือถือ — ให้ปุ่มแฮมเบอร์เกอร์อ้างถึงด้วย aria-controls */
const MENU_ID = "site-nav-menu";

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

  /* Escape ปิดเมนู — บนมือถือเมนูเป็นแผงเต็มความกว้าง การไม่มีทางปิดด้วยคีย์บอร์ด
     ทำให้ keyboard/switch-access users ติดอยู่ในแถบ header */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
      {/* safe-inline = gutter 1.5rem ที่บวก safe-area ด้านข้างให้ด้วย (จอแนวนอนที่มีรอยบาก)
          gap-4 ที่จอเล็ก: แถวนี้เคย intrinsic ~374px > 312px ที่เหลือจริงที่ 360px
          ทำให้ทั้งปุ่ม CTA และปุ่มแฮมเบอร์เกอร์ถูกดันหลุดจอ */}
      <div className="safe-inline mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 sm:gap-6">
        <Link href="/" className="touch-min flex shrink-0 items-center gap-2.5">
          <Logo size={28} />
          <span className="whitespace-nowrap text-body-sm font-semibold tracking-tight text-fg">
            Octopus <span className="text-brand-300">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={t("นําทางหลัก")}>
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
          {/* ต่ำกว่า sm: ปุ่มหลักย้ายลงไปอยู่ในแผงเมนูแทน เพื่อไม่ให้แถว header ล้นขอบจอ */}
          {active === "signin" ? (
            <Link
              href="/"
              className="btn-secondary hidden whitespace-nowrap !px-4 !py-2 text-body-sm sm:inline-flex"
              aria-current="page"
            >
              <Icon name="fa-house" className="text-label" /> {t("หน้าแรก")}
            </Link>
          ) : (
            <Link
              href="/signin"
              className="btn-primary hidden whitespace-nowrap !px-4 !py-2 text-body-sm sm:inline-flex"
            >
              {t("เริ่มใช้งาน")} <Icon name="fa-arrow-right" className="text-label" />
            </Link>
          )}

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? t("ปิดเมนู") : t("เปิดเมนู")}
            aria-expanded={menuOpen}
            aria-controls={MENU_ID}
            className="touch-min-icon flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.06] text-fg transition hover:bg-white/[0.11] md:hidden"
          >
            <Icon name={menuOpen ? "fa-xmark" : "fa-bars"} className="text-sm" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id={MENU_ID} aria-label={t("นําทางหลัก")} className="safe-inline pb-3 pt-1 md:hidden">
          {NAV.map((l) => (
            <Link
              key={l.hash}
              href={`/#${l.hash}`}
              onClick={(e) => handleSectionClick(e, l.hash)}
              className="touch-min block rounded-md px-3 text-body-sm text-fg-muted transition hover:bg-white/[0.06] hover:text-fg"
            >
              {t(l.label)}
            </Link>
          ))}

          {active === "signin" ? (
            <Link href="/" className="btn-secondary mt-3 w-full whitespace-nowrap">
              <Icon name="fa-house" className="text-label" /> {t("หน้าแรก")}
            </Link>
          ) : (
            <Link href="/signin" className="btn-primary mt-3 w-full whitespace-nowrap">
              {t("เริ่มใช้งาน")} <Icon name="fa-arrow-right" className="text-label" />
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}