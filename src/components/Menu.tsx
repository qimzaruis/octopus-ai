"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";

export type MenuItem = {
  icon: string;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

/** ความสูงโดยประมาณของเมนู 1 รายการ ใช้คำนวณว่าควรพลิกไปด้านไหน */
const ITEM_H = 38;
const PANEL_PAD = 24;
const GAP = 6;
const EDGE = 8;

/**
 * Menu — ปุ่ม ⋮ (three-dot) ที่กางรายการคําสั่ง
 *
 * วาด panel ด้วย portal + position: fixed เพราะ sidebar มี scroll container ของตัวเอง
 * ถ้าวาง absolute แบบเดิม เมนูจะโดนตัดขอบ และทับชื่อแชทข้างใต้จนอ่านไม่ออก
 * ปิดได้ทั้งคลิกนอก, Escape, และเลื่อน/ขยายหน้าต่าง
 */
export default function Menu({
  items,
  label,
  align = "right",
  placement = "below",
  triggerClassName = "",
  widthPx = 208,
}: {
  items: MenuItem[];
  label: string;
  align?: "right" | "left";
  /** "below" = ลงใต้ปุ่ม (header) | "right" = ออกข้างขวา (รายการใน sidebar) */
  placement?: "below" | "right";
  triggerClassName?: string;
  widthPx?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function place() {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || typeof window === "undefined") return;
    const panelH = items.length * ITEM_H + PANEL_PAD;
    let top: number;
    let left: number;

    if (placement === "right") {
      top = rect.top;
      left = rect.right + GAP;
      if (left + widthPx > window.innerWidth - EDGE) left = rect.left - widthPx - GAP;
      if (top + panelH > window.innerHeight - EDGE) top = window.innerHeight - panelH - EDGE;
    } else {
      top = rect.bottom + GAP;
      left = align === "right" ? rect.right - widthPx : rect.left;
      if (top + panelH > window.innerHeight - EDGE) top = rect.top - panelH - GAP;
    }
    setPos({
      top: Math.max(EDGE, top),
      left: Math.min(Math.max(EDGE, left), window.innerWidth - widthPx - EDGE),
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    place();
    /* วาดแล้ววัดจริงอีกครั้ง: ประมาณการ ITEM_H คลาดได้ (ฉลากไทยสองบรรทัด, จอสัมผัส 44px)
       ถ้าคำนวณจากของประมาณ เมนูอาจล้นขอบล่างจอแล้วกดไม่ถึง */
    requestAnimationFrame(place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    /* panel เป็น fixed ที่ผูกกับปุ่ม: ตอนเลื่อนต้อง "ตามไปวางใหม่" ไม่ใช่ปิด
       เดิมปิดทุก scroll (capture=true) บนจอสัมผัสนิ้วปัดนิดเดียวก่อนแตะเมนูก็หายวับ
       และคนที่เลื่อนดูรายการยาว ๆ จะเปิดเมนูซ้ำไม่ทัน */
    const reposition = () => place();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`touch-min-icon flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-white/[0.08] hover:text-fg ${triggerClassName}`}
      >
        <Icon name="fa-ellipsis-vertical" className="text-base" />
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={label}
            style={{ top: pos.top, left: pos.left, width: widthPx }}
            className="animate-fade-in fixed z-[110] rounded-lg bg-ink-850 p-1.5 shadow-floating ring-1 ring-white/[0.1]"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`touch-min flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-caption transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.tone === "danger"
                    ? "text-rose-300 hover:bg-rose-500/10"
                    : "text-fg-muted hover:bg-white/[0.06] hover:text-fg"
                }`}
              >
                <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
