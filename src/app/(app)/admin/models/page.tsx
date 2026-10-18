import Image from "next/image";
import {
  addRouteTargetAction,
  deleteAssetAction,
  deleteRouteAction,
  moveRouteTargetAction,
  removeRouteTargetAction,
  saveRouteAction,
  toggleRouteAction,
  toggleRouteTargetAction,
  updateRouteSettingsAction,
  uploadAssetAction,
} from "@/app/(app)/admin/actions";
import { listAssets, listProvidersWithModels, listRoutesWithTargets } from "@/lib/data/admin";
import ToggleSwitch from "@/components/ToggleSwitch";
import ConfirmButton from "@/components/ConfirmButton";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { formatUsd } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * หน้า "โมเดลที่แสดง" = routing
 *
 * แต่ละ route (เช่น octopus-fast / octopus-pro) คือ "โมเดล" ที่ผู้ใช้เห็นและเรียกใช้
 * แอดมินตั้งได้ที่นี่: ชื่อที่แสดง ราคา โลโก้ โหมดแสดงผล และลําดับ fallback
 *
 * โหมดแสดงผลมี 2 แบบ:
 *   router — กางรายชื่อโมเดลปลายทางใต้ route (ผู้ใช้เห็นว่าส่งต่อไปโมเดลอะไรบ้าง)
 *   model  — แสดงเป็นรายการเดียว ไม่กาง (เหมือนเป็นโมเดลหนึ่งตัว)
 *
 * ส่วน provider/คีย์/โมเดลดิบ จัดการที่หน้า Providers (ไม่มีราคา ไม่มีรูปที่นั่น)
 */
