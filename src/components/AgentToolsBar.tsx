"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useT } from "@/lib/i18n/client";

/**
 * แถบเครื่องมือของเอเจนต์ — โฟลเดอร์งานบนเครื่องผู้ใช้ + สิทธิ์การเขียนไฟล์
 *
 * การค้นเว็บไม่ต้องตั้งค่าอะไรในนี้: ฝั่งเซิร์ฟเวอร์ใช้คีย์ Bright Data ของระบบ
 * ถ้าโควตาหมด เอเจนต์จะแจ้งผู้ใช้เองตอนเรียกเครื่องมือ (ดูแถบเตือนด้านบนช่องพิมพ์)
 */
export default function AgentToolsBar({
  workspaceName,
  canPick,
  autoWrite,
  onPick,
  onDisconnect,
  onAutoWriteChange,
}: {
  workspaceName: string | null;
  canPick: boolean;
  autoWrite: boolean;
  onPick: () => void;
  onDisconnect: () => void;
  onAutoWriteChange: (value: boolean) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={onPick}
        disabled={!canPick}
        title={
          canPick
            ? t("เลือกโฟลเดอร์งานบนเครื่องของคุณ")
            : t("เบราว์เซอร์นี้ยังไม่รองรับการเลือกโฟลเดอร์ (ใช้ Chrome หรือ Edge)")
        }
        className={`flex max-w-[10rem] items-center gap-1.5 rounded-full px-2.5 py-1.5 text-caption transition-colors duration-fast ${
          workspaceName
            ? "bg-leaf/10 text-leaf hover:bg-leaf/15"
            : "bg-white/[0.06] text-fg-muted hover:bg-white/[0.11] hover:text-fg"
        } disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <Icon name="fa-folder-open" className="shrink-0 text-micro" />
        <span className="truncate font-medium">
          {workspaceName ?? t("เลือกโฟลเดอร์งาน")}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("ตั้งค่าเครื่องมือเอเจนต์")}
        title={t("ตั้งค่าเครื่องมือเอเจนต์")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-muted transition hover:bg-white/[0.08] hover:text-fg"
      >
        <Icon name="fa-gear" />
      </button>

      {open && (
        <div className="animate-fade-in absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-ink-850 p-4 shadow-floating ring-1 ring-white/[0.07]">
          <p className="text-label font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            {t("โฟลเดอร์งาน")}
          </p>
          <p className="mt-1 text-caption leading-relaxed text-fg-muted">
            {workspaceName
              ? t("เอเจนต์อ่านและแก้ไฟล์ได้ในโฟลเดอร์ {name}", { name: workspaceName })
              : t("ยังไม่ได้เลือก — เอเจนต์จะค้นหาเว็บได้อย่างเดียว")}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onPick}
              disabled={!canPick}
              className="rounded-md bg-white/[0.07] px-2.5 py-1.5 text-caption text-fg transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="fa-folder-open" className="mr-1.5 text-micro" />
              {workspaceName ? t("เปลี่ยนโฟลเดอร์") : t("เลือกโฟลเดอร์")}
            </button>
            {workspaceName && (
              <button
                type="button"
                onClick={onDisconnect}
                className="rounded-md px-2.5 py-1.5 text-caption text-fg-muted transition hover:bg-white/[0.07] hover:text-rose-300"
              >
                {t("ถอดการเชื่อมต่อ")}
              </button>
            )}
          </div>

          <label className="mt-3.5 flex items-start gap-2.5 border-t border-white/[0.07] pt-3 text-caption text-fg-muted">
            <input
              type="checkbox"
              checked={autoWrite}
              onChange={(ev) => onAutoWriteChange(ev.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
            />
            <span>
              {t("เขียนไฟล์ได้ทันทีโดยไม่ต้องขออนุญาตทุกครั้ง")}
              <span className="mt-0.5 block text-micro text-fg-subtle">
                {t("การลบไฟล์จะขอยืนยันเสมอ")}
              </span>
            </span>
          </label>

          <p className="mt-3 border-t border-white/[0.07] pt-3 text-micro leading-relaxed text-fg-subtle">
            <Icon name="fa-magnifying-glass" className="mr-1.5" />
            {t("การค้นเว็บใช้โควตาของระบบ (Google ผ่าน Bright Data) ไม่ต้องใส่คีย์ในเครื่องคุณ")}
          </p>
        </div>
      )}
    </div>
  );
}
