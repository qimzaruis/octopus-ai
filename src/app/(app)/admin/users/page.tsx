import Link from "next/link";
import { listUsersWithMetrics } from "@/lib/data/users";
import { listPlans } from "@/lib/data/plans";
import {
  banUserAction,
  setUserPlanAction,
  adjustCreditsAction,
} from "@/app/(app)/admin/actions";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import StatCard from "@/components/StatCard";
import ToggleSwitch from "@/components/ToggleSwitch";
import UserFilterForm from "@/components/UserFilterForm";
import { formatNumber, formatUsd } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; status?: string; plan?: string }>;
}) {
  const t = await getT();
  const [{ error, q, status, plan }, users, plans] = await Promise.all([
    searchParams,
    listUsersWithMetrics(),
    listPlans(),
  ]);

  // ตัวเลือกแผนสร้างจากข้อมูลจริง (ตาราง plans + แผนที่มีใช้อยู่จริงในผู้ใช้)
  const planMap = new Map<string, string>();
  for (const p of plans) planMap.set(p.key, p.label || p.key);
  for (const u of users) if (!planMap.has(u.plan)) planMap.set(u.plan, u.plan);
  const planOptions = [...planMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, label]) => ({ key, label }));

  const needle = (q ?? "").trim().toLowerCase();
  const statusFilter = status === "banned" || status === "active" ? status : "";
  const planFilter = plan && planMap.has(plan) ? plan : "";
  const list = users.filter((u) => {
    if (needle && !u.email.toLowerCase().includes(needle) && !u.name.toLowerCase().includes(needle))
      return false;
    if (statusFilter === "banned" && !u.banned) return false;
    if (statusFilter === "active" && u.banned) return false;
    if (planFilter && u.plan !== planFilter) return false;
    return true;
  });

  const totalSpend = users.reduce((s, u) => s + u.metrics.costUsd, 0);
  const totalTokens = users.reduce((s, u) => s + u.metrics.tokens, 0);
  const bannedCount = users.filter((u) => u.banned).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("จัดการผู้ใช้")}
        description={t("ดูการใช้งานของแต่ละคน เติม/หักเครดิต เปลี่ยนแผน และระงับบัญชี")}
        actions={
          <>
            <Badge tone="neutral" icon="fa-solid fa-users">
              {t("{n} ผู้ใช้", { n: users.length })}
            </Badge>
            {bannedCount > 0 && (
              <Badge tone="amber" icon="fa-solid fa-ban">
                {t("ระงับ {n}", { n: bannedCount })}
              </Badge>
            )}
          </>
        }
      />

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-body-sm text-rose-300">
          <Icon name="fa-circle-exclamation" className="mr-2" />
          {error}
        </p>
      )}

      {/* สรุปภาพรวมทุกผู้ใช้ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon="fa-solid fa-coins"
          label={t("ค่าใช้จ่ายรวมทุกผู้ใช้")}
          value={formatUsd(totalSpend)}
          unit="USD"
          tone="amber"
        />
        <StatCard
          icon="fa-solid fa-layer-group"
          label={t("Tokens รวมทั้งระบบ")}
          value={formatNumber(totalTokens)}
          tone="pulse"
        />
        <StatCard
          icon="fa-solid fa-user-slash"
          label={t("บัญชีที่ถูกระงับ")}
          value={formatNumber(bannedCount)}
          sub={t("จากทั้งหมด {n} บัญชี", { n: users.length })}
          tone="leaf"
        />
      </div>

      {/* ค้นหา + ตัวกรอง (สถานะ / แผน) */}
      <div className="card p-4">
        <UserFilterForm q={q ?? ""} status={statusFilter} plan={planFilter} plans={planOptions} />
      </div>

      {list.length !== users.length && (
        <p className="text-caption text-fg-subtle">
          {t("แสดง {a} จาก {b} ผู้ใช้", { a: formatNumber(list.length), b: formatNumber(users.length) })}
        </p>
      )}

      {list.length === 0 ? (
        <div className="card">
          <div className="px-6 py-14 text-center">
            <span className="mb-3 flex justify-center text-2xl">
              <Icon name="fa-users" className="text-fg-subtle" />
            </span>
            <p className="text-body-sm font-semibold text-fg">{t("ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข")}</p>
            <Link href="/admin/users" className="btn-ghost mt-5 !py-2 text-label">
              <Icon name="fa-rotate-left" className="text-label" /> {t("ล้างตัวกรอง")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((u) => (
            <details key={u.id} className="card group">
              <summary className="flex cursor-pointer select-none flex-col gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-body-sm font-bold ${
                      u.banned
                        ? "bg-rose-500/15 text-rose-300"
                        : u.role === "admin"
                          ? "bg-pulse/15 text-pulse-300"
                          : "bg-brand-500/15 text-brand-300"
                    }`}
                  >
                    {u.name.charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                      {u.name || t("ผู้ใช้ไม่มีชื่อ")}
                      <span
                        className={`rounded px-1.5 py-0.5 text-micro font-semibold uppercase ${
                          u.plan === "free"
                            ? "bg-white/[0.08] text-fg-subtle"
                            : "bg-brand-500/20 text-brand-300"
                        }`}
                      >
                        {u.planLabel}
                      </span>
                      {u.role === "admin" && (
                        <span className="rounded bg-pulse/15 px-1.5 py-0.5 text-micro font-semibold text-pulse-300">
                          ADMIN
                        </span>
                      )}
                      {u.banned && (
                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-micro font-semibold text-rose-300">
                          {t("ถูกระงับ")}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-caption text-fg-subtle">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <dl className="grid grid-cols-3 gap-4 text-right">
                    <div>
                      <dt className="text-label text-fg-subtle">{t("ค่าใช้จ่าย")}</dt>
                      <dd className="tnum text-body-sm font-semibold text-amber-glow">
                        {formatUsd(u.metrics.costUsd)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-label text-fg-subtle">Tokens</dt>
                      <dd className="tnum text-body-sm font-semibold text-fg">
                        {formatNumber(u.metrics.tokens)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-label text-fg-subtle">{t("เครดิต")}</dt>
                      <dd className="tnum text-body-sm font-semibold text-fg">
                        {formatUsd(u.credits)}
                      </dd>
                    </div>
                  </dl>
                  <Icon name="fa-chevron-down" className="text-caption text-fg-subtle transition-transform group-open:rotate-180" />
                </div>
              </summary>

              <div className="space-y-5 border-t border-white/[0.07] p-5">
                {/* เมตริกละเอียด */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-white/[0.04] p-4">
                    <p className="text-label text-fg-subtle">{t("Requests ทั้งหมด")}</p>
                    <p className="tnum mt-1 text-body-sm font-semibold text-fg">
                      {formatNumber(u.metrics.requests)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] p-4">
                    <p className="text-label text-fg-subtle">{t("โมเดลที่ใช้มากสุด")}</p>
                    <p className="mt-1 truncate font-mono text-body-sm font-semibold text-fg">
                      {u.metrics.topModel?.model ?? "—"}
                    </p>
                    {u.metrics.topModel && (
                      <p className="text-label text-fg-subtle">
                        {formatNumber(u.metrics.topModel.requests)} requests
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg bg-white/[0.04] p-4">
                    <p className="text-label text-fg-subtle">{t("Agent ที่ใช้มากสุด")}</p>
                    <p className="mt-1 truncate text-body-sm font-semibold text-fg">
                      {u.metrics.topAgent?.agent ?? "—"}
                    </p>
                    {u.metrics.topAgent && (
                      <p className="text-label text-fg-subtle">
                        {formatNumber(u.metrics.topAgent.requests)} requests
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {/* เติม/หักเครดิต */}
                  <form
                    action={adjustCreditsAction}
                    className="rounded-xl bg-white/[0.03] p-4"
                  >
                    <input type="hidden" name="userId" value={u.id} />
                    <p className="flex items-center gap-2 text-body-sm font-semibold text-fg">
                      <Icon name="fa-coins" className="text-amber-glow" />
                      {t("ปรับเครดิต (USD)")}
                    </p>
                    <p className="mt-1 text-label text-fg-subtle">
                      {t("ใส่ค่าบวกเพื่อเติม ค่าลบเพื่อหัก (คงเหลือปัจจุบัน {v})", { v: formatUsd(u.credits) })}
                    </p>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <label className="flex-1 text-label text-fg-subtle">
                        {t("จํานวน")}
                        <input
                          name="amount"
                          type="number"
                          step="0.01"
                          placeholder={t("เช่น 10 หรือ -5")}
                          className="input mt-1.5 tnum"
                          required
                        />
                      </label>
                      <label className="flex-[2] text-label text-fg-subtle">
                        {t("หมายเหตุ")}
                        <input
                          name="note"
                          placeholder={t("เช่น เติมเครดิตชดเชย outage")}
                          className="input mt-1.5"
                        />
                      </label>
                      <button type="submit" className="btn-primary !py-2.5">
                        <Icon name="fa-plus" /> {t("ปรับ")}
                      </button>
                    </div>
                  </form>

                  {/* เปลี่ยนแผน + ระงับ */}
                  <div className="space-y-4 rounded-xl bg-white/[0.03] p-4">
                    <div>
                      <p className="flex items-center gap-2 text-body-sm font-semibold text-fg">
                        <Icon name="fa-layer-group" className="text-brand-300" />
                        {t("เปลี่ยนแผน")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {planOptions.map((p) => (
                          <form key={p.key} action={setUserPlanAction} className="inline">
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="plan" value={p.key} />
                            <button
                              type="submit"
                              disabled={u.plan === p.key}
                              className={u.plan === p.key ? "btn-secondary !py-2 text-label" : "btn-ghost !py-2 text-label"}
                            >
                              {u.plan === p.key ? (
                                <>
                                  <Icon name="fa-check" className="text-leaf" /> {p.label}
                                </>
                              ) : (
                                t("สลับเป็น {plan}", { plan: p.label })
                              )}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-white/[0.07] pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-body-sm font-semibold text-fg">
                            <Icon name="fa-ban" className="text-rose-300" />
                            {t("ระงับบัญชี")}
                          </p>
                          <p className="mt-0.5 text-label text-fg-subtle">
                            {u.role === "admin"
                              ? t("ระงับบัญชีแอดมินไม่ได้")
                              : u.banned
                                ? t(u.bannedReason) || t("ถูกระงับอยู่")
                                : t("ผู้ใช้ที่ถูกระงับจะเข้าใช้งานไม่ได้")}
                          </p>
                        </div>
                        {u.role === "admin" ? (
                          <span className="text-label text-fg-subtle">—</span>
                        ) : (
                          <ToggleSwitch
                            action={banUserAction}
                            id={0}
                            enabled={!u.banned}
                            extra={{ userId: u.id, banned: (!u.banned).toString() }}
                            titleOn={t("คลิกเพื่อระงับ")}
                            titleOff={t("คลิกเพื่อคืนสิทธิ์")}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}