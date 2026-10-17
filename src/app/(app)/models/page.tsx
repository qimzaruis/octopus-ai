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

export const dynamic = "force-dynamic";

/**
 * หน้า "โมเดลที่ใช้ได้" ฝั่งผู้ใช้
 *
 * แสดง "route" เป็นหลัก (route = โมเดลที่ผู้ใช้เรียกจริง) ไม่เปิดเผยว่า
 * เบื้องหลังส่งต่อไปค่ายไหน — ใช้โลโก้ที่แอดมินตั้งไว้แทนชื่อผู้ให้บริการ
 *
 * โหมดแสดงผล:
 *   router → กางรายชื่อโมเดลปลายทางให้เห็น (แสดงแค่ชื่อโมเดล ไม่บอกค่าย)
 *   model  → แสดงเป็นรายการเดียว ไม่กาง
 */
export default async function ModelsPage() {
  const user = (await getSessionUser())!;
  const t = await getT();
  const routes = await listPublicRoutes();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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
        <div className="space-y-4">
          {routes.map((r) => {
            const isRouterMode = r.displayMode === "router";
            const hasPrice = r.inputPricePerM > 0 || r.outputPricePerM > 0;

            return (
              <section key={r.id} className="card overflow-hidden">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 p-1.5">
                      {r.logoUrl ? (
                        <Image
                          src={r.logoUrl}
                          alt=""
                          width={48}
                          height={48}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-body-sm font-bold text-fg-subtle">
                          {(r.displayName || r.publicModel).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>

                    <div className="min-w-0">
                      {/* ชื่อที่แสดงเป็นตัวหลัก */}
                      <h2 className="text-body font-semibold text-fg">
                        {r.displayName || r.publicModel}
                      </h2>
                      {/* id (ชื่อที่ใช้เรียกจริง) เป็นตัวรอง + ปุ่มคัดลอก */}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <code className="font-mono text-caption text-fg-subtle">
                          {r.publicModel}
                        </code>
                        <CopyButton value={r.publicModel} />
                      </div>
                      {r.description && (
                        <p className="mt-2 text-caption text-fg-subtle">{t(r.description)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-4">
                    {hasPrice && (
                      <div className="text-right">
                        <p className="text-label text-fg-subtle">{t("ราคา / 1M tokens")}</p>
                        <p className="tnum mt-0.5 text-caption text-fg">
                          {formatUsd(r.inputPricePerM)}{" "}
                          <span className="text-fg-subtle">in</span>
                          {" · "}
                          {formatUsd(r.outputPricePerM)}{" "}
                          <span className="text-fg-subtle">out</span>
                        </p>
                      </div>
                    )}
                    {r.targets.some((x) => x.supportsVision) && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md bg-aqua/10 px-2 py-1 text-label text-aqua"
                        title={t("รองรับรูปภาพ")}
                      >
                        <i className="fa-solid fa-image text-micro" />
                        {t("รับรูปได้")}
                      </span>
                    )}
                  </div>
                </div>

                {/* โหมด router — กางโมเดลปลายทาง (แสดงแค่ชื่อโมเดล ไม่บอกค่าย) */}
                {isRouterMode && r.targets.length > 0 && (
                  <div className="border-t border-white/[0.07] bg-white/[0.02] px-5 py-4">
                    <p className="mb-2.5 text-label font-medium text-fg-subtle">
                      <i className="fa-solid fa-layer-group mr-1.5" />
                      {t("โมเดลปลายทางที่พร้อมให้บริการ ({n})", { n: r.targets.length })}
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {r.targets.map((tg, i) => (
                        <li
                          key={`${tg.label}-${i}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-1.5"
                        >
                          {i === 0 && (
                            <span className="rounded bg-leaf/10 px-1.5 py-0.5 text-micro font-medium text-leaf">
                              {t("หลัก")}
                            </span>
                          )}
                          <span className="text-caption text-fg-muted">{tg.label}</span>
                          <span className="tnum text-label text-fg-subtle">
                            {formatNumber(tg.contextWindow)}
                          </span>
                          {tg.supportsVision && (
                            <i
                              className="fa-solid fa-image text-micro text-aqua"
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
        </Link>{" "}
        {" · "}
        {t("ดูเพดานการใช้งานและแผนที่หน้า")}{" "}
        <Link href="/subscription" className="text-brand-300 underline-offset-2 hover:underline">
          Subscription Plan
        </Link>
      </p>
    </div>
  );
}