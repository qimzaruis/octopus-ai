import {
  addModelAction,
  addProviderKeyAction,
  deleteModelAction,
  deleteProviderAction,
  deleteProviderKeyAction,
  saveProviderAction,
  setPrimaryProviderKeyAction,
  toggleModelAction,
  toggleProviderAction,
  toggleProviderKeyAction,
  updateProviderKeyAction,
} from "@/app/(app)/admin/actions";
import { listProvidersWithModels } from "@/lib/data/admin";
import KeyHealthBadge from "@/components/KeyHealthBadge";
import ToggleSwitch from "@/components/ToggleSwitch";
import ConfirmButton from "@/components/ConfirmButton";
import StopPropagation from "@/components/StopPropagation";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getT();
  const [{ error }, providers] = await Promise.all([searchParams, listProvidersWithModels()]);

  const totalKeys = providers.reduce((s, p) => s + p.keys.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers & Models"
        description={t(
          "จัดการผู้ให้บริการ AI และโมเดลที่รองรับ — เพิ่มได้หลาย API key ต่อ provider ระบบจะหมุนคีย์อัตโนมัติเมื่อเจอ error",
        )}
        actions={
          <Badge tone="brand" icon="fa-solid fa-plug">
            {t("{a} providers · {b} คีย์", { a: providers.length, b: totalKeys })}
          </Badge>
        }
      />

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <Icon name="fa-circle-exclamation" className="mr-2" />
          {error}
        </p>
      )}

      {/* เพิ่ม provider */}
      <details className="card group">
        <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3 font-semibold text-fg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
              <Icon name="fa-plus" />
            </span>
            {t("เพิ่ม Provider ใหม่")}
          </span>
          <Icon name="fa-chevron-down" className="text-xs text-fg-subtle transition-transform group-open:rotate-180" />
        </summary>
        <form action={saveProviderAction} className="space-y-4 border-t border-white/[0.07] p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t("ชื่อ Provider *")}</label>
              <input name="name" className="input" placeholder={t("เช่น OpenAI, Together")} required />
            </div>
            <div>
              <label className="label">Base URL *</label>
              <input
                name="baseUrl"
                className="input"
                placeholder="https://api.example.com/v1"
                required
              />
            </div>
          </div>
          <p className="text-label text-fg-subtle">
            <Icon name="fa-circle-info" className="mr-1.5 text-brand-300" />
            {t("เพิ่ม API key ได้ทีหลังในหน้ารายละเอียด provider — ใส่ได้หลายคีย์ต่อราย")}
          </p>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              <Icon name="fa-plus" /> {t("เพิ่ม Provider")}
            </button>
          </div>
        </form>
      </details>

      {/* รายการ providers */}
      {providers.length === 0 && (
        <div className="card">
          <EmptyState
            icon="fa-solid fa-plug"
            title={t("ยังไม่มี provider")}
            description={t("เพิ่มผู้ให้บริการรายแรก เพื่อเริ่มกําหนดโมเดลและ route ของคุณ")}
          />
        </div>
      )}

      <div className="space-y-4">
        {providers.map((p) => (
          <details key={p.id} className="card group">
            {/* สรุป provider */}
            <summary className="flex cursor-pointer select-none flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-4">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold ${
                    p.enabled ? "bg-brand-500/15 text-brand-300" : "bg-white/5 text-fg-subtle"
                  }`}
                >
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-fg">
                    {p.name}
                    {!p.enabled && (
                      <span className="ml-2 rounded-md bg-white/5 px-1.5 py-0.5 text-micro font-medium text-fg-subtle">
                        {t("ปิดใช้งาน")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-fg-subtle">{p.baseUrl}</p>
                </div>
              </div>
              <StopPropagation className="flex items-center gap-3">
                <span className="rounded-lg bg-white/5 px-2.5 py-1 text-label text-fg-muted">
                  <Icon name="fa-key" className="mr-1.5" />
                  {t("{n} คีย์", { n: p.keys.length })}
                </span>
                <span className="rounded-lg bg-white/5 px-2.5 py-1 text-label text-fg-muted">
                  <Icon name="fa-cube" className="mr-1.5" />
                  {t("{n} โมเดล", { n: p.models.length })}
                </span>
                <form action={deleteProviderAction} className="inline" title={t("ลบ provider นี้ถาวร")}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmButton
                    message={t("ลบ provider {name} พร้อมโมเดลทั้งหมด? การกระทํานี้ไม่สามารถย้อนกลับได้", {
                      name: p.name,
                    })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/5 text-fg-subtle transition hover:border-rose-500/40 hover:text-rose-400"
                  >
                    <Icon name="fa-trash-can" className="text-label" />
                  </ConfirmButton>
                </form>
                <ToggleSwitch action={toggleProviderAction} id={p.id} enabled={p.enabled} />
                <Icon name="fa-chevron-down" className="text-xs text-fg-subtle transition-transform group-open:rotate-180" />
              </StopPropagation>
            </summary>

            <div className="space-y-5 border-t border-white/[0.07] p-5">
              {/* แก้ไข provider */}
              <form
                action={saveProviderAction}
                className="grid gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:grid-cols-3 sm:items-end"
              >
                <input type="hidden" name="id" value={p.id} />
                <div>
                  <label className="label">{t("ชื่อ")}</label>
                  <input name="name" defaultValue={p.name} className="input" required />
                </div>
                <div>
                  <label className="label">Base URL</label>
                  <input name="baseUrl" defaultValue={p.baseUrl} className="input" required />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary flex-1 !py-2.5">
                    <Icon name="fa-floppy-disk" /> {t("บันทึก")}
                  </button>
                </div>
              </form>

              {/* ------- API keys (หลายคีย์) ------- */}
              <div className="rounded-xl border border-white/[0.07]">
                <div className="border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-fg-muted">
                    <Icon name="fa-key" className="text-brand-300" />
                    {t("API Keys — ระบบเลือกคีย์หลักก่อน แล้วหมุนไปคีย์ถัดไปเมื่อ error")}
                  </p>
                </div>

                <ul className="divide-y divide-white/5">
                  {p.keys.length === 0 && (
                    <li className="px-4 py-6 text-center text-xs text-fg-subtle">
                      {t("ยังไม่มีคีย์ — เพิ่มด้านล่างเพื่อให้ provider นี้ใช้งานได้")}
                    </li>
                  )}
                  {p.keys.map((k) => (
                    <li
                      key={k.id}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-label ${
                            k.isPrimary ? "bg-leaf/15 text-leaf" : "bg-white/5 text-fg-subtle"
                          }`}
                          title={t(k.isPrimary ? "คีย์หลัก" : "คีย์สำรอง")}
                        >
                          <Icon name={k.isPrimary ? "fa-star" : "fa-key"} />
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                            {k.label}
                            {k.isPrimary && (
                              <span className="rounded-md bg-leaf/10 px-1.5 py-0.5 text-micro font-medium text-leaf">
                                {t("คีย์หลัก")}
                              </span>
                            )}
                            <KeyHealthBadge k={k} />
                          </p>
                          <p className="truncate font-mono text-label text-fg-subtle">
                            {k.apiKeyMasked}
                            {k.failureCount > 0 && (
                              <span className="ml-2 font-sans text-amber-glow">
                                {t("พลาด {n} ครั้งติด", { n: k.failureCount })}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <StopPropagation className="flex items-center gap-2">
                        {!k.isPrimary && (
                          <form action={setPrimaryProviderKeyAction} className="inline">
                            <input type="hidden" name="id" value={k.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-white/[0.07] bg-white/5 px-2 py-1 text-micro text-fg-muted transition hover:text-leaf"
                              title={t("ตั้งเป็นคีย์หลัก")}
                            >
                              <Icon name="fa-star" /> {t("ตั้งเป็นหลัก")}
                            </button>
                          </form>
                        )}
                        <ToggleSwitch
                          action={toggleProviderKeyAction}
                          id={k.id}
                          enabled={k.enabled}
                          size="sm"
                        />
                        <form action={deleteProviderKeyAction} className="inline">
                          <input type="hidden" name="id" value={k.id} />
                          <ConfirmButton
                            message={t("ลบคีย์ {label}?", { label: k.label })}
                            className="rounded-lg border border-white/[0.07] bg-white/5 px-2 py-1 text-micro text-fg-muted transition hover:text-rose-400"
                          >
                            <Icon name="fa-trash-can" />
                          </ConfirmButton>
                        </form>
                      </StopPropagation>
                    </li>
                  ))}
                </ul>

                {/* เพิ่มคีย์ใหม่ */}
                <form
                  action={addProviderKeyAction}
                  className="grid gap-3 border-t border-white/[0.07] bg-white/[0.02] p-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end"
                >
                  <input type="hidden" name="providerId" value={p.id} />
                  <div>
                    <label className="label">{t("ชื่อคีย์")}</label>
                    <input name="label" className="input" placeholder={t("เช่น main, backup-1")} />
                  </div>
                  <div>
                    <label className="label">API Key *</label>
                    <input
                      name="apiKey"
                      className="input font-mono"
                      placeholder="sk-..."
                      type="password"
                      required
                    />
                  </div>
                  <button type="submit" className="btn-ghost !py-2.5 whitespace-nowrap">
                    <Icon name="fa-plus" /> {t("เพิ่มคีย์")}
                  </button>
                </form>

                {/* แก้ไขชื่อ / เปลี่ยนคีย์ */}
                {p.keys.length > 0 && (
                  <details className="border-t border-white/[0.07]">
                    <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-label text-fg-subtle [&::-webkit-details-marker]:hidden">
                      <Icon name="fa-pen" className="text-micro" />
                      {t("แก้ไขชื่อ / เปลี่ยนคีย์")}
                    </summary>
                    <div className="space-y-2 px-4 pb-4">
                      {p.keys.map((k) => (
                        <KeyEditForm key={k.id} id={k.id} label={k.label} t={t} />
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* ตารางโมเดล */}
              <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
                <table className="w-full min-w-[680px]">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                      <th className="table-head">Model ID</th>
                      <th className="table-head">Context</th>
                      <th className="table-head">Vision</th>
                      <th className="table-head">{t("สถานะ")}</th>
                      <th className="table-head text-right">{t("จัดการ")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {p.models.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-xs text-fg-subtle">
                          {t("ยังไม่มีโมเดลใน provider นี้")}
                        </td>
                      </tr>
                    )}
                    {p.models.map((m) => (
                      <tr key={m.id}>
                        <td className="table-cell">
                          <span className="font-medium text-fg">{m.modelId}</span>
                          {m.displayName !== m.modelId && (
                            <p className="text-label text-fg-subtle">{m.displayName}</p>
                          )}
                        </td>
                        <td className="table-cell text-fg-muted">
                          {formatNumber(m.contextWindow)}
                        </td>
                        <td className="table-cell">
                          {m.supportsVision ? (
                            <Icon name="fa-eye" className="text-aqua" title={t("รองรับรูปภาพ")} />
                          ) : (
                            <Icon name="fa-eye-slash" className="text-fg-subtle" />
                          )}
                        </td>
                        <td className="table-cell">
                          <ToggleSwitch
                            action={toggleModelAction}
                            id={m.id}
                            enabled={m.enabled}
                            size="sm"
                          />
                        </td>
                        <td className="table-cell text-right">
                          <form action={deleteModelAction} className="inline">
                            <input type="hidden" name="id" value={m.id} />
                            <ConfirmButton
                              message={t("ลบโมเดล {model}?", { model: m.modelId })}
                              className="text-xs text-fg-subtle transition hover:text-rose-400"
                            >
                              <Icon name="fa-trash-can" />
                            </ConfirmButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* เพิ่มโมเดล */}
              <form
                action={addModelAction}
                className="grid gap-3 rounded-xl border border-dashed border-white/[0.07] p-4 sm:grid-cols-5 sm:items-end"
              >
                <input type="hidden" name="providerId" value={p.id} />
                <div>
                  <label className="label">Model ID *</label>
                  <input name="modelId" className="input" placeholder="gpt-4o-mini" required />
                </div>
                <div>
                  <label className="label">{t("ชื่อแสดงผล")}</label>
                  <input name="displayName" className="input" placeholder="GPT-4o mini" />
                </div>
                <div>
                  <label className="label">Context window</label>
                  <input
                    name="contextWindow"
                    className="input"
                    type="number"
                    defaultValue={128000}
                    min={1000}
                  />
                </div>
                <label className="flex items-center gap-2.5 py-2.5 text-xs text-fg-muted">
                  <input
                    name="supportsVision"
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/20 bg-ink-850 accent-brand-500"
                  />
                  {t("รองรับรูปภาพ (vision)")}
                </label>
                <button type="submit" className="btn-ghost !py-2.5">
                  <Icon name="fa-plus" /> {t("เพิ่มโมเดล")}
                </button>
              </form>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/** ฟอร์มแก้ไขคีย์ (ชื่อ + คีย์ใหม่) */
function KeyEditForm({
  id,
  label,
  t,
}: {
  id: number;
  label: string;
  t: (s: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <form
      action={updateProviderKeyAction}
      className="flex flex-wrap items-end gap-2 rounded-lg bg-white/[0.02] p-2.5"
    >
      <input type="hidden" name="id" value={id} />
      <label className="flex-1 text-label text-fg-subtle">
        {t("ชื่อคีย์")}
        <input name="label" defaultValue={label} className="input mt-1 !py-1.5" />
      </label>
      <label className="flex-1 text-label text-fg-subtle">
        {t("คีย์ใหม่ (ว่าง = คงเดิม)")}
        <input
          name="apiKey"
          type="password"
          className="input mt-1 !py-1.5 font-mono"
          placeholder="••••••"
        />
      </label>
      <button type="submit" className="btn-ghost !py-1.5 text-label">
        <Icon name="fa-floppy-disk" className="text-micro" /> {t("บันทึก")}
      </button>
    </form>
  );
}