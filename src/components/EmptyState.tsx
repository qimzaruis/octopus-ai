/**
 * EmptyState — สถานะว่างที่บอกชัดว่าต้องทำอะไรต่อ
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center px-6 py-14 text-center ${className}`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.07] bg-white/5 text-lg text-fg-subtle">
        <i className={icon} />
      </span>
      <p className="mt-5 text-sm font-semibold text-fg">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg-subtle">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}