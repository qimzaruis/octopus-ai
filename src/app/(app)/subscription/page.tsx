import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listPlans } from "@/lib/data/plans";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { formatUsd } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const user = (await getSessionUser())!;
  const t = await getT();
  const plans = await listPlans();
  const current = plans.find((p) => p.key === user.plan) ?? plans[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Subscription Plan"
        description={t(
          "เปรียบเทียบแผนและเพดานการใช้จ่าย (USD) ต่อรอบ — เปลี่ยนแผนเพื่อเพิ่มโควต้าและเปิด fallback",
        )}
        actions={
          <Badge tone={user.plan === "pro" ? "brand" : "neutral"} icon="fa-solid fa-layer-group">
            {t("แผนปัจจุบัน:")} {current.label}
          </Badge>
        }
      />

      {/* เปรียบเทียบแผน */}
      <section className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => {
          const isCurrent = p.key === user.plan;
          return (
            <div
              key={p.key}
              className={`relative rounded-xl p-5 transition ${
                isCurrent
                  ? "bg-brand-500/[0.12] ring-1 ring-inset ring-brand-400/30"
                  : "bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-body-sm font-semibold text-fg">
                  {t("แผน")} {p.label}
                </h3>
                {isCurrent && (
                  <Badge tone="brand" icon="fa-solid fa-check">
                    {t("แผนปัจจุบัน")}
                  </Badge>
                )}
              </div>
              <p className="mt-3 tnum text-2xl font-bold text-fg">
                {formatUsd(p.cycleQuotaUsd)}
                <span className="ml-1 text-caption font-medium text-fg-subtle">
                  {t("/ รอบ {d} วัน", { d: p.cycleDays })}
                </span>
              </p>
              <ul className="mt-4 space-y-2 text-caption text-fg-muted">
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-leaf" />
                  {p.dailyQuotaUsd > 0
                    ? t("เพดานรายวัน {v}", { v: formatUsd(p.dailyQuotaUsd) })
                    : t("ไม่จํากัดรายวัน")}
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-leaf" />
                  {p.cycleRequests > 0
                    ? t("{n} requests / รอบ", { n: String(p.cycleRequests) })
                    : t("ไม่จํากัดจํานวน requests")}
                </li>
                <li className="flex items-center gap-2">
                  <i
                    className={`fa-solid ${
                      p.fallback ? "fa-check text-leaf" : "fa-xmark text-fg-subtle"
                    }`}
                  />
                  {t("Routing fallback {state}", { state: t(p.fallback ? "เปิด" : "ปิด") })}
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-check text-leaf" />
                  {t("ใช้พร้อมกันได้ {n} โมเดล", { n: p.concurrentModels })}
                </li>
              </ul>
              {!isCurrent && p.key === "pro" && (
                <button
                  disabled
                  title={t("การอัปเกรดแผนจะเปิดใช้งานเร็ว ๆ นี้")}
                  className="btn-secondary mt-5 w-full !py-2.5 text-caption"
                >
                  <i className="fa-solid fa-arrow-up text-label" /> {t("อัปเกรดเป็น Pro")}
                </button>
              )}
            </div>
          );
        })}
      </section>

      <p className="text-caption text-fg-subtle">
        {t("ดูโมเดลที่เรียกใช้ได้และราคาต่อ 1M tokens ที่หน้า")}{" "}
        <Link href="/models" className="text-brand-300 underline-offset-2 hover:underline">
          {t("โมเดล")}
        </Link>{" "}
        {" · "}{t("เติมเครดิตได้ที่หน้า")}{" "}
        <Link href="/credits" className="text-brand-300 underline-offset-2 hover:underline">
          {t("เครดิต")}
        </Link>
      </p>
    </div>
  );
}