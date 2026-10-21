"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import Badge from "@/components/Badge";
import { useT } from "@/lib/i18n/client";
import type { ChatConversation } from "@/lib/chat/db";

const COLLAPSE_KEY = "octopus.agent.sidebar.collapsed";

function PanelIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M9 3v18" />
    </svg>
  );
}

/**
 * กรอบหน้าสร้างรูปให้เหมือนโหมด Web Agent — sidebar ตัวเดียวกัน
 * เปลี่ยนแค่ main content เป็น ImageStudio
 */
export default function ImagesWorkspace({
  userName,
  conversations,
  modelCount,
  children,
}: {
  userName: string;
  conversations: ChatConversation[];
  modelCount: number;
  children: ReactNode;
}) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");

  // ใช้ค่าการย่อ/ขยายร่วมกับหน้าแชท (คีย์เดียวกัน)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      let stored = false;
      try {
        stored = localStorage.getItem(COLLAPSE_KEY) === "1";
      } catch {
        /* ignore */
      }
      setCollapsed(mq.matches && stored);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const titleOf = (c: ChatConversation) => c.title?.trim() || t("แชทใหม่");

  const historyGroups = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    const filtered = q
      ? conversations.filter((c) => titleOf(c).toLowerCase().includes(q))
      : conversations;
    const groups: { key: string; label: string; items: ChatConversation[] }[] = [
      { key: "today", label: t("วันนี้"), items: [] },
      { key: "yesterday", label: t("เมื่อวาน"), items: [] },
      { key: "week", label: t("7 วันล่าสุด"), items: [] },
      { key: "older", label: t("เก่ากว่า"), items: [] },
    ];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const DAY = 86_400_000;
    for (const c of filtered) {
      const d = new Date(c.updatedAt || c.createdAt);
      if (Number.isNaN(d.getTime())) {
        groups[3].items.push(c);
        continue;
      }
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const diff = Math.round((todayStart - start) / DAY);
      const idx = diff <= 0 ? 0 : diff === 1 ? 1 : diff <= 7 ? 2 : 3;
      groups[idx].items.push(c);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [conversations, historyQuery, t]);

  const asideBody = (
    <>
      <div className={`flex h-14 shrink-0 items-center gap-2 px-3 ${collapsed ? "justify-center px-2" : ""}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label={t("ขยายแถบข้าง")}
            title={t("ขยายแถบข้าง")}
            className="group/head relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition hover:bg-white/[0.08]"
          >
            <Logo size={30} className="transition-opacity duration-150 group-hover/head:opacity-0" />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-fg opacity-0 transition-opacity duration-150 group-hover/head:opacity-100">
              <PanelIcon />
            </span>
          </button>
        ) : (
          <>
            <Logo size={30} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-body-sm font-semibold tracking-tight text-fg">
              Web <span className="text-brand-300">Agent</span>
            </span>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label={t("ย่อแถบข้าง")}
              title={t("ย่อแถบข้าง")}
              className="touch-min-icon hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition hover:bg-white/[0.08] hover:text-fg lg:flex"
            >
              <PanelIcon />
            </button>
          </>
        )}
      </div>

      <div className="space-y-1 px-3">
        <Link
          href="/agent"
          onClick={() => setDrawerOpen(false)}
          title={t("แชทใหม่")}
          className={`touch-min flex w-full items-center gap-2.5 rounded-lg bg-brand-500/90 px-3 py-2.5 text-caption font-semibold text-fg transition hover:bg-brand-500 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-square-pen" className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t("แชทใหม่")}</span>}
        </Link>
        <Link
          href="/images"
          onClick={() => setDrawerOpen(false)}
          aria-current="page"
          title={t("สร้างรูปภาพ")}
          className={`touch-min flex w-full items-center gap-2.5 rounded-lg bg-white/[0.10] px-3 py-2.5 text-caption font-medium text-fg ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-image" className="h-4 w-4 shrink-0 text-brand-300" />
          {!collapsed && <span>{t("สร้างรูป")}</span>}
        </Link>
        <Link
          href="/agent?files=1"
          onClick={() => setDrawerOpen(false)}
          title={t("คลังไฟล์")}
          className={`touch-min flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-caption font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-folder-open" className="h-4 w-4 shrink-0 text-brand-300" />
          {!collapsed && <span>{t("คลังไฟล์")}</span>}
        </Link>
      </div>

      {!collapsed && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <p className="px-4 pb-2 text-micro font-semibold uppercase tracking-[0.16em] text-fg-subtle">
            {t("ประวัติแชท")}
          </p>
          {conversations.length > 0 && (
            <div className="relative mb-1.5 px-2">
              <Icon
                name="fa-magnifying-glass"
                className="pointer-events-none absolute left-[1.3rem] top-1/2 -translate-y-1/2 text-micro text-fg-subtle"
              />
              <input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder={t("ค้นหาแชท")}
                aria-label={t("ค้นหาแชท")}
                type="search"
                className="h-10 w-full rounded-md bg-white/[0.04] pl-8 pr-11 text-caption text-fg outline-none transition placeholder:text-fg-subtle hover:bg-white/[0.06] focus:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-white/[0.14] focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden"
              />
              {historyQuery && (
                <button
                  type="button"
                  onClick={() => setHistoryQuery("")}
                  aria-label={t("ล้างคำค้น")}
                  className="touch-min-icon absolute right-0.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-micro text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg"
                >
                  <Icon name="fa-xmark" />
                </button>
              )}
            </div>
          )}
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {conversations.length === 0 ? (
              <p className="px-3 py-2 text-label text-fg-subtle">{t("ยังไม่มีประวัติแชท")}</p>
            ) : historyGroups.length === 0 ? (
              <p className="px-3 py-2 text-label text-fg-subtle">{t("ไม่พบแชทที่ตรงกัน")}</p>
            ) : (
              historyGroups.map((group) => (
                <div key={group.key} className="mb-2">
                  <p className="px-3 pb-1 pt-1.5 text-micro font-semibold uppercase tracking-[0.14em] text-fg-subtle/80">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/c/${c.id}`}
                          title={titleOf(c)}
                          onClick={() => setDrawerOpen(false)}
                          className="flex min-h-11 items-center rounded-md px-3 py-2 text-caption text-fg-muted transition hover:bg-white/[0.06] hover:text-fg"
                        >
                          <span className="truncate">{titleOf(c)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </nav>
        </div>
      )}
      {collapsed && <div className="flex-1" />}

      <div className={`shrink-0 border-t border-white/[0.07] p-3 ${collapsed ? "text-center" : ""}`}>
        {!collapsed && <p className="mb-2 truncate px-1 text-label text-fg-subtle">{userName}</p>}
        <Link
          href="/dashboard"
          title={t("กลับหน้าหลัก")}
          className={`touch-min flex items-center gap-2.5 rounded-md px-3 py-2 text-caption text-fg-muted transition hover:bg-white/[0.06] hover:text-fg ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-arrow-left" className="h-4 w-4 shrink-0 text-label" />
          {!collapsed && <span>{t("กลับหน้าหลัก")}</span>}
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-ink-950">
      <aside
        className={`hidden shrink-0 flex-col border-r border-white/[0.07] bg-ink-900 transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[4.5rem]" : "w-72"
        }`}
      >
        {asideBody}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} aria-hidden />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={t("เมนูแชทและประวัติ")}
            className="animate-drawer-in absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col border-r border-white/[0.07] bg-ink-900 outline-none pt-[env(safe-area-inset-top)]"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label={t("ปิดเมนู")}
              className="touch-min-icon absolute right-3 top-[calc(0.75rem_+_env(safe-area-inset-top))] z-10 rounded-md p-1.5 text-fg-subtle transition hover:text-fg"
            >
              <Icon name="fa-xmark" />
            </button>
            {asideBody}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-1.5 border-b border-white/[0.06] px-3 pt-[env(safe-area-inset-top)] sm:gap-2 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("เปิดเมนู")}
            aria-haspopup="dialog"
            className="touch-min-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition hover:bg-white/[0.08] hover:text-fg lg:hidden"
          >
            <Icon name="fa-bars" />
          </button>
          <Link
            href="/dashboard"
            aria-label={t("กลับ Dashboard")}
            className="touch-min inline-flex shrink-0 items-center gap-2 rounded-md px-2 text-caption font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg"
          >
            <Icon name="fa-arrow-left" className="text-micro" />
            <span className="hidden text-micro sm:inline sm:text-caption">{t("กลับ Dashboard")}</span>
          </Link>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-body-sm font-semibold text-fg">{t("สร้างรูปภาพ")}</p>
            <p className="hidden truncate text-label text-fg-subtle sm:block">
              {t("บอกสิ่งที่ต้องการ เลือกสัดส่วน และแนบรูปเป็นอ้างอิงได้")}
            </p>
          </div>
          <Badge tone="brand" icon="fa-solid fa-wand-magic-sparkles">
            {t("{n} โมเดล", { n: modelCount })}
          </Badge>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pt-5">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
