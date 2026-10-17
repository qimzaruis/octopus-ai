"use client";

/**
 * กัน event การคลิกลุกลามขึ้นไปถึง <summary> (ปิด/เปิด details)
 * ใช้ครอบส่วนควบคุม เช่น toggle switch / ปุ่มต่าง ๆ ที่อยู่บนหัวข้อ
 */
export default function StopPropagation({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}
