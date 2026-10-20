import Image from "next/image";
import {
  addRouteTargetAction,
  deleteAssetAction,
  deleteRouteAction,
  deleteRouteCategoryAction,
  moveRouteTargetAction,
  removeRouteTargetAction,
  saveRouteAction,
  saveRouteCategoryAction,
  toggleRouteAction,
  toggleRouteTargetAction,
  updateRouteSettingsAction,
  uploadAssetAction,
} from "@/app/(app)/admin/actions";
import {
  listAssets,
  listProvidersWithModels,
  listRouteCategories,
  listRoutesWithTargets,
} from "@/lib/data/admin";
import ToggleSwitch from "@/components/ToggleSwitch";
import ConfirmButton from "@/components/ConfirmButton";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import Collapsible from "@/components/Collapsible";
import { formatUsd } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * หน้า "โมเดลที่แสดง" = routing + หมวด/แบรนด์
 *
 * route 1 รายการ = "โมเดล" ที่ผู้ใช้เห็นและเรียกใช้ — ตั้งชื่อ, id, หมวด (ชื่อ+รูป),
 * ราคา, โหมดแสดงผล และลําดับ fallback ได้จากที่นี่
 * การ์ด route ถูกย่อไว้ก่อน กดหัวการ์ดเพื่อกางตั้งค่า — หน้าไม่ยาวจนหาอะไรไม่เจอ
 */
