import type { ModelRank } from "@/lib/data/usage";
import { formatLatency, formatNumber, formatUsd } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

const RANK_STYLE = [
  "bg-amber-glow/15 text-amber-glow",
  "bg-aqua/15 text-aqua",
  "bg-brand-500/15 text-brand-300",
];

/**
 * RankingList — อันดับโมเดลที่ใช้มากที่สุด พร้อมแถบสัดส่วน tokens
 * ตัวเลข tokens เด่นชัด แต่ยังแสดง provider / latency / requests ประกอบ
 */
export default async function RankingList({
  ranking,
  emptyText,
}: {
  ranking: ModelRank[];
  emptyText?: string;
}) {
  const t = await getT();
  const maxTokens = Math.max(1, ...ranking.map((r) => r.totalTokens));

  if (ranking.length === 0) {
    return (
      <div className="py-12 text-center">
        <i className="fa-solid fa-chart-simple mb-3 block text-2xl text-fg-subtle" />
        <p className="text-sm text-fg-subtle">{emptyText ?? t("ยังไม่มีการใช้งาน")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-5">
      {ranking.map((r, i) => (
        <li key={r.model}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  RANK_STYLE[i] ?? "bg-white/5 text-fg-subtle"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-caption font-medium text-fg">
                  {r.model}
                </p>
                <p className="mt-0.5 text-label text-fg-subtle">
                  {r.provider} · {formatLatency(r.avgLatencyMs)} ·{" "}
                  {formatNumber(r.requests)} req
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-body-sm font-semibold text-brand-300">
                {formatNumber(r.totalTokens)}
              </p>
              <p className="text-label text-fg-subtle">
                {formatUsd(r.costUsd)} · tokens
              </p>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-brand-500/60 transition-all duration-500"
              style={{ width: `${Math.max(3, (r.totalTokens / maxTokens) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}