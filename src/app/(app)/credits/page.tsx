import { getSessionUser } from "@/lib/auth";
import { getUserQuota } from "@/lib/data/models";
import { listCreditTransactions } from "@/lib/data/users";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { formatUsd, formatUsdSigned, formatDateTime } from "@/lib/format";
import { getT, getLocale } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

const TOPUP_OPTIONS = [
  { amount: 5, bonus: null, popular: false },
  { amount: 25, bonus: "+$2", popular: true },
  { amount: 100, bonus: "+$12", popular: false },
];

export default async function CreditsPage() {
  const user = (await getSessionUser())!;
  const t = await getT();
  const locale = await getLocale();
  const [quota, txs] = await Promise.all([
    getUserQuota(user.id, user.plan),
    listCreditTransactions(user.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={t("เครดิต")}
        description={t("ใช้เครดิตจ่ายค่าเรียกโมเดลตามอัตราที่แต่ละ provider กําหนด — คิดเป็น USD")}
        actions={
          <Badge tone="amber" icon="fa-solid fa-coins">
            Pay as you go
          </Badge>
        }
      />

      {/* ยอดคงเหลือ */}
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background:
              "radial-gradient(ellipse 55% 100% at 85% 0%, rgba(99,102,241,0.18), transparent 72%)",
          }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-caption font-medium uppercase tracking-wider text-fg-subtle">
              {t("เครดิตคงเหลือ")}
            </p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="tnum text-5xl font-extrabold tracking-tight text-fg">
                {formatUsd(user.credits)}
              </span>
              <span className="text-body-sm font-medium text-fg-subtle">USD</span>
            </p>
            <p className="mt-2 text-caption text-fg-subtle">
              {t("แผน")} {quota.plan.label} · {t("ใช้ไปแล้ว")}{" "}
              <span className="tnum text-fg-muted">{formatUsd(quota.cycleSpendUsd)}</span>{" "}
              {t("ในรอบนี้")}
            </p>
          </div>
          <div className="flex max-w-xs items-start gap-3 rounded-xl bg-white/[0.04] p-4 text-caption leading-relaxed text-fg-muted">
            <Icon name="fa-lightbulb" className="mt-0.5 text-amber-glow" />
            <span>
              {t("เครดิตหักตามการใช้งานจริง ไม่มีค่าสมาชิกรายเดือน และไม่มีวันหมดอายุ")}
            </span>
          </div>
        </div>
      </section>

      {/* เติมเครดิต */}
      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Icon name="fa-wallet" className="text-brand-400" />
          <h2 className="text-body-sm font-semibold text-fg">{t("เติมเครดิต")}</h2>
        </div>
        <p className="mt-1.5 text-caption text-fg-subtle">{t("เลือกจํานวนเงินที่ต้องการเติม (USD)")}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {TOPUP_OPTIONS.map((opt) => (
            <div
              key={opt.amount}
              className={`relative rounded-xl p-5 transition ${
                opt.popular
                  ? "bg-brand-500/[0.12] ring-1 ring-inset ring-brand-400/30"
                  : "bg-white/[0.04] hover:bg-white/[0.07]"
              }`}
            >
              {opt.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-0.5 text-micro font-bold text-fg">
                  {t("คุ้มที่สุด")}
                </span>
              )}
              <p className="text-3xl font-extrabold tracking-tight text-fg">
                ${opt.amount}
                <span className="ml-1.5 text-caption font-medium text-fg-subtle">USD</span>
              </p>
              <p className="mt-1.5 text-caption">
                {opt.bonus ? (
                  <span className="text-leaf">
                    <Icon name="fa-gift" className="mr-1" />
                    {opt.bonus}
                  </span>
                ) : (
                  <span className="text-fg-subtle">{t("ไม่รวมโบนัส")}</span>
                )}
              </p>
              <button
                disabled
                title={t("ระบบชําระเงินจะเปิดใช้งานเร็ว ๆ นี้")}
                className="btn-primary mt-5 w-full !py-2.5 text-caption"
              >
                <Icon name="fa-lock" className="text-micro" /> {t("เร็ว ๆ นี้")}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-glow/20 bg-amber-glow/5 px-4 py-3 text-caption leading-relaxed text-amber-glow/80">
          <Icon name="fa-circle-info" className="mt-0.5" />
          {t("ระบบเติมเครดิตยังไม่เปิดใช้งานในเวอร์ชันนี้ — ทีมงานกําลังเตรียมการชําระเงินผ่าน PromptPay และบัตรเครดิต")}
        </p>
      </section>

      {/* ประวัติธุรกรรม */}
      <section className="card overflow-hidden">
        <div className="border-b border-white/[0.07] px-5 py-4">
          <h2 className="text-body-sm font-semibold text-fg">{t("ประวัติธุรกรรม")}</h2>
        </div>
        {txs.length === 0 ? (
          <EmptyState
            icon="fa-solid fa-receipt"
            title={t("ยังไม่มีรายการธุรกรรม")}
            description={t("เมื่อคุณเติมเครดิตหรือแอดมินปรับเครดิต รายการจะแสดงที่นี่")}
          />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {txs.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-body-sm font-medium text-fg">
                    {tx.note || t(tx.amount > 0 ? "เติมเครดิต" : "หักเครดิต")}
                  </p>
                  <p className="mt-0.5 text-label text-fg-subtle">
                    {formatDateTime(tx.createdAt, locale)} · {tx.type}
                  </p>
                </div>
                <span
                  className={`tnum shrink-0 text-body-sm font-semibold ${
                    tx.amount > 0 ? "text-leaf" : "text-fg-muted"
                  }`}
                >
                  {formatUsdSigned(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}