"use client";

import { useState } from "react";
import type { RequestDTO } from "@/lib/data/usage";
import StatusBadge from "@/components/StatusBadge";
import { useT, useLocale } from "@/lib/i18n/client";
import {
  formatDateTime,
  formatLatency,
  formatNumber,
  formatTime,
} from "@/lib/format";

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/[0.07] px-5 py-3.5 last:border-0">
      <span className="flex items-center gap-2.5 text-xs text-fg-subtle">
        <i className={`${icon} w-4 text-center text-fg-subtle`} />
        {label}
      </span>
      <span className="text-right text-sm font-medium text-fg">{children}</span>
    </div>
  );
}

export default function RequestsTable({ items }: { items: RequestDTO[] }) {
  const t = useT();
  const locale = useLocale();
  const [selected, setSelected] = useState<RequestDTO | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="table-head">Request ID</th>
              <th className="table-head">{t("เวลา")}</th>
              <th className="table-head">{t("โมเดล")}</th>
              <th className="table-head">Agent</th>
              <th className="table-head">Status</th>
              <th className="table-head text-right">Latency</th>
              <th className="table-head text-right">Tokens (in/out)</th>
              <th className="table-head text-center">{t("รายละเอียด")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-fg-subtle">
                  <i className="fa-solid fa-magnifying-glass mb-3 block text-2xl text-fg-subtle" />
                  {t("ไม่พบรายการที่ตรงกับเงื่อนไข")}
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer transition hover:bg-white/[0.03]"
                onClick={() => setSelected(r)}
              >
                <td className="table-cell font-mono text-xs text-fg-subtle">
                  #{r.id}
                </td>
                <td className="table-cell whitespace-nowrap text-fg-muted">
                  {formatTime(r.createdAt)}
                </td>
                <td className="table-cell">
                  <span className="font-medium text-fg">{r.model}</span>
                  {r.publicModel && (
                    <span className="ml-1.5 text-label text-fg-subtle">via {r.publicModel}</span>
                  )}
                  <p className="text-label text-fg-subtle">{r.providerName}</p>
                </td>
                <td className="table-cell text-fg-muted">{r.agent}</td>
                <td className="table-cell">
                  <StatusBadge status={r.status} />
                </td>
                <td className="table-cell whitespace-nowrap text-right text-fg-muted">
                  {formatLatency(r.latencyMs)}
                </td>
                <td className="table-cell whitespace-nowrap text-right text-fg-muted">
                  {formatNumber(r.inputTokens)} / {formatNumber(r.outputTokens)}
                </td>
                <td className="table-cell text-center">
                  <button
                    className="rounded-lg border border-white/[0.07] bg-white/5 px-2.5 py-1 text-label text-fg-muted transition hover:border-brand-400/40 hover:text-fg"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(r);
                    }}
                  >
                    <i className="fa-solid fa-eye mr-1" /> {t("ดู")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal รายละเอียด */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="card w-full max-w-lg !bg-ink-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <h3 className="font-semibold text-fg">
                Request <span className="font-mono text-brand-300">#{selected.id}</span>
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="text-fg-subtle transition hover:text-fg"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div>
              <DetailRow icon="fa-solid fa-clock" label={t("เวลาที่เรียกใช้")}>
                {formatDateTime(selected.createdAt, locale)}
              </DetailRow>
              <DetailRow icon="fa-solid fa-circle-info" label={t("สถานะ")}>
                <span className="flex items-center justify-end gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="font-mono text-xs text-fg-subtle">HTTP {selected.httpStatus}</span>
                </span>
              </DetailRow>
              <DetailRow icon="fa-solid fa-robot" label={t("โมเดล (Model)")}>
                {selected.model}
              </DetailRow>
              <DetailRow icon="fa-solid fa-route" label={t("Route / Public model")}>
                {selected.publicModel || "—"}
              </DetailRow>
              <DetailRow icon="fa-solid fa-plug" label="Provider">
                {selected.providerName || "—"}
              </DetailRow>
              <DetailRow icon="fa-solid fa-user-astronaut" label="Agent">
                {selected.agent || "—"}
              </DetailRow>
              <DetailRow icon="fa-solid fa-gauge-high" label="Latency">
                {formatLatency(selected.latencyMs)}
              </DetailRow>
              <DetailRow icon="fa-solid fa-arrow-down" label="Input tokens">
                {formatNumber(selected.inputTokens)}
              </DetailRow>
              <DetailRow icon="fa-solid fa-arrow-up" label="Output tokens">
                {formatNumber(selected.outputTokens)}
              </DetailRow>
              <DetailRow icon="fa-solid fa-coins" label={t("Tokens รวม")}>
                <span className="text-brand-300">
                  {formatNumber(selected.inputTokens + selected.outputTokens)}
                </span>
              </DetailRow>
              {selected.error && (
                <DetailRow icon="fa-solid fa-triangle-exclamation" label="Error">
                  <span className="font-mono text-xs leading-relaxed text-rose-400">
                    {selected.error}
                  </span>
                </DetailRow>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
