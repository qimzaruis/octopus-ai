"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { formatUsd } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";

export type NavItem = { href: string; label: string; icon: string };
export type NavSection = { title: string; items: NavItem[] };

const ROLE_LABEL: Record<string, string> = { admin: "ผู้ดูแลระบบ", user: "ผู้ใช้" };

/**
 * Sidebar — แถบนําทางหลัก
 * จอ >= lg: แถบข้าง sticky เต็มความสูง
 * จอเล็ก: drawer เลื่อนจากซ้าย + ปุ่มลอย
 * ไม่ใช้ backdrop-blur บนแถบข้าง (เป็นพื้นที่ขนาดใหญ่และอยู่นิ่ง ๆ ตลอด)
 */
export default function Sidebar({
  sections,
  email,
  name,
  role,
  plan,
  credits,
}: {
  sections: NavSection[];
  email: string;
  name: string;
  role: string;
  plan: string;
  credits: number;
}) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  /* drawer บนมือถือคือ modal จริง: Escape ปิด, ล็อกสครอลล์หลังผ้าม่าน,
     ย้าย focus เข้าแผงตอนเปิดและคืนให้ปุ่มเดิมตอนปิด
     (Dialog ทำอยู่แล้ว —Drawer ต้องเหมือนกัน ไม่งั้นผู้ใช้คีย์บอร์ดติดอยู่หลัง scrim) */
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  // ปิดเมนูบัญชีเมื่อคลิกนอกพื้นที่ หรือกด Escape
  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  // ปิดเมนูบัญชีทุกครั้งที่เปลี่ยนหน้า
  useEffect(() => {
    setAccountOpen(false);
  }, [pathname]);

  const navContent = (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5 pr-11">
        <Logo size={28} />
        <span className="text-body-sm font-semibold tracking-tight text-fg">
          Octopus <span className="text-brand-300">AI</span>
        </span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((sec) => (
          <div key={sec.title}>
            <p className="px-3 pb-2 text-micro font-semibold uppercase tracking-[0.16em] text-fg-subtle">
              {sec.title}
            </p>
            <ul className="space-y-0.5">
              {sec.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`touch-min relative flex items-center gap-3 rounded-md px-3 py-2.5 text-body-sm font-medium transition-colors duration-fast ${
                        active
                          ? "bg-white/[0.08] text-fg"
                          : "text-fg-muted hover:bg-white/[0.05] hover:text-fg"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-400 transition-opacity duration-fast ${
                          active ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <Icon
                        name={item.icon}
                        className={`h-4 w-4 shrink-0 ${
                          active ? "text-brand-300" : ""
                        }`}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-3">
        <Link
          href="/credits"
          onClick={() => setOpen(false)}
          className="flex items-center justify-between rounded-md bg-white/[0.05] px-3.5 py-3 transition-colors duration-fast hover:bg-white/[0.09]"
        >
          <div>
            <p className="text-micro font-medium uppercase tracking-wider text-fg-subtle">
              {t("เครดิตคงเหลือ")}
            </p>
            <p className="tnum mt-0.5 text-body-sm font-semibold text-fg">
              {formatUsd(credits)}{" "}
              <span className="text-micro font-medium text-fg-subtle">USD</span>
            </p>
          </div>
          <Icon name="fa-coins" className="text-amber-glow" />
        </Link>
      </div>

      <div ref={accountRef} className="relative p-3">
        {accountOpen && (
          <div
            role="menu"
            aria-label={t("เมนูบัญชี")}
            className="animate-fade-in absolute inset-x-3 bottom-[calc(100%-0.25rem)] z-10 rounded-lg bg-ink-850 p-1.5 shadow-floating"
          >
            <div className="px-3 py-3">
              <p className="truncate text-body-sm font-medium text-fg">{name}</p>
              <p className="truncate text-label text-fg-subtle" title={email}>
                {email}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-micro text-fg-subtle">
                <Icon name="fa-circle-user" />
                {t(ROLE_LABEL[role] ?? role)}
              </p>
            </div>
            <div className="mx-1.5 border-t border-white/[0.07]" />
            <a
              href="/auth/signout"
              role="menuitem"
              className="mt-1.5 flex items-center gap-2.5 rounded-md px-3 py-2.5 text-body-sm font-medium text-fg-muted transition-colors duration-fast hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Icon name="fa-arrow-right-from-bracket" className="h-4 w-4 shrink-0" />
              {t("ออกจากระบบ")}
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAccountOpen((v) => !v)}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          className="flex w-full items-center gap-3 rounded-md bg-white/[0.04] p-2.5 text-left transition-colors duration-fast hover:bg-white/[0.08]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-body-sm font-semibold text-fg">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-body-sm font-medium text-fg">
              {name}
              <span
                className={`shrink-0 rounded px-1 py-0.5 text-micro font-semibold uppercase ${
                  plan === "free"
                    ? "bg-white/[0.08] text-fg-subtle"
                    : "bg-brand-500/20 text-brand-300"
                }`}
              >
                {plan}
              </span>
            </p>
            <p className="truncate text-label text-fg-subtle">{email}</p>
          </div>
          <Icon
            name="fa-chevron-up"
            className={`shrink-0 text-micro text-fg-subtle transition-transform duration-fast ${
              accountOpen ? "" : "rotate-180"
            }`}
          />
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.07] bg-ink-900 lg:flex">
        {navContent}
      </aside>

      {/* fab-dock = เลื่อนพ้น home indicator และขอบจอแนวนอน (ห้ามใส่ bottom/left ซ้ำ) */}
      <button
        onClick={() => setOpen(true)}
        aria-label={t("เปิดเมนู")}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="fab-dock fixed z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-fg shadow-floating transition active:scale-95 lg:hidden"
      >
        <Icon name="fa-bars" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* w-[min(18rem,88vw)]: ที่ 360px แถบ 288px กินพื้นที่ 80% ของจอ
              เหลือ scrim บางจนปิดเมนูผิดจังหวะ — 88vw เว้นมือจับไว้ชัดขึ้น */}
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("เมนูหลัก")}
            tabIndex={-1}
            className="animate-drawer-in absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col border-r border-white/[0.07] bg-ink-900 outline-none pt-[env(safe-area-inset-top)]"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label={t("ปิดเมนู")}
              className="touch-min-icon absolute right-3 top-[calc(0.75rem_+_env(safe-area-inset-top))] z-10 rounded-md p-1.5 text-fg-subtle transition hover:text-fg"
            >
              <Icon name="fa-xmark" />
            </button>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}