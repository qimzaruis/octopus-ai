"use client";

import { useT } from "@/lib/i18n/client";

/**
 * QuotaBar — แถบแสดงการใช้งานเทียบเพดาน
 * ใช้สีบอกระดับ (ปกติ = brand, ใกล้เต็ม = amber, เต็ม = rose) พร้อมข้อความกํากับ
 * ไม่ใช้สีเป็นตัวสื่อความหมายเดียว — มีตัวเลขและ label ประกอบเสมอ
 */
export default function QuotaBar({
  label,
  pct,
  usedLabel,
  totalLabel,
  hint,
}: {
  label: string;
  pct: number;
  usedLabel: string;
  totalLabel: string;
  hint?: string;
}) {
  const t = useT();
  const clamped = Math.max(0, Math.min(1, pct));
  const state =
    clamped >= 0.99 ? "full" : clamped >= 0.8 ? "near" : "ok";

  const fillTone =
    state === "full" ? "bg-rose-400/80" : state === "near" ? "bg-amber-glow/80" : "bg-brand-500/70";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-caption font-medium text-fg-muted">{label}</p>
        <p className="tnum text-caption text-fg-subtle">
          <span className="text-fg">{usedLabel}</span> / {totalLabel}
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-label={t("{label} ใช้ไป {n} เปอร์เซ็นต์", { label, n: Math.round(clamped * 100) })}
      >
        <div className={`h-full rounded-full ${fillTone}`} style={{ width: `${clamped * 100}%` }} />
      </div>
      <p className="mt-1.5 text-label text-fg-subtle">
        {state === "full" ? (
          <span className="text-rose-300">
            <i className="fa-solid fa-circle-exclamation mr-1" />
            {t("ใช้ครบเพดานรอบนี้แล้ว")}
          </span>
        ) : state === "near" ? (
          <span className="text-amber-glow">
            <i className="fa-solid fa-triangle-exclamation mr-1" />
            {t("ใกล้ถึงเพดานแล้ว")}
          </span>
        ) : (
          <span>{hint ?? t("ใช้ไป {n}%", { n: Math.round(clamped * 100) })}</span>
        )}
      </p>
    </div>
  );
}