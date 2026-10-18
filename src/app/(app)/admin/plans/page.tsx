import { setPlanModelsAction, updatePlanAction } from "@/app/(app)/admin/actions";
import { listPlans, listPlanModelAssignments } from "@/lib/data/plans";
import { listAllModelsForAdmin } from "@/lib/data/models";
import { CYCLE_DAY_OPTIONS } from "@/lib/plans";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { formatUsd } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * หน้า "แผนและโควต้า" — แอดมินตั้งเพดานการใช้จ่ายเป็น USD
 *
 * แนวคิด: เพดานหลักคือ "ต่อรอบ" (cycle) โดยเลือกรอบ 1 / 7 / 30 วัน
 * และตั้ง sub-quota รายวันเพิ่มได้ (เว้น 0 = ไม่มีเพดานรายวัน)
 * ถ้าโควต้ารอบเต็ม ระบบจะบล็อกทันทีโดยไม่รีเซตกลับตามรายวัน
 */
export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getT();
  const [{ error }, plans, allModels, assignments] = await Promise.all([
    searchParams,
    listPlans(),
    listAllModelsForAdmin(),
    listPlanModelAssignments(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("แผนและโควต้า")}
        description={t(
          "กําหนดเพดานการใช้จ่ายเป็น USD ต่อรอบ และตั้งโควต้ารายวันเพิ่มได้ — โควต้าคุมทั้งระบบ",
        )}
        actions={
          <Badge tone="brand" icon="fa-solid fa-gauge-high">
            {t("{n} แผน", { n: plans.length })}
          </Badge>
        }
      />

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-body-sm text-rose-300">
          <Icon name="fa-circle-exclamation" className="mr-2" />
          {error}
        </p>
      )}

      <p className="rounded-xl bg-white/[0.03] px-4 py-3 text-caption leading-relaxed text-fg-muted">
        <Icon name="fa-circle-info" className="mr-1.5 text-brand-300" />
        {t(
          "โควต้าคิดเป็น USD จากค่าใช้จ่ายจริงของแต่ละ request — รอบนับย้อนหลังจากเวลาปัจจุบัน (rolling window) รายวันรีเซตเที่ยงคืนเวลาไทย",
        )}
      </p>

      <div className="space-y-4">
        {plans.map((p) => (
          <div key={p.key} className="card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    p.key === "pro" ? "bg-brand-500/15 text-brand-300" : "bg-white/5 text-fg-muted"
                  }`}
                >
                  <Icon name={p.key === "pro" ? "fa-crown" : "fa-user"} />
                </span>
                <div>
                  <p className="flex items-center gap-2 font-semibold text-fg">
                    {p.label}
                    <code className="rounded bg-white/5 px-1.5 py-0.5 text-label text-fg-subtle">
                      {p.key}
                    </code>
                  </p>
                  <p className="mt-0.5 text-caption text-fg-subtle">
                    {t("รอบ {d} วัน · โควต้า {q} · รายวัน {day}", {
                      d: p.cycleDays,
                      q: formatUsd(p.cycleQuotaUsd),
                      day: p.dailyQuotaUsd > 0 ? formatUsd(p.dailyQuotaUsd) : t("ไม่จํากัด"),
                    })}
                  </p>
                </div>
              </div>
              <Badge tone={p.fallback ? "leaf" : "neutral"} icon="fa-solid fa-route">
                {t("Routing fallback {state}", { state: t(p.fallback ? "เปิด" : "ปิด") })}
              </Badge>
            </div>

            <form action={updatePlanAction} className="space-y-5 p-5">
              <input type="hidden" name="key" value={p.key} />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="label">{t("ชื่อที่แสดง")}</label>
                  <input name="label" defaultValue={p.label} className="input" required />
                </div>

                <div>
                  <label className="label">{t("วงรอบรีเซต")}</label>
                  <select
                    name="cycleDays"
                    defaultValue={String(p.cycleDays)}
                    className="input"
                    aria-label={t("วงรอบรีเซตของ {plan}", { plan: p.label })}
                  >
                    {CYCLE_DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {t("{d} วัน", { d })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">{t("โควต้าต่อรอบ (USD)")}</label>
                  <input
                    name="cycleQuotaUsd"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={p.cycleQuotaUsd}
                    className="input tnum"
                    required
                  />
                </div>

                <div>
                  <label className="label">{t("โควต้ารายวัน (USD)")}</label>
                  <input
                    name="dailyQuotaUsd"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={p.dailyQuotaUsd}
                    className="input tnum"
                  />
                  <p className="mt-1.5 text-label text-fg-subtle">
                    {t("ใส่ 0 = ไม่ตั้งเพดานรายวัน")}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label">{t("เพดาน requests ต่อรอบ")}</label>
                  <input
                    name="cycleRequests"
                    type="number"
                    min="0"
                    defaultValue={p.cycleRequests}
                    className="input tnum"
                  />
                  <p className="mt-1.5 text-label text-fg-subtle">{t("ใส่ 0 = ไม่จํากัด")}</p>
                </div>

                <div>
                  <label className="label">{t("โมเดลพร้อมกัน")}</label>
                  <input
                    name="concurrentModels"
                    type="number"
                    min="1"
                    defaultValue={p.concurrentModels}
                    className="input tnum"
                  />
                </div>

                <label className="flex items-center gap-2.5 self-end py-2.5 text-caption text-fg-muted">
                  <input
                    type="checkbox"
                    name="fallback"
                    value="true"
                    defaultChecked={p.fallback}
                    className="h-4 w-4 rounded border-white/20 bg-ink-850 accent-leaf"
                  />
                  {t("เปิด routing fallback")}
                </label>
              </div>

              <div className="flex justify-end border-t border-white/[0.07] pt-4">
                <button type="submit" className="btn-primary">
                  <Icon name="fa-floppy-disk" /> {t("บันทึกแผนนี้")}
                </button>
              </div>
            </form>

            {/* ชุดโมเดลที่แผนนี้ใช้งานได้ */}
            <form action={setPlanModelsAction} className="space-y-3 border-t border-white/[0.07] p-5">
              <input type="hidden" name="key" value={p.key} />
              <p className="flex items-center gap-2 text-xs font-medium text-fg-muted">
                <Icon name="fa-cube" className="text-brand-300" />
                {t("โมเดลที่แผนนี้ใช้งานได้")}
              </p>
              {allModels.length === 0 ? (
                <p className="text-label text-fg-subtle">
                  {t("ยังไม่มีโมเดลในระบบ — เพิ่มที่หน้า Providers")}
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {allModels.map((m) => {
                    const assigned = assignments[p.key] ?? [];
                    const on = assigned.includes(m.id);
                    return (
                      <li key={m.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-caption transition ${
                            on
                              ? "border-brand-400/40 bg-brand-500/10 text-fg"
                              : "border-white/[0.07] bg-white/[0.03] text-fg-muted hover:bg-white/[0.06]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="modelIds"
                            value={m.id}
                            defaultChecked={on}
                            className="h-3.5 w-3.5 rounded border-white/20 bg-ink-850 accent-brand-500"
                          />
                          {m.displayName}
                          <code className="text-micro text-fg-subtle">{m.modelId}</code>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-label text-fg-subtle">
                {t(
                  "โมเดลที่ไม่ถูกเลือกในแผนใดเลย = ใช้ได้ทุกแผน · โมเดลที่เลือกไว้จะจำกัดเฉพาะแผนนั้นและแผนที่สูงกว่า",
                )}
              </p>
              <div className="flex justify-end">
                <button type="submit" className="btn-secondary !py-2 text-caption">
                  <Icon name="fa-floppy-disk" className="text-label" /> {t("บันทึกชุดโมเดล")}
                </button>
              </div>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}