"use client";

import { useState } from "react";
import { formatCompact, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

/**
 * BarChart — กราฟแท่ง SVG
 * - ลบ gradient ออกจากแท่ง (ใช้สีเดียว) เพื่อลดงานวาดและให้อ่านค่าชัด
 * - แบ่งเส้น grid แบบเบา ๆ และมีป้ายสเกลอ่านง่าย
 */
export default function BarChart({
  data,
  defaultMetric = "requests",
}: {
  data: { label: string; fullLabel: string; requests: number; tokens: number }[];
  defaultMetric?: "requests" | "tokens";
}) {
  const t = useT();
  const [metric, setMetric] = useState<"requests" | "tokens">(defaultMetric);
  const [hovered, setHovered] = useState<number | null>(null);

  const values = data.map((d) => d[metric]);
  const max = Math.max(1, ...values);
  const bars = data.length;
  const svgWidth = Math.max(560, bars * 34);
  const svgHeight = 260;
  const chartH = svgHeight - 40;
  const step = svgWidth / bars;
  const barW = Math.min(24, step * (bars > 20 ? 0.6 : 0.5));
  const labelEvery = Math.max(1, Math.ceil(bars / 12));

  const hoveredItem = hovered !== null ? data[hovered] : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="segmented">
          <button
            onClick={() => setMetric("requests")}
            aria-pressed={metric === "requests"}
            className={`chip-toggle ${metric === "requests" ? "chip-toggle-active" : ""}`}
          >
            Requests
          </button>
          <button
            onClick={() => setMetric("tokens")}
            aria-pressed={metric === "tokens"}
            className={`chip-toggle ${metric === "tokens" ? "chip-toggle-active" : ""}`}
          >
            Tokens
          </button>
        </div>

        <div className="rounded-md bg-white/[0.05] px-3.5 py-2 text-right">
          <p className="text-micro uppercase tracking-wider text-fg-subtle">
            {hoveredItem ? hoveredItem.fullLabel : t("ค่าสูงสุด")}
          </p>
          <p className="tnum mt-0.5 text-body-sm font-semibold text-fg">
            {formatNumber(hoveredItem ? hoveredItem[metric] : max)}{" "}
            <span className="text-micro font-medium text-fg-subtle">
              {metric === "tokens" ? "tokens" : "requests"}
            </span>
          </p>
        </div>
      </div>

      <div className="overflow-y-hidden overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-[260px] w-full min-w-[560px]"
          role="img"
          aria-label={t("กราฟแท่งแสดงจํานวน {metric} ตามช่วงเวลา", {
            metric: metric === "tokens" ? "tokens" : "requests",
          })}
          onMouseLeave={() => setHovered(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = chartH - chartH * f;
            return (
              <g key={f}>
                <line
                  x1="0"
                  x2={svgWidth}
                  y1={y}
                  y2={y}
                  stroke={f === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)"}
                  strokeDasharray={f === 0 ? undefined : "4 6"}
                />
                {f > 0 && (
                  <text x="0" y={y - 5} fontSize="9" fill="#8B97AD">
                    {formatCompact(Math.round(max * f))}
                  </text>
                )}
              </g>
            );
          })}

          {data.map((d, i) => {
            const v = d[metric];
            const h = Math.max(v > 0 ? 4 : 2, (v / max) * (chartH - 10));
            const x = i * step + (step - barW) / 2;
            const y = chartH - h;
            const isHover = hovered === i;
            const isLast = i === bars - 1;
            return (
              <g key={i} onMouseEnter={() => setHovered(i)} className="cursor-pointer">
                <rect x={i * step} y={0} width={step} height={svgHeight} fill="transparent" />
                {isHover && (
                  <rect
                    x={i * step + 2}
                    y={2}
                    width={Math.max(2, step - 4)}
                    height={chartH - 4}
                    rx="6"
                    fill="rgba(255,255,255,0.05)"
                  />
                )}
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={Math.min(4, barW / 2)}
                  fill={isHover || isLast ? "#8E97F5" : "rgba(142,151,245,0.32)"}
                  className="transition-[fill] duration-fast"
                />
                {(bars <= 12 || i % labelEvery === 0 || isLast) && (
                  <text
                    x={i * step + step / 2}
                    y={svgHeight - 14}
                    textAnchor="middle"
                    fontSize="10"
                    fill={isHover ? "#B4BEFC" : "#8B97AD"}
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}