"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { useT } from "@/lib/i18n/client";

/**
 * ปุ่มคัดลอกข้อความ — ใช้คัดลอกชื่อโมเดลไปวางในโค้ด
 *
 * ต้องเป็น client component เพราะใช้ Clipboard API
 * แสดงสถานะ "คัดลอกแล้ว" ชั่วครู่ แล้วกลับเป็นปกติ
 */
export default function CopyButton({
  value,
  label,
  iconOnly = false,
  className = "",
}: {
  value: string;
  label?: string;
  /** แสดงเฉพาะไอคอน (ใช้ในรายการที่พื้นที่จำกัด) */
  iconOnly?: boolean;
  className?: string;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // เบราว์เซอร์ไม่อนุญาต clipboard (เช่นไม่ใช่ https) — ไม่ต้องทำอะไร
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={t("คัดลอก {value}", { value })}
      aria-label={t("คัดลอก {value}", { value })}
      className={`inline-flex items-center rounded-md border border-white/[0.07] bg-white/5 text-caption text-fg-muted transition hover:bg-white/[0.09] hover:text-fg ${
        iconOnly ? "touch-min-icon h-8 w-8 justify-center px-0 py-0" : "touch-min gap-1.5 px-2 py-1"
      } ${className}`}
    >
      <Icon
        name={copied ? "fa-check" : "fa-copy"}
        className={`text-micro ${copied ? "text-leaf" : ""}`}
      />
      {!iconOnly && (copied ? t("คัดลอกแล้ว") : (label ?? t("คัดลอก")))}
    </button>
  );
}