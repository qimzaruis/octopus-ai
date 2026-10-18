import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import {
  getModelRanking,
  getOverview,
  getUsage,
  getUsageTotals,
  listRequests,
  type UsageBucket,
} from "@/lib/data/usage";
import UsageChartCard from "@/components/UsageChartCard";
import UsageSummaryCard from "@/components/UsageSummaryCard";
import RankingList from "@/components/RankingList";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { listPublicRoutes, getUserQuota } from "@/lib/data/models";
import {
  formatLatency,
  formatNumber,
  formatPercent,
  formatTime,
  formatUsd,
} from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

/** เทียบค่ารายวันของวันนี้กับเมื่อวาน (ใช้ชุดข้อมูล 7 วัน) */
function dayOverDay(d7: UsageBucket[], metric: "requests" | "tokens") {
  if (d7.length < 2) return undefined;
  const today = d7[d7.length - 1]?.[metric] ?? 0;
  const yesterday = d7[d7.length - 2]?.[metric] ?? 0;
  if (yesterday === 0 && today === 0) return undefined;
  if (yesterday === 0) return { value: "new", positive: true };
  const pct = ((today - yesterday) / yesterday) * 100;
  return {
    value: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`,
    positive: pct >= 0,
  };
}

export default async function DashboardPage() {
  const user = (await getSessionUser())!;
  const t = await getT();

  const [overview, hourly, d7, d30, ranking, recent, quota, routes, allTotals] =
    await Promise.all([
      getOverview(user.id),
      getUsage(user.id, "hourly"),
      getUsage(user.id, "7d"),
      getUsage(user.id, "30d"),
      getModelRanking(user.id, 6),
      listRequests(user.id, { perPage: 8 }),
      getUserQuota(user.id, user.plan),
      listPublicRoutes(),
      getUsageTotals(user.id, "all"),
    ]);

  const todayTokens = hourly.reduce((s, b) => s + b.tokens, 0);
  const todayRequests = hourly.reduce((s, b) => s + b.requests, 0);
  const reqTrend = dayOverDay(d7, "requests");
  const tokTrend = dayOverDay(d7, "tokens");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-fg-subtle">
            {t("ภาพรวม")}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-fg">
            {t("สวัสดี {name}", { name: user.name.split(" ")[0] })}
          </h1>
          <p className="mt-1.5 text-sm text-fg-subtle">
            {t("สรุปการใช้งาน AI API ของคุณ — อัปเดตทุกครั้งที่เข้าหน้านี้")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/requests" className="btn-ghost !py-2 text-xs">
            <Icon name="fa-clock-rotate-left" className="text-label" /> {t("ประวัติทั้งหมด")}
          </Link>
          <Link href="/keys" className="btn-primary !py-2 text-xs">
            <Icon name="fa-key" className="text-label" /> {t("จัดการ API Keys")}
          </Link>
        </div>
      </div>

{/* ---------- Stats ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="fa-solid fa-bolt"
          label={t("Requests วันนี้")}
          value={formatNumber(todayRequests)}
          sub={t("รวมทั้งหมด {n} requests · เทียบเมื่อวาน", { n: formatNumber(overview.requests) })}
          delta={reqTrend}
          tone="brand"
        />
        <StatCard
          icon="fa-solid fa-coins"
          label={t("ค่าใช้จ่ายรวม")}
          value={formatUsd(overview.costUsd)}
          unit="USD"
          sub={t("เครดิตคงเหลือ {v}", { v: formatUsd(user.credits) })}
          tone="amber"
        />
        <StatCard
          icon="fa-solid fa-layer-group"
          label={t("Tokens วันนี้")}
          value={formatNumber(todayTokens)}
          sub={t("รวมทั้งหมด {n} tokens · เทียบเมื่อวาน", { n: formatNumber(overview.tokens) })}
          delta={tokTrend}
          tone="pulse"
        />
        <StatCard
          icon="fa-solid fa-circle-check"
          label={t("อัตราสําเร็จ")}
          value={formatPercent(overview.successRate)}
          sub={t("ผิดพลาด {e} จาก {n} requests", { e: formatNumber(overview.errors), n: formatNumber(overview.requests) })}
          tone="leaf"
        />
      </div>

      {/* ---------- สรุปการใช้งาน (โควต้า USD ต่อรอบ + sub-quota รายวัน) ---------- */}
      <UsageSummaryCard
        all={allTotals}
        planLabel={quota.plan.label}
        cycleDays={quota.plan.cycleDays}
        cycleQuotaUsd={quota.plan.cycleQuotaUsd}
        dailyQuotaUsd={quota.plan.dailyQuotaUsd}
        cycleSpendUsd={quota.cycleSpendUsd}
        dailySpendUsd={quota.dailySpendUsd}
        credits={user.credits}
        fallback={quota.plan.fallback}
      />

      {/* ---------- โมเดลที่ใช้ได้ ---------- */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2">
            <Icon name="fa-cube" className="text-brand-400" />
            <div>
              <h2 className="text-body-sm font-semibold text-fg">{t("โมเดลที่ใช้ได้")}</h2>
              <p className="mt-0.5 text-caption text-fg-subtle">
                {t("{n} โมเดลพร้อมใช้กับบัญชีของคุณ", { n: routes.length })}
              </p>
            </div>
          </div>
          <Link
            href="/models"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-caption font-medium text-brand-300 transition hover:bg-brand-500/10 hover:text-brand-200"
          >
            {t("ดูทั้งหมด")} <Icon name="fa-arrow-right" className="text-micro" />
          </Link>
        </div>
        {routes.length === 0 ? (
          <EmptyState
            icon="fa-solid fa-cube"
            title={t("ยังไม่มีโมเดลที่เปิดให้ใช้")}
            description={t("แอดมินจะเปิดโมเดลให้ผู้ใช้เห็นจากหน้า โมเดลที่แสดง")}
          />
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {routes.slice(0, 6).map((r) => {
              const hasVision = r.targets.some((x) => x.supportsVision);
              const maxCtx = Math.max(0, ...r.targets.map((x) => x.contextWindow));
              return (
                <div key={r.id} className="rounded-lg bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-caption font-medium text-fg">
                      {r.publicModel}
                    </span>
                    {hasVision && (
                      <Icon name="fa-image" className="shrink-0 text-label text-aqua"
                        title={t("รองรับรูปภาพ")}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-label text-fg-subtle">
                    {r.displayName || r.publicModel}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-label">
                    <span className="text-fg-subtle">
                      {maxCtx > 0 ? `${formatNumber(maxCtx)} ctx` : "—"}
                    </span>
                    <span className="tnum text-fg-muted">
                      {formatUsd(r.inputPricePerM)}
                      <span className="text-fg-subtle">/1M in</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- Chart ---------- */}
      <UsageChartCard hourly={hourly} d7={d7} d30={d30} />

      {/* ---------- Ranking + Recent ---------- */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="card p-5 sm:p-6 xl:col-span-2">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Icon name="fa-ranking-star" className="text-amber-glow" />
                {t("อันดับโมเดลยอดนิยม")}
              </h2>
              <p className="mt-1 text-xs text-fg-subtle">{t("เรียงตาม tokens ที่ใช้ทั้งหมด")}</p>
            </div>
            <span className="rounded-lg bg-white/5 px-2 py-1 text-label text-fg-muted">
              Top {ranking.length}
            </span>
          </div>
          <RankingList ranking={ranking} />
        </section>

        <section className="card overflow-hidden xl:col-span-3">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Icon name="fa-clock-rotate-left" className="text-brand-400" />
                {t("Requests ล่าสุด")}
              </h2>
              <p className="mt-1 text-xs text-fg-subtle">{t("8 รายการล่าสุดของคุณ")}</p>
            </div>
            <Link
              href="/requests"
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-300 transition hover:bg-brand-500/10 hover:text-brand-200"
            >
              {t("ดูทั้งหมด")} <Icon name="fa-arrow-right" className="text-micro" />
            </Link>
          </div>

          {recent.items.length === 0 ? (
            <EmptyState
              icon="fa-solid fa-satellite-dish"
              title={t("ยังไม่มีประวัติการเรียกใช้")}
              description={t("สร้าง API key แล้วยิง request แรกของคุณ เพื่อดูสถิติที่นี่")}
              action={
                <Link href="/keys" className="btn-primary !py-2 text-xs">
                  <Icon name="fa-key" className="text-label" /> {t("สร้าง API key")}
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    <th className="table-head">{t("เวลา")}</th>
                    <th className="table-head">{t("โมเดล")}</th>
                    <th className="table-head">Agent</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Latency</th>
                    <th className="table-head text-right">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recent.items.map((r) => (
                    <tr key={r.id} className="transition hover:bg-white/[0.03]">
                      <td className="table-cell whitespace-nowrap font-mono text-xs text-fg-muted">
                        {formatTime(r.createdAt)}
                      </td>
                      <td className="table-cell">
                        {/* แสดงเฉพาะ route ที่ผู้ใช้เรียก — ไม่เปิดเผยโมเดล/ค่ายปลายทาง */}
                        <span className="font-mono text-caption font-medium text-fg">
                          {r.publicModel || "—"}
                        </span>
                      </td>
                      <td className="table-cell text-fg-muted">{r.agent}</td>
                      <td className="table-cell">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="table-cell whitespace-nowrap text-right text-fg-muted">
                        {formatLatency(r.latencyMs)}
                      </td>
                      <td className="table-cell whitespace-nowrap text-right font-medium text-fg">
                        {formatNumber(r.inputTokens + r.outputTokens)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}