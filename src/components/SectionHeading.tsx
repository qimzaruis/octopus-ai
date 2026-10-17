/**
 * SectionHeading — หัวข้อหลักพร้อมคำโปรย ใช้ซ้ำได้ทุก section
 */
import Eyebrow from "@/components/Eyebrow";

export default function SectionHeading({
  eyebrow,
  title,
  accent,
  description,
  align = "left",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  const isCenter = align === "center";
  return (
    <div className={`${isCenter ? "mx-auto max-w-2xl text-center" : "max-w-2xl"} ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-4 text-3xl font-bold leading-[1.15] tracking-tight text-fg sm:text-4xl">
        {title}
        {accent && (
          <>
            {" "}
            {/* คำเน้นใช้ gradient ของแบรนด์ */}
            <span className="text-brand-300">{accent}</span>
          </>
        )}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-fg-muted">{description}</p>
      )}
    </div>
  );
}