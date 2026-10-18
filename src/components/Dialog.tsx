"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * Dialog — กล่องโต้ตอบกลางจอ ใช้แทน alert/confirm ของเบราว์เซอร์
 *
 * ของเดิมเป็นกล่องของระบบที่คุมหน้าตาไม่ได้ สีไม่เข้ากับธีม และปิดกั้นเธรด
 * ตัวนี้จึงเป็น component เดียวที่ใช้ซ้ำทุกที่ (ยืนยันลบ, แก้ชื่อ, รายละเอียดโมเดล)
 *
 * พฤติกรรมมาตรฐานที่ควรมี: Escape ปิด, คลิกหลังม่านปิด, ล็อก scroll ข้างหลัง,
 * ย้าย focus เข้ากล่องแล้วคืน focus เดิมตอนปิด และ render ผ่าน portal
 * เพื่อให้ไม่โดน container ที่ overflow-hidden หรือ transform กลืนเอาไป
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  icon,
  iconTone = "brand",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZES;
  icon?: string;
  iconTone?: "brand" | "danger" | "aqua";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    /* จอมือถือ: อย่า autofocus ช่องกรอก — คีย์บอร์ดจะเด้งบังปุ่มกดยืนยันของ sheet ทันที
       ให้ focus ที่ตัว panel (Escape/Tab ยังทำงาน) แล้วให้ผู้ใช้แตะช่องเอง
       จอมีเมาส์ยังเข้าช่องให้เลยตามเดิม เพราะพิมพ์ต่อได้ทันที */
    const focusTimer = window.setTimeout(() => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const firstField = panelRef.current?.querySelector<HTMLElement>(
        "input, textarea, select",
      );
      (coarse ? panelRef.current : (firstField ?? panelRef.current))?.focus();
    }, 30);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const toneClass =
    iconTone === "danger"
      ? "bg-rose-500/12 text-rose-300"
      : iconTone === "aqua"
        ? "bg-aqua/12 text-aqua"
        : "bg-brand-500/15 text-brand-300";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`sheet-safe-bottom animate-pop-in relative w-full ${SIZES[size]} max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-ink-900 shadow-floating outline-none ring-1 ring-white/[0.07] sm:rounded-xl`}
      >
        <div className="flex items-start gap-3 border-b border-white/[0.07] px-5 py-4">
          {icon && (
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
            >
              <Icon name={icon} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-body font-semibold text-fg">{title}</h2>
            {description && (
              <p className="mt-1 text-caption leading-relaxed text-fg-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="touch-min-icon -mr-1 shrink-0 rounded-md p-1.5 text-fg-subtle transition hover:bg-white/[0.06] hover:text-fg"
          >
            <Icon name="fa-xmark" />
          </button>
        </div>

        {children && <div className="px-5 py-4">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** กล่องยืนยันผล — ใช้แทน confirm() เดิม (มีสถานะกําลังทํางานกันกดซ้ำ) */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  tone?: "danger" | "brand";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onCancel}
      title={title}
      description={message}
      icon={tone === "danger" ? "fa-triangle-exclamation" : "fa-circle-question"}
      iconTone={tone === "danger" ? "danger" : "brand"}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onCancel} className="btn-quiet" disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={
              tone === "danger"
                ? "inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500/90 px-4 py-2.5 text-body-sm font-semibold text-fg transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                : "btn-primary"
            }
          >
            {busy && <Icon name="fa-circle-notch" className="animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

/** เมนูเล็กที่ผูกกับ Dialog — ใช้กับ Dialog อื่นได้โดยส่ง children เข้าไป */
export function DialogRow({
  icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: string;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-body-sm transition-colors duration-fast ${
        tone === "danger"
          ? "text-rose-300 hover:bg-rose-500/10"
          : "text-fg-muted hover:bg-white/[0.06] hover:text-fg"
      }`}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

/** ปุ่มที่ยืนยันด้วย Dialog ก่อนทํางาน (ใช้แทน ConfirmButton ที่เคยเรียก confirm()) */
export function ConfirmActionButton({
  title,
  message,
  confirmLabel,
  className = "btn-danger !py-1.5 !px-3 text-caption",
  icon,
  children,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  className?: string;
  icon?: string;
  children: React.ReactNode;
  onConfirm: () => void | Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {icon && <Icon name={icon} />}
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        cancelLabel={t("ยกเลิก")}
        busy={busy}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
