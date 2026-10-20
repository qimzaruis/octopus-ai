"use client";

import { useState, type ReactNode } from "react";
import Icon from "@/components/Icon";

/**
 * การ์ดที่กดหัวเพื่อย่อ/ขยายได้ — ใช้ในหน้าแอดมินที่มีรายการยาว ๆ
 * ปุ่มจัดการ (สวิตช์/ลบ) อยู่นอกพื้นที่กด จึงไม่toggle การ์ดโดยไม่ตั้งใจ
 */
export default function Collapsible({
  header,
  actions,
  children,
  defaultOpen = false,
}: {
  header: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand-400/60"
        >
          {header}
          <Icon
            name="fa-chevron-down"
            className={`ml-auto shrink-0 text-xs text-fg-subtle transition-transform duration-fast ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {open && <div className="border-t border-white/[0.07] p-4 sm:p-5">{children}</div>}
    </div>
  );
}
