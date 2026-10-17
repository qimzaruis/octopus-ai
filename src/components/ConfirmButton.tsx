"use client";

/**
 * ปุ่ม submit ที่มีกล่องยืนยันก่อนส่ง form (เช่น ปุ่มลบ)
 */
export default function ConfirmButton({
  message,
  className = "btn-danger !py-1.5 !px-3 text-xs",
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
