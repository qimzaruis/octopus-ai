"use client";

import { useState } from "react";
import BarChart from "@/components/BarChart";
import type { UsageBucket } from "@/lib/data/usage";
import { useT } from "@/lib/i18n/client";

const RANGES = [
  { key: "hourly", label: "วันนี้", full: "รายชั่วโมง (วันนี้)" },
  { key: "7d", label: "7 วัน", full: "รายวัน (7 วันล่าสุด)" },
  { key: "30d", label: "30 วัน", full: "รายวัน (1 เดือนล่าสุด)" },
] as const;

/**
 * UsageChartCard — กราฟการใช้งาน พร้อมสลับช่วงเวลา
 * ไม่ใช้เส้นขอบเป็นการ์ด แยกด้วยพื้น ink-850 + เงา
 */
export default function UsageChartCard({
  hourly,
  d7,
  d30,
}: {
  hourly: UsageBucket[];
  d7: UsageBucket[];
  d30: UsageBucket[];
}) {
  const t = useT();
  const [range, setRange] = useState<"hourly" | "7d" | "30d">("7d");
  const data = range === "hourly" ? hourly : range === "7d" ? d7 : d30;
  const active = RANGES.find((r) => r.key === range)!;

  const totalReq = data.reduce((s, b) => s + b.requests, 0);
  const totalTok = data.reduce((s, b) => s + b.tokens, 0);

  return (
    <section className="rounded-lg bg-ink-850 shadow-raised">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-body-sm font-semibold text-fg">{t("ภาพรวมการใช้งาน")}</h2>
          <p className="mt-1 text-caption text-fg-subtle">
            {t(active.full)} — {t("รวม")} <span className="tnum text-fg-muted">{totalReq.toLocaleString()}</span> requests ·{" "}
            <span className="tnum text-fg-muted">{totalTok.toLocaleString()}</span> tokens
          </p>
        </div>

        <div className="segmented shrink-0" role="tablist" aria-label={t("ช่วงเวลาของกราฟ")}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              title={t(r.full)}
              className={`chip-toggle whitespace-nowrap ${
                range === r.key ? "chip-toggle-active" : ""
              }`}
            >
              {t(r.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <BarChart data={data} />
      </div>
    </section>
  );
}