export default async function AdminModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getT();
  const [{ error }, routes, providers, assets] = await Promise.all([
    searchParams,
    listRoutesWithTargets(),
    listProvidersWithModels(),
    listAssets(),
  ]);

  const enabledProviders = new Set(providers.filter((p) => p.enabled).map((p) => p.id));
  const usableModels = providers
    .flatMap((p) => p.models.map((m) => ({ ...m, providerName: p.name })))
    .filter((m) => m.enabled && enabledProviders.has(m.providerId));

  const activeRoutes = routes.filter((r) => r.enabled).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("โมเดลที่แสดง")}
        description={t(
          "แต่ละรายการคือ routing ที่ผู้ใช้เรียกได้ — ตั้งชื่อ ราคา โลโก้ โหมดแสดงผล และลําดับ fallback ได้จากที่นี่",
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="aqua" icon="fa-solid fa-cube">
              {t("{n} โมเดลพร้อมใช้", { n: usableModels.length })}
            </Badge>
            <Badge tone="brand" icon="fa-solid fa-route">
              {t("{a}/{b} route เปิดใช้", { a: activeRoutes, b: routes.length })}
            </Badge>
          </div>
        }
      />

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-body-sm text-rose-300">
          <Icon name="fa-circle-exclamation" className="mr-2" />
          {error}
        </p>
      )}

      {/* คลังรูป — อัปครั้งเดียวใช้ซ้ำได้ทุก route */}
      <details className="card group">
        <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3 font-semibold text-fg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aqua/15 text-aqua">
              <Icon name="fa-image" />
            </span>
            {t("คลังรูป — อัปโหลดครั้งเดียว ใช้ซ้ำได้ทุกรายการ")}
          </span>
          <span className="flex items-center gap-3">
            <span className="rounded-lg bg-white/5 px-2.5 py-1 text-label text-fg-muted">
              {t("{n} รูป", { n: assets.length })}
            </span>
            <Icon name="fa-chevron-down" className="text-xs text-fg-subtle transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <div className="space-y-4 border-t border-white/[0.07] p-5">
          {assets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.07] px-4 py-6 text-center text-xs text-fg-subtle">
              {t("ยังไม่มีรูปในคลัง — อัปโหลดรูปแรกด้านล่าง")}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {assets.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                >
                  <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white/5 p-1">
                    <Image
                      src={a.publicUrl}
                      alt={a.name}
                      width={40}
                      height={40}
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-caption font-medium text-fg">{a.name}</p>
                    <p className="text-label text-fg-subtle">{t("เลือกใช้ซ้ำได้")}</p>
                  </div>
                  <form action={deleteAssetAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmButton
                      message={t("ลบรูป {name} ออกจากคลัง?", { name: a.name })}
                      className="rounded-lg border border-white/[0.07] bg-white/5 px-2 py-1 text-micro text-fg-muted transition hover:text-rose-400"
                    >
                      <Icon name="fa-trash-can" />
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form
            action={uploadAssetAction}
            className="flex flex-col gap-3 rounded-xl border border-dashed border-white/[0.07] p-4 sm:flex-row sm:items-end"
          >
            <label className="flex-1 text-xs text-fg-subtle">
              {t("ชื่อรูป (ไว้เลือกใช้)")}
              <input
                name="name"
                className="input mt-1.5"
                placeholder={t("เช่น Octopus Fast")}
                required
              />
            </label>
            <label className="flex-1 text-xs text-fg-subtle">
              {t("ไฟล์รูป — PNG / JPG / WEBP ไม่เกิน 2MB")}
              <input
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
                className="mt-1.5 block w-full cursor-pointer rounded-lg border border-white/[0.07] bg-ink-850 px-3 py-2 text-caption text-fg-muted file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-caption file:text-fg"
              />
            </label>
            <button type="submit" className="btn-ghost !py-2.5 whitespace-nowrap">
              <Icon name="fa-upload" /> {t("อัปโหลดเข้าคลัง")}
            </button>
          </form>
        </div>
      </details>

      {/* สร้าง route ใหม่ */}
      <details className="card group">
        <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3 font-semibold text-fg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pulse/15 text-pulse">
              <Icon name="fa-plus" />
            </span>
            {t("สร้าง Route ใหม่")}
          </span>
          <Icon name="fa-chevron-down" className="text-xs text-fg-subtle transition-transform group-open:rotate-180" />
        </summary>
        <form action={saveRouteAction} className="space-y-4 border-t border-white/[0.07] p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t("ชื่อโมเดลสาธารณะ *")}</label>
              <input
                name="publicModel"
                className="input"
                placeholder={t("เช่น octopus-fast")}
                required
              />
              <p className="mt-1.5 text-label text-fg-subtle">
                {t("ผู้ใช้จะเรียกผ่านชื่อนี้ใน field")} <code>model</code> {t("ของ request")}
              </p>
            </div>
            <div>
              <label className="label">{t("คําอธิบาย")}</label>
              <input
                name="description"
                className="input"
                placeholder={t("เช่น โมเดลเร็ว ราคาถูก เหมาะกับงานทั่วไป")}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              <Icon name="fa-plus" /> {t("สร้าง Route")}
            </button>
          </div>
        </form>
      </details>

      {routes.length === 0 && (
        <div className="card">
          <EmptyState
            icon="fa-solid fa-route"
            title={t("ยังไม่มี route")}
            description={t(
              "สร้าง route แรก เช่น octopus-fast แล้วกําหนดโมเดลปลายทางพร้อมลําดับ fallback",
            )}
          />
        </div>
      )}

      <div className="space-y-4">
        {routes.map((route) => {
          // โมเดลที่ยังไม่อยู่ใน route นี้ — จัดกลุ่มตาม provider เพื่อให้เลือกข้ามค่ายได้ในที่เดียว
          const usedIds = new Set(route.targets.map((tm) => tm.modelRefId));
          const available = usableModels.filter((m) => !usedIds.has(m.id));
          const grouped = providers
            .map((p) => ({
              providerName: p.name,
              models: available.filter((m) => m.providerId === p.id),
            }))
            .filter((g) => g.models.length > 0);

          const isRouterMode = route.displayMode === "router";

          return (
            <div key={route.id} className="card overflow-hidden">
              {/* หัว route */}
              <div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-aqua/15 p-1 text-aqua">
                    {route.logoUrl ? (
                      <Image
                        src={route.logoUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Icon name="fa-route" />
                    )}
                  </span>
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                      {route.displayName || route.publicModel}
                      <code className="rounded-lg bg-white/5 px-2 py-0.5 text-label text-brand-300">
                        {route.publicModel}
                      </code>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-micro font-medium ${
                          isRouterMode ? "bg-brand-500/10 text-brand-300" : "bg-pulse/10 text-pulse-300"
                        }`}
                      >
                        {t(isRouterMode ? "โหมด router" : "โหมด model")}
                      </span>
                      {!route.enabled && (
                        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-micro font-medium text-fg-subtle">
                          {t("ปิดใช้งาน")}
                        </span>
                      )}
                    </p>
                    {route.description && (
                      <p className="mt-0.5 text-xs text-fg-subtle">{t(route.description)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ToggleSwitch action={toggleRouteAction} id={route.id} enabled={route.enabled} />
                  <form action={deleteRouteAction}>
                    <input type="hidden" name="id" value={route.id} />
                    <ConfirmButton
                      message={t("ลบ route {name}?", { name: route.publicModel })}
                      className="text-xs text-fg-subtle transition hover:text-rose-400"
                    >
                      <Icon name="fa-trash-can" />
                    </ConfirmButton>
                  </form>
                </div>
              </div>

              <div className="space-y-5 p-5">
                {/* ตั้งค่าที่ผู้ใช้เห็น */}
                <form
                  action={updateRouteSettingsAction}
                  className="grid gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 lg:grid-cols-4 lg:items-end"
                >
                  <input type="hidden" name="id" value={route.id} />

                  <div>
                    <label className="label">{t("ชื่อที่ผู้ใช้เห็น")}</label>
                    <input
                      name="displayName"
                      defaultValue={route.displayName}
                      className="input"
                      placeholder={route.publicModel}
                    />
                  </div>

                  <div>
                    <label className="label">{t("โหมดแสดงผล")}</label>
                    <select
                      name="displayMode"
                      defaultValue={route.displayMode}
                      className="input"
                      aria-label={t("โหมดแสดงผลของ {name}", { name: route.publicModel })}
                    >
                      <option value="router">{t("router — กางโมเดลปลายทาง")}</option>
                      <option value="model">{t("model — แสดงรายการเดียว ไม่กาง")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">{t("ราคา In / Out (USD / 1M)")}</label>
                    <div className="flex items-center gap-2">
                      <input
                        name="inputPricePerM"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={route.inputPricePerM}
                        className="input tnum"
                        aria-label={t("ราคา input ของ {name}", { name: route.publicModel })}
                      />
                      <input
                        name="outputPricePerM"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={route.outputPricePerM}
                        className="input tnum"
                        aria-label={t("ราคา output ของ {name}", { name: route.publicModel })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">{t("โลโก้จากคลัง")}</label>
                    <div className="flex items-center gap-2">
                      <select
                        name="logoUrl"
                        defaultValue={route.logoUrl ?? ""}
                        className="input"
                        aria-label={t("โลโก้ของ {name}", { name: route.publicModel })}
                      >
                        <option value="">{t("— ไม่ใช้รูป —")}</option>
                        {assets.map((a) => (
                          <option key={a.id} value={a.publicUrl}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn-primary !py-2.5 whitespace-nowrap">
                        <Icon name="fa-floppy-disk" /> {t("บันทึก")}
                      </button>
                    </div>
                  </div>
                </form>

                {/* ลำดับ fallback */}
                <div>
                  <p className="mb-3 text-xs font-medium text-fg-subtle">
                    <Icon name="fa-arrow-down-1-9" className="mr-1.5" />
                    {t("ลําดับ fallback — ระบบจะลองเรียงจากบนลงล่าง")}
                  </p>
                  <ul className="space-y-2">
                    {route.targets.length === 0 && (
                      <li className="rounded-xl border border-dashed border-white/[0.07] px-4 py-6 text-center text-xs text-fg-subtle">
                        {t("ยังไม่มีโมเดลปลายทาง — เพิ่มด้านล่าง")}
                      </li>
                    )}
                    {route.targets.map((tm, idx) => (
                      <li
                        key={tm.id}
                        className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                          tm.enabled
                            ? "border-white/[0.07] bg-white/[0.03]"
                            : "border-white/[0.07] bg-transparent opacity-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                              idx === 0 ? "bg-leaf/15 text-leaf" : "bg-white/5 text-fg-subtle"
                            }`}
                            title={idx === 0 ? t("โมเดลหลัก") : t("fallback ลําดับ {n}", { n: idx + 1 })}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-fg">{t(tm.modelLabel)}</p>
                            <p className="text-label text-fg-subtle">
                              {idx === 0 ? t("โมเดลหลัก (primary)") : t("fallback {n}", { n: idx })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <form action={moveRouteTargetAction} className="inline">
                            <input type="hidden" name="id" value={tm.id} />
                            <input type="hidden" name="direction" value="up" />
                            <button
                              type="submit"
                              disabled={idx === 0}
                              className="rounded-lg border border-white/[0.07] bg-white/5 px-2 py-1 text-micro text-fg-muted transition hover:text-fg disabled:opacity-30"
                              title={t("เลื่อนขึ้น")}
                            >
                              <Icon name="fa-arrow-up" />
                            </button>
                          </form>
                          <form action={moveRouteTargetAction} className="inline">
                            <input type="hidden" name="id" value={tm.id} />
                            <input type="hidden" name="direction" value="down" />
                            <button
                              type="submit"
                              disabled={idx === route.targets.length - 1}
                              className="rounded-lg border border-white/[0.07] bg-white/5 px-2 py-1 text-micro text-fg-muted transition hover:text-fg disabled:opacity-30"
                              title={t("เลื่อนลง")}
                            >
                              <Icon name="fa-arrow-down" />
                            </button>
                          </form>
                          <ToggleSwitch
                            action={toggleRouteTargetAction}
                            id={tm.id}
                            enabled={tm.enabled}
                            size="sm"
                          />
                          <form action={removeRouteTargetAction} className="inline">
                            <input type="hidden" name="id" value={tm.id} />
                            <ConfirmButton
                              message={t("นํา {name} ออกจาก route?", { name: tm.modelLabel })}
                              className="rounded-lg border border-white/[0.07] bg-white/5 px-2 py-1 text-micro text-fg-muted transition hover:text-rose-400"
                            >
                              <Icon name="fa-xmark" />
                            </ConfirmButton>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* เพิ่ม target — จัดกลุ่มตาม provider */}
                  {grouped.length > 0 && (
                    <form
                      action={addRouteTargetAction}
                      className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-white/[0.07] p-4 sm:flex-row sm:items-center"
                    >
                      <input type="hidden" name="routeId" value={route.id} />
                      <label className="flex-1 text-xs text-fg-subtle">
                        {t("เพิ่มโมเดลปลายทาง (เลือกได้ทั้งค่ายเดียวกันและต่างค่าย)")}
                        <select name="modelRefId" className="input mt-1.5" defaultValue="" required>
                          <option value="" disabled>
                            {t("— เลือกโมเดล —")}
                          </option>
                          {grouped.map((g) => (
                            <optgroup key={g.providerName} label={g.providerName}>
                              {g.models.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.providerName} / {m.modelId}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      <button type="submit" className="btn-ghost !py-2.5 whitespace-nowrap">
                        <Icon name="fa-plus" /> {t("เพิ่มเป็น fallback")}
                      </button>
                    </form>
                  )}
                </div>

                {/* ตัวอย่างที่ผู้ใช้จะเห็น */}
                <div className="rounded-xl bg-white/[0.03] px-4 py-3">
                  <p className="text-label text-fg-subtle">
                    <Icon name="fa-eye" className="mr-1.5 text-brand-300" />
                    {t("ผู้ใช้จะเห็นหน้านี้เป็น:")}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-caption text-fg-muted">
                    <span className="font-medium text-fg">
                      {route.displayName || route.publicModel}
                    </span>
                    <span className="font-mono text-fg-subtle">{route.publicModel}</span>
                    {route.inputPricePerM > 0 && (
                      <span className="tnum">
                        {formatUsd(route.inputPricePerM)} / {formatUsd(route.outputPricePerM)}
                      </span>
                    )}
                    {isRouterMode && (
                      <span className="text-fg-subtle">
                        {t("· กาง {n} โมเดลปลายทาง", { n: route.targets.length })}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}