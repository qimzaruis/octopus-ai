import Image from "next/image";

/**
 * โลโก้แบรนด์ — ใช้ไฟล์จริงที่ public/logo.png
 * กำหนด width/height ชัดเจนเพื่อไม่ให้เกิด layout shift (ตามเกตประสิทธิภาพ)
 */
export default function Logo({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Octopus AI"
      width={size}
      height={size}
      priority={size >= 30}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}