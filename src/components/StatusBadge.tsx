export default function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    success: {
      label: "Success",
      cls: "bg-leaf/10 text-leaf border-leaf/25",
      icon: "fa-solid fa-circle-check",
    },
    error: {
      label: "Error",
      cls: "bg-rose-500/10 text-rose-400 border-rose-500/25",
      icon: "fa-solid fa-circle-xmark",
    },
    rate_limited: {
      label: "Rate limited",
      cls: "bg-amber-glow/10 text-amber-glow border-amber-glow/25",
      icon: "fa-solid fa-hourglass-half",
    },
  };
  const s = map[status] ?? {
    label: status,
    cls: "bg-white/5 text-fg-muted border-white/[0.07]",
    icon: "fa-solid fa-circle-question",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-label font-medium ${s.cls}`}
    >
      <i className={`${s.icon} text-micro`} />
      {s.label}
    </span>
  );
}