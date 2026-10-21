import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Badge from "@/components/Badge";
import CopyButton from "@/components/CopyButton";
import Icon from "@/components/Icon";
import ApiUsageTabs from "@/components/ApiUsageTabs";
import { listPublicRoutes } from "@/lib/data/models";
import { getRouteHealth } from "@/lib/data/usage";
import { getSiteUrl } from "@/lib/site-config";
import { formatNumber, formatUsd } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * หน้ารายละเอียดโมเดล (route) — เข้าด้วยการกดชื่อโมเดลในหน้า /models
 *
 * เดิมข้อมูลชุดนี้อยู่ใน popup ที่ต้อง fetch สถิติซ้ำทุกครั้งที่เปิด
 * ย้ายมาเป็นหน้าและคำนวณ uptime จาก request จริงใน 24 ชม.ล่าสุด
 * (ไม่ใช้คอลัมน์รายวันที่รีเซ็ตเที่ยงคืน เพราะไม่สะท้อนการใช้งานจริง)
 */
export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getT();
  const [routes, health, canonicalUrl] = await Promise.all([
    listPublicRoutes(),
    getRouteHealth(id),
    getSiteUrl(),
  ]);
  const route = routes.find((r) => r.publicModel === id);
  if (!route) notFound();

  const host = canonicalUrl.replace(/^https?:\/\//, "");

  const name = route.displayName || route.publicModel;
  const maxContext = route.targets.reduce((s, x) => Math.max(s, x.contextWindow), 0);
  const supportsVision = route.targets.some((x) => x.supportsVision);
  const hasPrice = route.inputPricePerM > 0 || route.outputPricePerM > 0;
  const uptimePct = Math.round(health.successRate * 1000) / 10;
  const uptimeTone =
    uptimePct >= 99 ? "bg-leaf" : uptimePct >= 95 ? "bg-amber-glow" : "bg-rose-400";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href="/models"
        className="inline-flex items-center gap-2 text-caption text-fg-muted transition hover:text-fg"
      >
        <Icon name="fa-arrow-left" className="text-micro" />
        {t("กลับหน้าโมเดล")}
      </Link>

      <section className="card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl">
            {route.logoUrl ? (
              <Image
                src={route.logoUrl}
                alt=""
                width={56}
                height={56}
                className="h-full w-full rounded-xl object-contain"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center rounded-xl bg-brand-500/15 text-body font-bold text-brand-300">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-title font-semibold tracking-tight text-fg">{name}</h1>
              {route.requiredPlanLabel && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-glow/10 px-2 py-0.5 text-label font-medium text-amber-glow">
                  <Icon name="fa-lock" className="text-micro" />
                  {t("ต้องใช้แผน {plan} ขึ้นไป", { plan: route.requiredPlanLabel })}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="truncate font-mono text-caption text-fg-subtle">
                {route.publicModel}
              </code>
              <CopyButton value={route.publicModel} />
            </div>
            {route.description && (
              <p className="mt-3 max-w-2xl text-caption leading-relaxed text-fg-muted">
                {t(route.description)}
              </p>
            )}
          </div>
          <Badge tone="brand" icon="fa-solid fa-cube">
            {t("พร้อมใช้")}
          </Badge>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-white/[0.03] px-3.5 py-3">
            <dt className="text-label uppercase tracking-wider text-fg-subtle">
              {t("ราคา / 1M tokens")}
            </dt>
            <dd className="tnum mt-1 text-body-sm font-semibold text-fg">
              {hasPrice
                ? `${formatUsd(route.inputPricePerM)} / ${formatUsd(route.outputPricePerM)}`
                : t("ฟรี")}
            </dd>
            {hasPrice && (
              <p className="mt-0.5 text-micro text-fg-subtle">
                INPUT / OUTPUT
              </p>
            )}
          </div>
          <div className="rounded-lg bg-white/[0.03] px-3.5 py-3">
            <dt className="text-label uppercase tracking-wider text-fg-subtle">
              {t("ความยาวคอนเท็กซ์")}
            </dt>
            <dd className="tnum mt-1 text-body-sm font-semibold text-fg">
              {maxContext ? formatNumber(maxContext) : "—"}
            </dd>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-3.5 py-3">
            <dt className="text-label uppercase tracking-wider text-fg-subtle">
              {t("รับรูปภาพ")}
            </dt>
            <dd className="mt-1 text-body-sm font-semibold text-fg">
              {supportsVision ? t("รับรูปได้") : t("ข้อความเท่านั้น")}
            </dd>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-3.5 py-3">
            <dt className="text-label uppercase tracking-wider text-fg-subtle">
              {t("Latency เฉลี่ย 24 ชม.")}
            </dt>
            <dd className="tnum mt-1 text-body-sm font-semibold text-fg">
              {health.empty ? "—" : `${(health.avgLatencyMs / 1000).toFixed(2)}s`}
            </dd>
          </div>
        </dl>

        {/* สุขภาพของโมเดลวันนี้ — อ่านจากคอลัมน์สถิติ ไม่ต้อง query ประวัติ */}
        <div className="mt-5 border-t border-white/[0.07] pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-caption font-medium text-fg">
              <Icon name="fa-signal" className="mr-1.5 text-micro" />
              {t("Uptime 24 ชม.ล่าสุด")}
            </p>
            <p className="text-label text-fg-subtle">
              {health.empty
                ? t("ยังไม่มีข้อมูล")
                : t("{n} request · {tokens} tokens", {
                    n: formatNumber(health.requests),
                    tokens: formatNumber(health.totalTokens),
                  })}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={`h-full rounded-full ${uptimeTone}`}
              style={{ width: `${health.empty ? 0 : Math.max(2, uptimePct)}%` }}
            />
          </div>
          {!health.empty && (
            <p className="tnum mt-1.5 text-label text-fg-subtle">
              {uptimePct.toFixed(1)}% · {t("นับจาก request จริงในช่วง 24 ชั่วโมงล่าสุด")}
            </p>
          )}
        </div>

        {route.targets.length > 0 && (
          <div className="mt-5 border-t border-white/[0.07] pt-4">
            <p className="mb-2 text-label font-medium text-fg-subtle">
              <Icon name="fa-layer-group" className="mr-1.5" />
              {t("โมเดลปลายทางที่พร้อมให้บริการ ({n})", { n: route.targets.length })}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {route.targets.map((tg, i) => (
                <li
                  key={`${tg.label}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-1"
                >
                  {i === 0 && (
                    <span className="rounded bg-leaf/10 px-1 py-0.5 text-micro font-medium text-leaf">
                      {t("หลัก")}
                    </span>
                  )}
                  <span className="text-label text-fg-muted">{tg.label}</span>
                  {tg.supportsVision && (
                    <Icon name="fa-image" className="text-micro text-aqua" title={t("รองรับรูปภาพ")} />
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-label leading-relaxed text-fg-subtle">
              {t("ระบบเลือกโมเดลปลายทางให้เองอัตโนมัติ — เรียกชื่อเดียวได้ครบทุกตัว")}
            </p>
          </div>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-body font-semibold text-fg">{t("วิธีเรียก API")}</h2>
        <p className="mt-1 text-caption leading-relaxed text-fg-muted">
          {t("เลือกได้ว่าจะพูดกับระบบด้วยรูปแบบไหน แล้วก๊อปไปใช้ได้เลย — เปลี่ยนเฉพาะคีย์กับชื่อโมเดล")}
        </p>
        <div className="mt-4">
          <ApiUsageTabs model={route.publicModel} defaultHost={host} />
        </div>
        <p className="mt-4 text-caption text-fg-subtle">
          {t("ยังไม่มีคีย์? สร้างที่")}{" "}
          <Link href="/keys" className="text-brand-300 underline-offset-2 hover:underline">
            API Keys
          </Link>
        </p>
      </section>
    </div>
  );
}
