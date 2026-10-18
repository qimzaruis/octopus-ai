import Icon from "@/components/Icon";

/**
 * Badge — ป้ายกํากับขนาดเล็ก
 * โทนสีอ้างอิงจาก token เท่านั้น (fg/brand/สถานะ)
 */
const TONES = {
  brand: "bg-brand-500/10 text-brand-300",
  pulse: "bg-pulse/10 text-pulse-300",
  aqua: "bg-aqua/10 text-aqua",
  leaf: "bg-leaf/10 text-leaf",
  amber: "bg-amber-glow/10 text-amber-glow",
  neutral: "bg-white/[0.07] text-fg-muted",
} as const;

export type BadgeTone = keyof typeof TONES;

export default function Badge({
  children,
  tone = "neutral",
  icon,
  dot = false,
  className = "",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  icon?: string;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-label font-medium ${TONES[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon && <Icon name={icon} className="text-micro" />}
      {children}
    </span>
  );
}