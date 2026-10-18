import Link from "next/link";
import Image from "next/image";
import { getSessionUser } from "@/lib/auth";
import { listPublicRoutes } from "@/lib/data/models";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import CopyButton from "@/components/CopyButton";
import { formatNumber, formatUsd } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * หน้า "โมเดลที่ใช้ได้" ฝั่งผู้ใช้
 *
 * แสดง "route" เป็นหลัก (route = โมเดลที่ผู้ใช้เรียกจริง) ไม่เปิดเผยว่า
 * เบื้องหลังส่งต่อไปค่ายไหน — ใช้โลโก้ที่แอดมินตั้งไว้แทนชื่อผู้ให้บริการ
 *
 * การ์ดแต่ละใบสรุป: โลโก้ขอบมน · ชื่อ · id ที่เรียกจริง · ความสามารถ ·
 * context · ราคาต่อ 1M tokens · แผนขั้นต่ำที่ต้องมี (ถ้าถูกจำกัด)
 */
export default async function ModelsPage() {
  const user = (await getSessionUser())!;
  const t = await getT();
  const routes = await listPublicRoutes();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={t("โมเดลที่ใช้ได้")}
        description={t("โมเดลทั้งหมดที่บัญชีของคุณเรียกใช้ได้ผ่าน Octopus API พร้อมราคาต่อ 1M tokens")}
        actions={
          <Badge tone="brand" icon="fa-solid fa-cube">
            {t("{n} โมเดล", { n: routes.length })}
          </Badge>
        }
      />

      {routes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="fa-solid fa-cube"
            title={t("ยังไม่มีโมเดลที่เปิดให้ใช้")}
            description={t("แอดมินจะเปิดโมเดลให้ผู้ใช้เห็นจากหน้า โมเดลที่แสดง")}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {routes.map((r) => {
            const isRouterMode = r.displayMode === "router";
            const hasPrice = r.inputPricePerM > 0 || r.outputPricePerM > 0;
            const maxContext = r.targets.reduce((s, x) => Math.max(s, x.contextWindow), 0);
            const supportsVision = r.targets.some((x) => x.supportsVision);

            return (
              <section key={r.id} className="card flex flex-col p-5">
                {/* หัวการ์ด — โลโก้ขอบมน + ชื่อ + ป้ายแผน */}
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                    {r.logoUrl ? (
                      <Image
                        src={r.logoUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center rounded-xl bg-brand-500/15 text-body-sm font-bold text-brand-300">
                        {(r.displayName || r.publicModel).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* กดที่ชื่อเพื่อเข้าหน้ารายละเอียด (ไม่มีปุ่ม i อีกแล้ว) */}
                      <Link
                        href={`/models/${encodeURIComponent(r.publicModel)}`}
                        className="truncate text-body font-semibold text-fg transition hover:text-brand-300"
                        title={t("ดูรายละเอียด {name}", { name: r.displayName || r.publicModel })}
                      >
                        {r.displayName || r.publicModel}
                      </Link>
                      {r.requiredPlanLabel && (
                        <span
                          title={t("ต้องใช้แผน {plan} ขึ้นไป", { plan: r.requiredPlanLabel })}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-glow/10 px-2 py-0.5 text-label font-medium text-amber-glow"
                        >
                          <Icon name="fa-lock" className="text-micro" />
                          {t("ต้องใช้แผน {plan} ขึ้นไป", { plan: r.requiredPlanLabel })}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/models/${encodeURIComponent(r.publicModel)}`}
                        className="truncate font-mono text-caption text-fg-subtle transition hover:text-fg"
                      >
                        {r.publicModel}
                      </Link>
                      <CopyButton value={r.publicModel} />
                    </div>
                  </div>
                </div>

                {r.description && (
                  <p className="mt-3 line-clamp-2 text-caption leading-relaxed text-fg-subtle">
                    {t(r.description)}
                  </p>
                )}

                {/* ความสามารถ + context */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {supportsVision && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md bg-aqua/10 px-2 py-1 text-label text-aqua"
                      title={t("รองรับรูปภาพ")}
                    >
                      <Icon name="fa-image" className="text-micro" />
                      {t("รับรูปได้")}
                    </span>
                  )}
                  {maxContext > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] px-2 py-1 text-label text-fg-muted">
                      <Icon name="fa-infinity" className="text-micro" />
                      <span className="tnum font-semibold text-fg">
                        {formatNumber(maxContext)}
                      </span>
                      {t("คอนเท็กซ์")}
                    </span>
                  )}
                </div>

                {/* ราคา */}
                {hasPrice && (
                  <div className="mt-4 rounded-lg bg-white/[0.03] px-3.5 py-3">
                    <p className="text-label font-medium uppercase tracking-wider text-fg-subtle">
                      {t("ราคา / 1M tokens")}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-caption">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-fg-subtle">INPUT</dt>
                        <dd className="tnum font-semibold text-fg">
                          {formatUsd(r.inputPricePerM)}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-fg-subtle">OUTPUT</dt>
                        <dd className="tnum font-semibold text-fg">
                          {formatUsd(r.outputPricePerM)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}

                {/* โหมด router — กางโมเดลปลายทาง (แสดงแค่ชื่อโมเดล ไม่บอกค่าย) */}
                {isRouterMode && r.targets.length > 0 && (
                  <div className="mt-4 border-t border-white/[0.07] pt-3.5">
                    <p className="mb-2 text-label font-medium text-fg-subtle">
                      <Icon name="fa-layer-group" className="mr-1.5" />
                      {t("โมเดลปลายทางที่พร้อมให้บริการ ({n})", { n: r.targets.length })}
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {r.targets.map((tg, i) => (
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
                            <Icon
                              name="fa-image"
                              className="text-micro text-aqua"
                              title={t("รองรับรูปภาพ")}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="text-caption text-fg-subtle">
        {t("อยากเริ่มยิง request? ไปสร้างคีย์ที่หน้า")}{" "}
        <Link href="/keys" className="text-brand-300 underline-offset-2 hover:underline">
          API Keys
        </Link>
        {" · "}
        {t("ดูเพดานการใช้งานและแผนที่หน้า")}{" "}
        <Link href="/subscription" className="text-brand-300 underline-offset-2 hover:underline">
          Subscription Plan
        </Link>
      </p>
    </div>
  );
}
