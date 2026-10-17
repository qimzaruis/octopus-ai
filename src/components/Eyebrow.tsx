/**
 * Eyebrow — ป้ายเล็กเหนือหัวข้อ (ใช้ซ้ำทั้ง landing และในแอป)
 */
export default function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-label font-semibold uppercase tracking-[0.22em] text-fg-subtle ${className}`}
    >
      {children}
    </p>
  );
}