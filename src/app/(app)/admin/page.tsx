import Link from "next/link";
import { getModelRanking, getOverview, getUsage } from "@/lib/data/usage";
import UsageChartCard from "@/components/UsageChartCard";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { formatLatency, formatNumber, formatPercent, formatUsd } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const t = await getT();
  const [overview, hourly, d7, d30, ranking] = await Promise.all([
    getOverview("all"),
    getUsage("all", "hourly"),
    getUsage("all", "7d"),
    getUsage("all", "30d"),
    getModelRanking("all", 50),
  ]);

  const maxTokens = Math.max(1, ...ranking.map((r) => r.totalTokens));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("สรุปการใช้งานรวม")}
        description={t("สถิติการเรียกใช้โมเดลของผู้ใช้ทุกคนในระบบ")}
actions={
          <>
            <Link href="/admin/users" className="btn-ghost !py-2 text-caption">
              <Icon name="fa-users" className="text-label" /> {t("ผู้ใช้")}
            </Link>
            <Link href="/admin/providers" className="btn-ghost !py-2 text-caption">
              <Icon name="fa-plug" className="text-label" /> Providers
            </Link>
            <Link href="/admin/models" className="btn-ghost !py-2 text-caption">
              <Icon name="fa-list-check" className="text-label" /> {t("โมเดลที่แสดง")}
            </Link>
            <Link href="/admin/plans" className="btn-ghost !py-2 text-caption">
              <Icon name="fa-gauge-high" className="text-label" /> {t("แผนและโควต้า")}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="fa-solid fa-bolt"
          label={t("Requests ทั้งหมด")}
          value={formatNumber(overview.requests)}
          sub={t("วันนี้ {n} requests", { n: formatNumber(hourly.reduce((s, b) => s + b.requests, 0)) })}
          tone="brand"
        />
        <StatCard
          icon="fa-solid fa-coins"
          label={t("ค่าใช้จ่ายรวม")}
          value={formatUsd(overview.costUsd)}
          unit="USD"
          sub={`Tokens ${formatNumber(overview.tokens)}`}
          tone="amber"
        />
        <StatCard
          icon="fa-solid fa-gauge-high"
          label={t("Latency เฉลี่ย")}
          value={formatLatency(overview.avgLatencyMs)}
          sub={`Input ${formatNumber(overview.inputTokens)} · Output ${formatNumber(overview.outputTokens)}`}
          tone="aqua"
        />
        <StatCard
          icon="fa-solid fa-circle-check"
          label={t("อัตราสําเร็จรวม")}
          value={formatPercent(overview.successRate)}
          sub={t("ผิดพลาด {n} ครั้ง", { n: formatNumber(overview.errors) })}
          tone="leaf"
        />
      </div>

      <UsageChartCard hourly={hourly} d7={d7} d30={d30} />

      {/* อันดับ + ตารางรายโมเดล */}
      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-4">
          <Icon name="fa-ranking-star" className="text-amber-glow" />
          <div>
            <h2 className="text-sm font-semibold text-fg">{t("อันดับการใช้งานรายโมเดล")}</h2>
            <p className="mt-0.5 text-xs text-fg-subtle">
              {t("เรียงตาม tokens รวม (input + output) ของทุกผู้ใช้")}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="table-head w-16 text-center">{t("อันดับ")}</th>
                <th className="table-head">{t("โมเดล")}</th>
                <th className="table-head text-right">Requests</th>
                <th className="table-head text-right">Input tok</th>
                <th className="table-head text-right">Output tok</th>
                <th className="table-head text-right">{t("Tokens รวม")}</th>
                <th className="table-head text-right">{t("ค่าใช้จ่าย")}</th>
                <th className="table-head text-right">{t("Latency เฉลี่ย")}</th>
                <th className="table-head text-right">Error</th>
                <th className="table-head w-40">{t("สัดส่วน")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-body-sm text-fg-subtle">
                    {t("ยังไม่มีข้อมูลการใช้งานในระบบ")}
                  </td>
                </tr>
              )}
              {ranking.map((r, i) => (
                <tr key={r.model} className="transition hover:bg-white/[0.03]">
                  <td className="table-cell text-center">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-label font-bold ${
                        i === 0
                          ? "bg-amber-glow/15 text-amber-glow"
                          : i === 1
                            ? "bg-aqua/15 text-aqua"
                            : i === 2
                              ? "bg-brand-500/15 text-brand-300"
                              : "bg-white/5 text-fg-subtle"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono text-caption font-medium text-fg">
                      {r.model}
                    </span>
                  </td>
                  <td className="table-cell text-right">{formatNumber(r.requests)}</td>
                  <td className="table-cell text-right text-fg-muted">
                    {formatNumber(r.inputTokens)}
                  </td>
                  <td className="table-cell text-right text-fg-muted">
                    {formatNumber(r.outputTokens)}
                  </td>
                  <td className="table-cell text-right font-semibold text-brand-300">
                    {formatNumber(r.totalTokens)}
                  </td>
                  <td className="table-cell tnum text-right font-medium text-amber-glow">
                    {formatUsd(r.costUsd)}
                  </td>
                  <td className="table-cell text-right">{formatLatency(r.avgLatencyMs)}</td>
                  <td className="table-cell text-right">
                    <span className={r.errors > 0 ? "text-rose-400" : "text-fg-subtle"}>
                      {formatNumber(r.errors)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-brand-500/60"
                        style={{ width: `${Math.max(2, (r.totalTokens / maxTokens) * 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}