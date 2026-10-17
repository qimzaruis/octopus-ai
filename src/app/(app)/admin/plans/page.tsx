import { updatePlanAction } from "@/app/(app)/admin/actions";
import { listPlans } from "@/lib/data/plans";
import { CYCLE_DAY_OPTIONS } from "@/lib/plans";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { formatUsd } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

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
  const [{ error }, plans] = await Promise.all([searchParams, listPlans()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("แผนและโควต้า")}
        description={t(
          "กําหนดเพดานการใช้จ่ายเป็น USD ต่อรอบ และตั้ง sub-quota รายวันเพิ่มได้ — โควต้าคุมทั้งระบบ",
        )}
        actions={
          <Badge tone="brand" icon="fa-solid fa-gauge-high">
            {t("{n} แผน", { n: plans.length })}
          </Badge>
        }
      />

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-body-sm text-rose-300">
          <i className="fa-solid fa-circle-exclamation mr-2" />
          {error}
        </p>
      )}

      <p className="rounded-xl bg-white/[0.03] px-4 py-3 text-caption leading-relaxed text-fg-muted">
        <i className="fa-solid fa-circle-info mr-1.5 text-brand-300" />
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
                  <i className={`fa-solid ${p.key === "pro" ? "fa-crown" : "fa-user"}`} />
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
                  <label className="label">{t("sub-quota รายวัน (USD)")}</label>
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
                  <i className="fa-solid fa-floppy-disk" /> {t("บันทึกแผนนี้")}
                </button>
              </div>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}