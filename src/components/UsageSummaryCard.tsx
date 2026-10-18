"use client";

import { useState } from "react";
import QuotaBar from "@/components/QuotaBar";
import Badge from "@/components/Badge";
import { formatUsd } from "@/lib/format";
import type { UsageTotals } from "@/lib/data/usage";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";

type Period = "cycle" | "all";

/**
 * UsageSummaryCard — สรุปการใช้งานเป็น USD พร้อมสลับ "รอบนี้ / ทั้งหมด"
 *
 * รอบนี้ = เทียบโควต้าของแผน (USD) และ sub-quota รายวัน
 * ทั้งหมด = ยอดสะสมตลอดการใช้งาน
 *
 * โควต้าคิดเป็น USD จากค่าใช้จ่ายจริง ไม่ใช่จำนวน requests/tokens
 * เพราะผู้ใช้จ่ายตามการใช้งานจริง
 */
export default function UsageSummaryCard({
  all,
  planLabel,
  cycleDays,
  cycleQuotaUsd,
  dailyQuotaUsd,
  cycleSpendUsd,
  dailySpendUsd,
  credits,
  fallback,
}: {
  all: UsageTotals;
  planLabel: string;
  cycleDays: number;
  cycleQuotaUsd: number;
  dailyQuotaUsd: number;
  cycleSpendUsd: number;
  dailySpendUsd: number;
  credits: number;
  fallback: boolean;
}) {
  const t = useT();
  const [period, setPeriod] = useState<Period>("cycle");
  const isCycle = period === "cycle";

  const cyclePct = cycleQuotaUsd > 0 ? Math.min(1, cycleSpendUsd / cycleQuotaUsd) : 0;
  const dailyPct = dailyQuotaUsd > 0 ? Math.min(1, dailySpendUsd / dailyQuotaUsd) : 0;
  const cycleExhausted = cycleQuotaUsd > 0 && cycleSpendUsd >= cycleQuotaUsd;

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Icon name="fa-chart-simple" className="mt-0.5 text-brand-400" />
          <div>
            <h2 className="text-body-sm font-semibold text-fg">{t("สรุปการใช้งาน")}</h2>
            <p className="mt-0.5 text-caption text-fg-subtle">
              {isCycle
                ? t("รอบ {d} วันนี้ · เทียบโควต้าของแผน (USD)", { d: cycleDays })
                : t("รวมทุกการใช้งานตั้งแต่เริ่มบัญชี")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            tone={isCycle ? (planLabel === "Pro" ? "brand" : "neutral") : "aqua"}
            icon="fa-solid fa-layer-group"
          >
            {isCycle ? t("แผน {plan}", { plan: planLabel }) : t("สะสมทั้งหมด")}
          </Badge>
          <div className="segmented" role="tablist" aria-label={t("ช่วงเวลาของสรุปการใช้งาน")}>
            <button
              role="tab"
              aria-selected={isCycle}
              onClick={() => setPeriod("cycle")}
              title={t("รอบบิลปัจจุบัน เทียบโควต้าของแผน")}
              className={`chip-toggle whitespace-nowrap ${isCycle ? "chip-toggle-active" : ""}`}
            >
              <Icon name="fa-calendar-day" className="mr-1.5 text-micro" />
              {t("รอบนี้")}
            </button>
            <button
              role="tab"
              aria-selected={!isCycle}
              onClick={() => setPeriod("all")}
              title={t("รวมทุกการใช้งานตั้งแต่เริ่มบัญชี")}
              className={`chip-toggle whitespace-nowrap ${!isCycle ? "chip-toggle-active" : ""}`}
            >
              <Icon name="fa-infinity" className="mr-1.5 text-micro" />
              {t("ทั้งหมด")}
            </button>
          </div>
        </div>
      </div>

      {/* ตัวเลขสรุป — เป็น USD ทั้งหมด */}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white/[0.04] p-4">
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            <Icon name="fa-receipt" className="text-label text-amber-glow" /> {t("ค่าใช้จ่าย")}
          </p>
          <p className="tnum mt-2 text-stat font-semibold text-fg">
            {formatUsd(isCycle ? cycleSpendUsd : all.costUsd)}
          </p>
          <p className="mt-1 text-label text-fg-subtle">
            {isCycle ? t("รอบ {d} วันนี้", { d: cycleDays }) : t("สะสมทั้งหมด")}
          </p>
        </div>

        <div className="rounded-lg bg-white/[0.04] p-4">
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            <Icon name="fa-calendar-day" className="text-label text-brand-300" /> {t("ใช้ไปวันนี้")}
          </p>
          <p className="tnum mt-2 text-stat font-semibold text-fg">{formatUsd(dailySpendUsd)}</p>
          <p className="mt-1 text-label text-fg-subtle">
            {dailyQuotaUsd > 0 ? t("เพดาน {v}", { v: formatUsd(dailyQuotaUsd) }) : t("ไม่จํากัดรายวัน")}
          </p>
        </div>

        <div className="rounded-lg bg-white/[0.04] p-4">
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            <Icon name="fa-gauge-high" className="text-label text-pulse-300" /> {t("โควต้าคงเหลือ")}
          </p>
          <p className="tnum mt-2 text-stat font-semibold text-fg">
            {cycleQuotaUsd > 0 ? formatUsd(Math.max(0, cycleQuotaUsd - cycleSpendUsd)) : t("ไม่จํากัด")}
          </p>
          <p className="mt-1 text-label text-fg-subtle">
            {t("จาก {v}", { v: cycleQuotaUsd > 0 ? formatUsd(cycleQuotaUsd) : "∞" })}
          </p>
        </div>

        <div className="rounded-lg bg-white/[0.04] p-4">
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            <Icon name="fa-coins" className="text-label text-amber-glow" /> {t("เครดิตคงเหลือ")}
          </p>
          <p className="tnum mt-2 text-stat font-semibold text-fg">{formatUsd(credits)}</p>
          <p className="mt-1 text-label text-fg-subtle">{t("USD · หักตามใช้จริง")}</p>
        </div>
      </div>

      {/* หลอดโควต้า — USD ต่อรอบ + sub-quota รายวัน */}
      {isCycle && (
        <div className="mt-5 grid gap-5 border-t border-white/[0.07] pt-5 sm:grid-cols-2">
          <QuotaBar
            label={t("โควต้าต่อรอบ ({d} วัน)", { d: cycleDays })}
            pct={cyclePct}
            usedLabel={formatUsd(cycleSpendUsd)}
            totalLabel={cycleQuotaUsd > 0 ? formatUsd(cycleQuotaUsd) : "∞"}
          />
          <QuotaBar
            label={t("โควต้ารายวัน")}
            pct={dailyPct}
            usedLabel={formatUsd(dailySpendUsd)}
            totalLabel={dailyQuotaUsd > 0 ? formatUsd(dailyQuotaUsd) : "∞"}
            hint={dailyQuotaUsd > 0 ? undefined : t("แผนนี้ไม่ตั้งเพดานรายวัน")}
          />
          <p className="text-caption text-fg-subtle sm:col-span-2">
            {cycleExhausted ? (
              <span className="text-rose-300">
                <Icon name="fa-circle-exclamation" className="mr-1.5" />
                {t("โควต้าของรอบนี้ใช้ครบแล้ว — ระบบจะไม่รีเซตตามรายวันจนกว่ารอบใหม่จะเริ่ม")}
              </span>
            ) : (
              <>
                {t("Routing fallback {state}", { state: t(fallback ? "เปิด" : "ปิด") })}{" "}
                {!fallback && t("— อัปเป็น Pro เพื่อให้ระบบสลับโมเดลอัตโนมัติเมื่อ provider ล่ม")}
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}