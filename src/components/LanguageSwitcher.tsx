"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import { setLocaleAction } from "@/lib/i18n/actions";
import Icon from "@/components/Icon";

/**
 * LanguageSwitcher — เมนูสลับภาษา TH/EN
 *
 * เลือกใช้ปุ่มแบบ dropdown ที่กดแล้วสลับทันที (ไม่ใช่ <select>) เพื่อให้คุมหน้าตาได้
 * และเข้าถึงง่ายด้วยคีย์บอร์ด
 *
 * หลังบันทึก cookie เสร็จเรียก router.refresh() เพื่อให้ server component ทั้งหน้า
 * render ใหม่ด้วยภาษาใหม่ — เนื้อหาที่แปลไว้จะเปลี่ยนพร้อมกันทั้งหน้าโดยไม่ต้องโหลดซ้ำ
 * (ใช้ useTransition ให้ปุ่มแสดงสถานะกําลังทํางานระหว่างรอ และกันกดซ้ํา)
 *
 * variant: "nav" สําหรับแถบ public, "compact" สําหรับ topbar ในแอป
 */
export default function LanguageSwitcher({ variant = "nav" }: { variant?: "nav" | "compact" }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  const isCompact = variant === "compact";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("เปลี่ยนภาษา")}
        className={`flex items-center gap-1.5 rounded-md transition-colors duration-fast disabled:opacity-50 ${
          isCompact
            ? "bg-white/[0.05] px-2.5 py-2 text-caption font-medium text-fg-muted hover:bg-white/[0.09] hover:text-fg"
            : "px-3 py-2 text-body-sm text-fg-muted hover:bg-white/[0.06] hover:text-fg"
        }`}
      >
        {pending ? (
          <Icon name="fa-circle-notch" className="animate-spin text-micro" />
        ) : (
          <Icon name="fa-globe" className="text-micro" />
        )}
        <span className="font-semibold">{LOCALE_LABEL[locale]}</span>
      </button>

      {open && (
        <>
          {/* คลิกนอกเมนูเพื่อปิด */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            aria-label={t("เปลี่ยนภาษา")}
            className="animate-fade-in absolute right-0 top-[calc(100%+0.35rem)] z-20 min-w-[9rem] rounded-lg bg-ink-850 p-1.5 shadow-floating"
          >
            {LOCALES.map((l) => (
              <button
                key={l}
                role="menuitemradio"
                aria-checked={l === locale}
                onClick={() => choose(l)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-body-sm transition-colors duration-fast ${
                  l === locale
                    ? "bg-white/[0.08] text-fg"
                    : "text-fg-muted hover:bg-white/[0.06] hover:text-fg"
                }`}
              >
                <span>
                  {LOCALE_LABEL[l]}
                  <span className="ml-2 text-caption text-fg-subtle">
                    {t(l === "th" ? "ไทย" : "อังกฤษ")}
                  </span>
                </span>
                {l === locale && <Icon name="fa-check" className="text-micro text-brand-300" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}