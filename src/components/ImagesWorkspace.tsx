"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import type { ChatConversation } from "@/lib/chat/db";

const COLLAPSE_KEY = "octopus.agent.sidebar.collapsed";

type AgentFile = {
  id: string;
  conversationId: string;
  name: string;
  kind: string;
  sizeBytes: number;
  shareUrl: string | null;
  shareExpiresAt: string | null;
  createdAt: string;
};

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
  children,
}: {
  userName: string;
  conversations: ChatConversation[];
  children: ReactNode;
}) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [filesOpen, setFilesOpen] = useState(false);
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesNotice, setFilesNotice] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  async function openFiles() {
    setDrawerOpen(false);
    setFilesOpen(true);
    setFilesLoading(true);
    setFilesNotice(null);
    try {
      const res = await fetch("/api/agent/files", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { files: AgentFile[] };
      setFiles(data.files);
    } catch {
      setFilesNotice(t("โหลดคลังไฟล์ไม่สำเร็จ"));
    } finally {
      setFilesLoading(false);
    }
  }

  async function downloadFile(file: AgentFile) {
    try {
      const res = await fetch(`/api/agent/files/${file.id}?download=1`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name || "artifact.html";
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setFilesNotice(t("ดาวน์โหลดไม่สำเร็จ ลองอีกครั้ง"));
    }
  }

  async function shareFile(file: AgentFile) {
    setSharingId(file.id);
    setFilesNotice(null);
    try {
      const res = await fetch(`/api/agent/files/${file.id}/share`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        shareUrl?: string;
        expiresAt?: string;
      } | null;
      if (!res.ok || !data?.shareUrl) {
        setFilesNotice(t("แชร์ไม่สำเร็จ ลองอีกครั้ง"));
        return;
      }
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, shareUrl: data.shareUrl!, shareExpiresAt: data.expiresAt ?? null }
            : f,
        ),
      );
    } catch {
      setFilesNotice(t("แชร์ไม่สำเร็จ ลองอีกครั้ง"));
    } finally {
      setSharingId(null);
    }
  }

  async function copyShare(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* เบราว์เซอร์บล็อก clipboard */
    }
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
        <button
          type="button"
          onClick={() => void openFiles()}
          title={t("คลังไฟล์")}
          className={`touch-min flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-caption font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-folder-open" className="h-4 w-4 shrink-0 text-brand-300" />
          {!collapsed && <span>{t("คลังไฟล์")}</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            className="touch-min flex w-full select-none items-center gap-2 rounded-md px-4 py-2 text-left text-micro font-semibold uppercase tracking-[0.16em] text-fg-subtle transition hover:bg-white/[0.05] hover:text-fg"
          >
            <span className="flex-1">{t("ประวัติแชท")}</span>
            <Icon
              name="fa-chevron-down"
              className={`shrink-0 text-micro transition-transform duration-fast ${
                historyOpen ? "" : "-rotate-90"
              }`}
            />
          </button>
          {historyOpen && (
            <>
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
                  historyGroups.map((group) => {
                    const closed = collapsedGroups.has(group.key);
                    return (
                      <div key={group.key} className="mb-2">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          aria-expanded={!closed}
                          className="touch-min flex w-full select-none items-center gap-1.5 rounded-md px-3 py-1.5 text-left text-micro font-semibold uppercase tracking-[0.14em] text-fg-subtle/80 transition hover:bg-white/[0.05] hover:text-fg"
                        >
                          <span className="flex-1">{group.label}</span>
                          <Icon
                            name="fa-chevron-down"
                            className={`shrink-0 text-micro transition-transform duration-fast ${
                              closed ? "-rotate-90" : ""
                            }`}
                          />
                        </button>
                        {!closed && (
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
                        )}
                      </div>
                    );
                  })
                )}
              </nav>
            </>
          )}
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
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(5rem_+_env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] sm:pt-5">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>

        {/* หน้าไม่มี header — ปุ่มเมนูมือถือลอยมุมขวาล่าง */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t("เปิดเมนู")}
          aria-haspopup="dialog"
          className="fixed bottom-[calc(1rem_+_env(safe-area-inset-bottom))] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-fg shadow-floating transition active:scale-95 lg:hidden"
        >
          <Icon name="fa-bars" />
        </button>
      </div>

      {/* คลังไฟล์ — เปิดในหน้านี้เลย ไม่เด้งไปหน้าแชท */}
      {filesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setFilesOpen(false)}
            aria-hidden
          />
          <aside className="animate-fade-in relative flex h-full w-full max-w-md flex-col border-l border-white/[0.07] bg-ink-900">
            <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-4">
              <Icon name="fa-folder-open" className="text-brand-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-semibold text-fg">{t("คลังไฟล์")}</p>
                <p className="truncate text-micro text-fg-subtle">
                  {t("ไฟล์ที่ AI สร้างให้ในแชทของคุณ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilesOpen(false)}
                aria-label={t("ปิดเมนู")}
                className="touch-min-icon rounded-md p-1.5 text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg"
              >
                <Icon name="fa-xmark" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {filesNotice && (
                <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-caption text-amber-300">
                  <Icon name="fa-triangle-exclamation" className="mr-1.5" />
                  {filesNotice}
                </p>
              )}
              {filesLoading ? (
                <p className="px-2 py-10 text-center text-caption text-fg-subtle">
                  <Icon name="fa-circle-notch" className="mr-2 animate-spin" />
                  {t("กำลังโหลด...")}
                </p>
              ) : files.length === 0 ? (
                <p className="px-2 py-10 text-center text-caption text-fg-subtle">
                  {t("ยังไม่มีไฟล์ — ลองให้ AI สร้างหน้า HTML หรือ artifact ในแชท")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {files.map((f) => {
                    const shareAlive =
                      Boolean(f.shareUrl) &&
                      Boolean(f.shareExpiresAt) &&
                      new Date(f.shareExpiresAt!).getTime() > Date.now();
                    return (
                      <li
                        key={f.id}
                        className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-300">
                            <Icon name={f.kind === "html" ? "fa-code" : "fa-file"} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-caption font-medium text-fg">{f.name}</p>
                            <p className="mt-0.5 text-micro text-fg-subtle">
                              {f.createdAt.slice(0, 10)} · {(f.sizeBytes / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void downloadFile(f)}
                            title={t("ดาวน์โหลด")}
                            className="rounded-md p-1.5 text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg"
                          >
                            <Icon name="fa-download" />
                          </button>
                        </div>

                        {shareAlive ? (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-2.5">
                            <a
                              href={f.shareUrl!}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost !py-1.5 text-label"
                            >
                              <Icon name="fa-arrow-up-right-from-square" className="text-micro" />{" "}
                              {t("เปิดลิงก์")}
                            </a>
                            <button
                              type="button"
                              onClick={() => void copyShare(f.shareUrl!)}
                              className="btn-ghost !py-1.5 text-label"
                            >
                              <Icon name="fa-copy" className="text-micro" /> {t("คัดลอกลิงก์")}
                            </button>
                            <span className="ml-auto text-micro text-fg-subtle">
                              {t("ลิงก์สาธารณะถึง {date}", {
                                date: f.shareExpiresAt!.slice(0, 10),
                              })}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2.5 border-t border-white/[0.07] pt-2.5">
                            <button
                              type="button"
                              onClick={() => void shareFile(f)}
                              disabled={sharingId === f.id}
                              className="btn-secondary !py-1.5 text-label disabled:opacity-50"
                            >
                              <Icon
                                name={
                                  sharingId === f.id
                                    ? "fa-circle-notch animate-spin"
                                    : "fa-share-nodes"
                                }
                                className="text-micro"
                              />{" "}
                              {t("แชร์เป็นลิงก์สาธารณะ")}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
