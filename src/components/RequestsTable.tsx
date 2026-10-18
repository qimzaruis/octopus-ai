"use client";

import { useState } from "react";
import type { RequestDTO } from "@/lib/data/usage";
import StatusBadge from "@/components/StatusBadge";
import { Dialog } from "@/components/Dialog";
import { useT, useLocale } from "@/lib/i18n/client";
import {
  formatDateTime,
  formatLatency,
  formatNumber,
  formatTime,
  formatUsd,
} from "@/lib/format";
import Icon from "@/components/Icon";

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
        <Icon name={icon} className="h-4 w-4 shrink-0 text-fg-subtle" />
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
      {/* มือถือ: ตาราง 8 คอลัมน์กว้าง min-w 760px = สองเท่าของจอ 360px
          ผู้ใช้ต้องเลื่อนซ้าย-ขวาเพื่อดูสถานะของ request ที่ตัวเองสนใจ ซึ่งไม่มีใครทำบนมือถือ
          รายการใบละ request จึงเป็นรูปที่ถูกต้องของข้อมูลชุดเดียวกัน (แตะทั้งใบ = เปิดรายละเอียด)
          ตารางเต็มกลับมาที่ sm ขึ้นไป — ไม่ได้ตัดคอลัมน์ทิ้ง */}
      <ul className="sm:hidden">
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-body-sm text-fg-subtle">
            <Icon name="fa-magnifying-glass" className="mb-2 text-xl text-fg-subtle" />
            <br />
            {t("ไม่พบรายการที่ตรงกับเงื่อนไข")}
          </li>
        )}
        {items.map((r) => (
          <li key={r.id} className="border-b border-white/[0.07] last:border-0">
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="w-full px-4 py-3.5 text-left transition active:bg-white/[0.05]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-body-sm font-medium text-fg">
                  {r.publicModel || "—"}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-subtle">
                <span className="tnum">{formatTime(r.createdAt)}</span>
                <span className="tnum">{formatLatency(r.latencyMs)}</span>
                <span className="tnum">
                  {formatNumber(r.inputTokens)} / {formatNumber(r.outputTokens)}
                </span>
                <span className="tnum">#{r.id}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
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
                  <span className="mb-3 flex justify-center text-2xl">
                    <Icon name="fa-magnifying-glass" className="text-fg-subtle" />
                  </span>
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
                  {/* แสดง "route" ที่ผู้ใช้เรียกจริง — คอลัมน์ model เป็น id ปลายทาง จึงไม่ใช้ */}
                  <span className="font-medium text-fg">{r.publicModel || "—"}</span>
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
                    className="touch-min inline-flex items-center rounded-lg border border-white/[0.07] bg-white/5 px-2.5 py-1 text-label text-fg-muted transition hover:border-brand-400/40 hover:text-fg"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(r);
                    }}
                  >
                    <Icon name="fa-eye" className="mr-1" /> {t("ดู")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* รายละเอียด request — ใช้ Dialog ตัวเดียวกับทั้งแอป (ไม่ใช่ modal เขียนเอง) */}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        icon="fa-solid fa-circle-info"
        title={`Request ${selected ? `#${selected.id}` : ""}`}
        description={selected ? formatDateTime(selected.createdAt, locale) : undefined}
      >
        {selected && (
          <div className="-mx-5 -my-4">
            <DetailRow icon="fa-solid fa-circle-info" label={t("สถานะ")}>
              <span className="flex items-center justify-end gap-2">
                <StatusBadge status={selected.status} />
                <span className="font-mono text-xs text-fg-subtle">
                  HTTP {selected.httpStatus}
                </span>
              </span>
            </DetailRow>
            <DetailRow icon="fa-solid fa-cube" label={t("โมเดล")}>
              {selected.publicModel || "—"}
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
            <DetailRow icon="fa-solid fa-dollar-sign" label={t("ค่าใช้จ่าย")}>
              {formatUsd(selected.costUsd)}
            </DetailRow>
            {selected.error && (
              <DetailRow icon="fa-solid fa-triangle-exclamation" label="Error">
                <span className="font-mono text-xs leading-relaxed text-rose-400">
                  {selected.error}
                </span>
              </DetailRow>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
