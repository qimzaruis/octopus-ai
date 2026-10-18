"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/Dialog";
import { useT } from "@/lib/i18n/client";

/**
 * ปุ่มที่ยืนยันด้วย Dialog ของแอปก่อนส่งฟอร์ม (แทน confirm() ของเบราว์เซอร์
 * ที่คุมหน้าตาไม่ได้และบล็อกเธรดหลัก)
 *
 * ยังทำงานกับ server action เดิมได้ เพราะหลังกดยืนยันเราจะเรียก requestSubmit()
 * บนฟอร์มที่ห่อปุ่มอยู่นี้
 */
export default function ConfirmButton({
  message,
  title,
  confirmLabel,
  className = "btn-danger !py-1.5 !px-3 text-xs",
  children,
}: {
  message: string;
  title?: string;
  confirmLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={btnRef} type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={title ?? t("ยืนยันการทำรายการนี้")}
        message={message}
        confirmLabel={confirmLabel ?? t("ยืนยัน")}
        cancelLabel={t("ยกเลิก")}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          btnRef.current?.closest("form")?.requestSubmit();
        }}
      />
    </>
  );
}