export default async function AdminModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getT();
  const [{ error }, routes, providers, assets, categories] = await Promise.all([
    searchParams,
    listRoutesWithTargets(),
    listProvidersWithModels(),
    listAssets(),
    listRouteCategories(),
  ]);

  const enabledProviders = new Set(providers.filter((p) => p.enabled).map((p) => p.id));
  const usableModels = providers
    .flatMap((p) => p.models.map((m) => ({ ...m, providerName: p.name })))
    .filter((m) => m.enabled && enabledProviders.has(m.providerId));

  const modelsByProvider = providers
    .map((p) => ({
      name: p.name,
      models: usableModels.filter((m) => m.providerId === p.id),
    }))
    .filter((g) => g.models.length > 0);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const routeCount = new Map<number, number>();
  for (const r of routes) {
    if (r.categoryId) routeCount.set(r.categoryId, (routeCount.get(r.categoryId) ?? 0) + 1);
  }

  const activeRoutes = routes.filter((r) => r.enabled).length;

  // จัดกลุ่มการ์ดตามหมวด เพื่อให้หา route ง่ายเมื่อมีหลายรายการ
  const groups = [
    ...categories.map((cat) => ({
      key: `cat-${cat.id}`,
      category: cat,
      routes: routes.filter((r) => r.categoryId === cat.id),
    })),
    {
      key: "none",
      category: null,
      routes: routes.filter((r) => !r.categoryId || !categoryById.has(r.categoryId)),
    },
  ].filter((g) => g.routes.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("โมเดลที่แสดง")}
        description={t(
          "แต่ละรายการคือโมเดลที่ผู้ใช้เรียกได้ — ตั้งชื่อ id หมวด/แบรนด์ ราคา และลําดับ fallback ได้จากที่นี่",
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="aqua" icon="fa-solid fa-cube">
              {t("{n} โมเดลพร้อมใช้", { n: usableModels.length })}
            </Badge>
            <Badge tone="brand" icon="fa-solid fa-route">
              {t("{a}/{b} route เปิดใช้", { a: activeRoutes, b: routes.length })}
            </Badge>
            <Badge tone="neutral" icon="fa-solid fa-layer-group">
              {t("{n} หมวด", { n: categories.length })}
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

      {/* คลังรูป — อัปครั้งเดียวใช้ซ้ำได้ทุกหมวด */}
      <details className="card group">
        <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3 font-semibold text-fg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aqua/15 text-aqua">
              <Icon name="fa-image" />
            </span>
            {t("คลังรูป — อัปโหลดครั้งเดียว ใช้ซ้ำได้ทุกหมวด")}
          </span>
          <span className="flex items-center gap-3">
            <span className="shrink-0 whitespace-nowrap rounded-lg bg-white/5 px-2.5 py-1 text-label text-fg-muted">
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
                placeholder={t("เช่น Claude")}
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

      {/* หมวด / แบรนด์ — ตั้งชื่อและรูปคู่กัน เพราะเป็นเจ้าของโมเดลรายเดียวกัน */}
      <details className="card group">
        <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3 font-semibold text-fg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
              <Icon name="fa-layer-group" />
            </span>
            {t("หมวด / แบรนด์ของโมเดล (ชื่อ + รูป)")}
          </span>
          <span className="flex items-center gap-3">
            <span className="shrink-0 whitespace-nowrap rounded-lg bg-white/5 px-2.5 py-1 text-label text-fg-muted">
              {t("{n} หมวด", { n: categories.length })}
            </span>
            <Icon name="fa-chevron-down" className="text-xs text-fg-subtle transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <div className="space-y-4 border-t border-white/[0.07] p-5">
          {categories.length > 0 && (
            <ul className="grid gap-2.5 lg:grid-cols-2">
              {categories.map((cat) => {
                const logoInAssets = cat.logoUrl
                  ? assets.some((a) => a.publicUrl === cat.logoUrl)
                  : false;
                return (
                  <li key={cat.id}>
                    <details className="group/cat rounded-xl border border-white/[0.07] bg-white/[0.02]">
                      <summary className="flex cursor-pointer select-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5 p-1 text-fg-subtle">
                          {cat.logoUrl ? (
                            <Image
                              src={cat.logoUrl}
                              alt=""
                              width={36}
                              height={36}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Icon name="fa-layer-group" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-fg">{cat.name}</span>
                          <span className="block text-label text-fg-subtle">
                            {t("{n} route ในหมวดนี้", { n: routeCount.get(cat.id) ?? 0 })}
                          </span>
                        </span>
                        <Icon
                          name="fa-chevron-down"
                          className="text-xs text-fg-subtle transition-transform group-open/cat:rotate-180"
                        />
                      </summary>
                      <div className="space-y-3 border-t border-white/[0.07] p-3">
                        <form
                          action={saveRouteCategoryAction}
                          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                        >
                          <input type="hidden" name="id" value={cat.id} />
                          <label className="text-xs text-fg-subtle">
                            {t("ชื่อหมวด")}
                            <input name="name" defaultValue={cat.name} className="input mt-1.5" required />
                          </label>
                          <label className="text-xs text-fg-subtle">
                            {t("รูปของหมวด")}
                            <select
                              name="logoUrl"
                              defaultValue={cat.logoUrl ?? ""}
                              className="input mt-1.5"
                              aria-label={t("รูปของหมวด {name}", { name: cat.name })}
                            >
                              <option value="">{t("— ไม่มีรูป —")}</option>
                              {cat.logoUrl && !logoInAssets && (
                                <option value={cat.logoUrl}>{t("รูปเดิม")}</option>
                              )}
                              {assets.map((a) => (
                                <option key={a.id} value={a.publicUrl}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button type="submit" className="btn-ghost !py-2.5 whitespace-nowrap">
                            <Icon name="fa-floppy-disk" /> {t("บันทึก")}
                          </button>
                        </form>
                        <form action={deleteRouteCategoryAction} className="flex justify-end">
                          <input type="hidden" name="id" value={cat.id} />
                          <ConfirmButton
                            message={t(
                              "ลบหมวด {name}? route ในหมวดนี้จะกลายเป็นไม่ระบุหมวด (รูปเดิมยังอยู่)",
                              { name: cat.name },
                            )}
                            className="rounded-lg border border-white/[0.07] bg-white/5 px-2.5 py-1.5 text-label text-fg-muted transition hover:text-rose-400"
                          >
                            <Icon name="fa-trash-can" /> {t("ลบหมวดนี้")}
                          </ConfirmButton>
                        </form>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}

          {categories.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/[0.07] px-4 py-6 text-center text-xs text-fg-subtle">
              {t("ยังไม่มีหมวด — สร้างหมวดแรกด้านล่าง (ใส่ชื่อและเลือกรูปจากคลัง)")}
            </p>
          )}

          <form
            action={saveRouteCategoryAction}
            className="grid gap-3 rounded-xl border border-dashed border-white/[0.07] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <label className="text-xs text-fg-subtle">
              {t("เพิ่มหมวดใหม่")}
              <input name="name" className="input mt-1.5" placeholder={t("เช่น Claude, DeepSeek")} required />
            </label>
            <label className="text-xs text-fg-subtle">
              {t("รูปของหมวด")}
              <select name="logoUrl" className="input mt-1.5" defaultValue="">
                <option value="">{t("— ไม่มีรูป —")}</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.publicUrl}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary !py-2.5 whitespace-nowrap">
              <Icon name="fa-plus" /> {t("เพิ่มหมวด")}
            </button>
          </form>
          {assets.length === 0 && (
            <p className="text-label text-fg-subtle">
              <Icon name="fa-circle-info" className="mr-1.5" />
              {t("ยังไม่มีรูปในคลัง — สร้างหมวดได้เลยแล้วค่อยกลับมาใส่รูปทีหลัง")}
            </p>
          )}
        </div>
      </details>

      {/* สร้าง route ใหม่ — ตั้งค่าครบตั้งแต่แรก */}
      <details className="card group">
        <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3 font-semibold text-fg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pulse/15 text-pulse">
              <Icon name="fa-plus" />
            </span>
            {t("สร้างโมเดล / Route ใหม่")}
          </span>
          <Icon name="fa-chevron-down" className="text-xs text-fg-subtle transition-transform group-open:rotate-180" />
        </summary>

        <form action={saveRouteAction} className="space-y-4 border-t border-white/[0.07] p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t("ชื่อที่ผู้ใช้เห็น")}</label>
              <input
                name="displayName"
                className="input"
                placeholder={t("เช่น Claude Haiku 5.5")}
              />
              <p className="mt-1.5 text-label text-fg-subtle">
                {t("ว่าง = ตั้งชื่อจาก id ให้อัตโนมัติ")}
              </p>
            </div>
            <div>
              <label className="label">{t("id ที่ใช้เรียก *")}</label>
              <input
                name="publicModel"
                className="input"
                placeholder={t("เช่น claude-haiku-5-5")}
                required
              />
              <p className="mt-1.5 text-label text-fg-subtle">
                {t("ผู้ใช้จะเรียกผ่านชื่อนี้ใน field")} <code>model</code> {t("ของ request")}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">{t("หมวด / แบรนด์")}</label>
              <select name="categoryId" className="input" defaultValue="">
                <option value="">{t("— ไม่ระบุหมวด —")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-label text-fg-subtle">
                {t("ชื่อและรูปของหมวดถูกใช้กับการ์ดนี้ด้วย")}
              </p>
            </div>
            <div>
              <label className="label">{t("โหมดแสดงผล")}</label>
              <select name="displayMode" defaultValue="router" className="input">
                <option value="router">{t("router — แสดงรายการเดียว")}</option>
                <option value="model">{t("model — กางโมเดลปลายทาง")}</option>
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
                  placeholder="In"
                  className="input tnum"
                  aria-label={t("ราคา input")}
                />
                <input
                  name="outputPricePerM"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Out"
                  className="input tnum"
                  aria-label={t("ราคา output")}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t("โมเดลปลายทางตัวแรก")}</label>
              <select name="firstTargetModelRefId" className="input" defaultValue="">
                <option value="">{t("— ยังไม่เพิ่มโมเดล —")}</option>
                {modelsByProvider.map((g) => (
                  <optgroup key={g.name} label={g.name}>
                    {g.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.providerName} / {m.modelId}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1.5 text-label text-fg-subtle">
                {t("เพิ่ม fallback ลำดับถัดไปได้หลังสร้างเสร็จ")}
              </p>
            </div>
            <div>
              <label className="label">{t("คำอธิบาย")}</label>
              <input
                name="description"
                className="input"
                placeholder={t("เช่น โมเดลเร็ว ราคาถูก เหมาะกับงานทั่วไป")}
              />
            </div>
          </div>

          <details className="rounded-xl border border-dashed border-white/[0.07] p-4">
            <summary className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-fg-muted [&::-webkit-details-marker]:hidden">
              <Icon name="fa-plus" className="text-micro" />
              {t("สร้างหมวดใหม่พร้อม route นี้")}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-fg-subtle">
                {t("ชื่อหมวดใหม่")}
                <input
                  name="newCategoryName"
                  className="input mt-1.5"
                  placeholder={t("เช่น Claude")}
                />
              </label>
              <label className="text-xs text-fg-subtle">
                {t("รูปของหมวดใหม่")}
                <select name="newCategoryLogoUrl" className="input mt-1.5" defaultValue="">
                  <option value="">{t("— ไม่มีรูป —")}</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.publicUrl}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-2 text-label text-fg-subtle">
              {t("ถ้ากรอกชื่อหมวดใหม่ ระบบจะใช้หมวดใหม่นี้แทนหมวดที่เลือกด้านบน")}
            </p>
          </details>

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

      {groups.map((group) => (
        <section key={group.key} className="space-y-2.5">
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-white/[0.05] p-1 text-fg-subtle">
              {group.category?.logoUrl ? (
                <Image
                  src={group.category.logoUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Icon name="fa-layer-group" className="text-micro" />
              )}
            </span>
            <h2 className="text-sm font-semibold text-fg">
              {group.category?.name ?? t("ไม่ระบุหมวด")}
            </h2>
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-label text-fg-subtle">
              {t("{n} route", { n: group.routes.length })}
            </span>
          </div>

          {group.routes.map((route) => {
            const category = route.categoryId ? categoryById.get(route.categoryId) : null;
            const usedIds = new Set(route.targets.map((tm) => tm.modelRefId));
            const available = usableModels.filter((m) => !usedIds.has(m.id));
            const grouped = providers
              .map((p) => ({
                providerName: p.name,
                models: available.filter((m) => m.providerId === p.id),
              }))
              .filter((g) => g.models.length > 0);
            const isRouterMode = route.displayMode === "router";
            const hasPrice = route.inputPricePerM > 0 || route.outputPricePerM > 0;
            const logoUrl = route.logoUrl ?? category?.logoUrl ?? null;

            return (
              <Collapsible
                key={route.id}
                header={
                  <>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-aqua/15 p-1 text-aqua">
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Icon name="fa-route" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-fg">
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
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-fg-subtle">
                        {category && <span>{category.name}</span>}
                        <span>{t("{n} ปลายทาง", { n: route.targets.length })}</span>
                        {hasPrice && (
                          <span className="tnum">
                            {formatUsd(route.inputPricePerM)} / {formatUsd(route.outputPricePerM)}
                          </span>
                        )}
                        {route.description && <span className="truncate">{t(route.description)}</span>}
                      </span>
                    </span>
                  </>
                }
                actions={
                  <>
                    <ToggleSwitch action={toggleRouteAction} id={route.id} enabled={route.enabled} />
                    <form action={deleteRouteAction}>
                      <input type="hidden" name="id" value={route.id} />
                      <ConfirmButton
                        message={t("ลบ route {name}?", { name: route.publicModel })}
                        className="rounded-lg p-1.5 text-xs text-fg-subtle transition hover:text-rose-400"
                      >
                        <Icon name="fa-trash-can" />
                      </ConfirmButton>
                    </form>
                  </>
                }
              >
                <div className="space-y-5">
                  {/* ตั้งค่าที่ผู้ใช้เห็น */}
                  <form
                    action={updateRouteSettingsAction}
                    className="grid gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 lg:grid-cols-12 lg:items-end"
                  >
                    <input type="hidden" name="id" value={route.id} />

                    <div className="lg:col-span-3">
                      <label className="label">{t("ชื่อที่ผู้ใช้เห็น")}</label>
                      <input
                        name="displayName"
                        defaultValue={route.displayName}
                        className="input"
                        placeholder={route.publicModel}
                      />
                    </div>

                    <div className="lg:col-span-3">
                      <label className="label">{t("หมวด / แบรนด์")}</label>
                      <select
                        name="categoryId"
                        defaultValue={route.categoryId ?? ""}
                        className="input"
                        aria-label={t("หมวดของ {name}", { name: route.publicModel })}
                      >
                        <option value="">{t("— ไม่ระบุหมวด —")}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="lg:col-span-2">
                      <label className="label">{t("โหมดแสดงผล")}</label>
                      <select
                        name="displayMode"
                        defaultValue={route.displayMode}
                        className="input"
                        aria-label={t("โหมดแสดงผลของ {name}", { name: route.publicModel })}
                      >
                        <option value="router">{t("router")}</option>
                        <option value="model">{t("model")}</option>
                      </select>
                    </div>

                    <div className="lg:col-span-2">
                      <label className="label">{t("ราคา In / Out")}</label>
                      <div className="flex items-center gap-2">
                        <input
                          name="inputPricePerM"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={route.inputPricePerM || ""}
                          placeholder="In"
                          className="input tnum"
                          aria-label={t("ราคา input ของ {name}", { name: route.publicModel })}
                        />
                        <input
                          name="outputPricePerM"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={route.outputPricePerM || ""}
                          placeholder="Out"
                          className="input tnum"
                          aria-label={t("ราคา output ของ {name}", { name: route.publicModel })}
                        />
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <button type="submit" className="btn-primary w-full !py-2.5 whitespace-nowrap">
                        <Icon name="fa-floppy-disk" /> {t("บันทึก")}
                      </button>
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
                      {category && <span>{category.name}</span>}
                      {hasPrice && (
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
              </Collapsible>
            );
          })}
        </section>
      ))}
    </div>
  );
}
