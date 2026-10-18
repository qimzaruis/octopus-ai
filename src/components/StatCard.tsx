import Badge from "@/components/Badge";
import Icon from "@/components/Icon";

/**
 * StatCard — การ์ดสถิติ
 * แยกชั้นด้วยพื้น ink-850 + เงา (ไม่ใช่เส้นขอบ) และใช้ .tnum กับตัวเลขให้คอลัมน์ตรงกัน
 */
export default function StatCard({
  icon,
  label,
  value,
  unit,
  sub,
  delta,
  tone = "brand",
}: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  delta?: { value: string; positive: boolean };
  tone?: "brand" | "pulse" | "aqua" | "leaf" | "amber" | "neutral";
}) {
  const iconTone: Record<string, string> = {
    brand: "text-brand-300 bg-brand-500/10",
    pulse: "text-pulse-300 bg-pulse/10",
    aqua: "text-aqua bg-aqua/10",
    leaf: "text-leaf bg-leaf/10",
    amber: "text-amber-glow bg-amber-glow/10",
    neutral: "text-fg-muted bg-white/[0.07]",
  };

  return (
    <div className="rounded-lg bg-ink-850 p-5 shadow-raised">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-fg-muted">{label}</p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="tnum text-stat font-semibold text-fg">{value}</span>
            {unit && <span className="text-caption text-fg-subtle">{unit}</span>}
          </p>
        </div>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${iconTone[tone]}`}
        >
          <Icon name={icon} className="text-caption" />
        </span>
      </div>

      {(delta || sub) && (
        <div className="mt-4 flex items-start gap-2 border-t border-white/[0.07] pt-3">
          {delta && (
            <Badge
              tone={delta.positive ? "leaf" : "neutral"}
              className="shrink-0 !px-2 !py-0.5 !text-micro"
            >
              <Icon
                name={delta.positive ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}
                className="text-micro"
              />
              {delta.value}
            </Badge>
          )}
          {sub && <p className="text-label leading-snug text-fg-subtle">{sub}</p>}
        </div>
      )}
    </div>
  );
}