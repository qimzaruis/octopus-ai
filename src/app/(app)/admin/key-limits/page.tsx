import {
  clearKeyLimitAction,
  saveKeyLimitAction,
  toggleKeyLimitAction,
} from "@/app/(app)/admin/actions";
import { listKeyLimits } from "@/lib/data/admin";
import { nextResetAt } from "@/lib/key-limit";
import KeyHealthBadge from "@/components/KeyHealthBadge";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import StopPropagation from "@/components/StopPropagation";
import ToggleSwitch from "@/components/ToggleSwitch";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

/** แสดงเวลาในโซนของค่ายนั้นโดยตรง — แอดมินกรอก "13:00 ไทย" ก็ต้องเห็น 13:00 ไทย */
function formatInZone(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 16).replace("T", " ");
  }
}

const listValue = (values: (string | number)[] | null | undefined) => (values ?? []).join(", ");

export default async function AdminKeyLimitsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getT();
  const [{ error }, rows] = await Promise.all([searchParams, listKeyLimits()]);

  const configured = rows.filter((p) => p.rule?.enabled).length;
  const limitedKeys = rows.reduce(
    (sum, p) => sum + p.keys.filter((k) => k.health === "limited").length,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("จำกัดคีย์ต่อ provider")}
        description={t(
          "ตั้งเงื่อนไขที่ถือว่า “คีย์นี้โควต้าหมด” ของแต่ละค่าย ระบบจะพักคีย์นั้นถึงเวลารีเซต แล้วข้ามไปใช้คีย์ถัดไปของค่ายเดียวกันอัตโนมัติ",
        )}
        actions={
          <>
            <Badge tone="brand" icon="fa-solid fa-signal">
              {t("ตั้งแล้ว {a} จาก {b} ค่าย", { a: configured, b: rows.length })}
            </Badge>
            {limitedKeys > 0 && (
              <Badge tone="amber" icon="fa-solid fa-triangle-exclamation">
                {t("{n} คีย์กำลังติดลิมิต", { n: limitedKeys })}
              </Badge>
            )}
          </>
        }
      />

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <Icon name="fa-circle-exclamation" className="mr-2" />
          {error}
        </p>
      )}

      <div className="card px-5 py-4">
        <p className="flex items-start gap-2.5 text-xs leading-relaxed text-fg-muted">
          <Icon name="fa-circle-info" className="mt-0.5 shrink-0 text-brand-300" />
          {t(
            "ลิมิตของแต่ละค่ายไม่เหมือนกัน บางค่ายตอบ HTTP 402 พร้อม code insufficient_quota เมื่อเครดิตหมดและรีเซตเป็นเวลาประจำทุกวัน ส่วนค่ายอื่นมักใช้ 429 จึงกรอกเงื่อนไขจับเองได้ (HTTP status / error code / คำในข้อความ) ถ้าช่องไหนว่างจะถือว่าไม่ใช้ช่องนั้น",
          )}
        </p>
      </div>

      {rows.length === 0 && (
        <div className="card">
          <EmptyState
            icon="fa-solid fa-signal"
            title={t("ยังไม่มี provider")}
            description={t("เพิ่ม provider ในหน้า Providers ก่อน แล้วกลับมาตั้งกติกาการหมุนคีย์ที่นี่")}
          />
        </div>
      )}

      <div className="space-y-4">
        {rows.map((p) => {
          const rule = p.rule;
          const enabled = rule?.enabled ?? false;
          // nextResetAt คืนค่าเสมอ (เวลารีเซตถัดไปจากกติกาที่กรอก) — ใช้ค่า default เมื่อยังไม่มีแถว
          const nextReset = nextResetAt({
            resetTime: rule?.resetTime ?? "13:00",
            resetTimezone: rule?.resetTimezone ?? "Asia/Bangkok",
          });
          const limited = p.keys.filter((k) => k.health === "limited");

          return (
            <details key={p.providerId} className="card group">
              <summary className="flex cursor-pointer select-none flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-4">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      enabled ? "bg-brand-500/15 text-brand-300" : "bg-white/5 text-fg-subtle"
                    }`}
                  >
                    <Icon name={enabled ? "fa-signal" : "fa-circle-pause"} />
                  </span>
                  <div>
                    <p className="font-semibold text-fg">
                      {p.providerName}
                      {!enabled && (
                        <span className="ml-2 rounded-md bg-white/5 px-1.5 py-0.5 text-micro font-medium text-fg-subtle">
                          {t("ยังไม่ได้ตั้ง")}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-fg-subtle">{p.baseUrl}</p>
                  </div>
                </div>
                <StopPropagation className="flex items-center gap-3">
                  {limited.length > 0 ? (
                    <Badge tone="amber" icon="fa-solid fa-triangle-exclamation">
                      {t("ติดลิมิต {n} คีย์", { n: limited.length })}
                    </Badge>
                  ) : (
                    <span className="rounded-lg bg-white/5 px-2.5 py-1 text-label text-fg-muted">
                      <Icon name="fa-key" className="mr-1.5" />
                      {t("{n} คีย์", { n: p.keys.length })}
                    </span>
                  )}
                  {enabled && rule && (
                    <span className="hidden rounded-lg bg-white/5 px-2.5 py-1 text-label text-fg-muted lg:inline">
                      <Icon name="fa-clock" className="mr-1.5" />
                      {t("รีเซต {time}", { time: rule.resetTime })}
                    </span>
                  )}
                  <ToggleSwitch
                    action={toggleKeyLimitAction}
                    id={p.providerId}
                    enabled={enabled}
                    titleOn={t("คลิกเพื่อปิดกฎลิมิตของค่ายนี้")}
                    titleOff={t("คลิกเพื่อเปิดกฎลิมิตของค่ายนี้")}
                  />
                  <Icon
                    name="fa-chevron-down"
                    className="text-xs text-fg-subtle transition-transform group-open:rotate-180"
                  />
                </StopPropagation>
              </summary>

              <div className="space-y-5 border-t border-white/[0.07] p-5">
                {/* ------- สถานะคีย์แต่ละตัวของค่ายนี้ ------- */}
                <div className="rounded-xl border border-white/[0.07]">
                  <div className="border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-fg-muted">
                      <Icon name="fa-key" className="text-brand-300" />
                      {t("สถานะคีย์ — ระบบจะข้ามคีย์ที่ติดลิมิตไปใช้คีย์ถัดไปเอง")}
                    </p>
                  </div>
                  <ul className="divide-y divide-white/5">
                    {p.keys.length === 0 && (
                      <li className="px-4 py-6 text-center text-xs text-fg-subtle">
                        {t("ยังไม่มีคีย์ในหน้านี้ — เพิ่มได้ที่หน้า Providers")}
                      </li>
                    )}
                    {p.keys.map((k) => (
                      <li
                        key={k.id}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
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
                          </p>
                          {k.health === "limited" && k.limitUntil && (
                            <p className="mt-1 text-label text-rose-300">
                              <Icon name="fa-circle-exclamation" className="mr-1.5" />
                              {k.limitReason}
                              {" · "}
                              {t("กลับมาใช้ {time}", {
                                time: formatInZone(
                                  new Date(k.limitUntil),
                                  rule?.resetTimezone ?? "Asia/Bangkok",
                                ),
                              })}
                            </p>
                          )}
                        </div>
                        {k.health === "limited" && (
                          <form action={clearKeyLimitAction} className="shrink-0">
                            <input type="hidden" name="keyId" value={k.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-white/[0.07] bg-white/5 px-2.5 py-1 text-micro text-fg-muted transition hover:text-leaf"
                              title={t("ปลดลิมิตตอนนี้ ใช้หลังเติมเครดิตหรืออัปเกรดแผนแล้ว")}
                            >
                              <Icon name="fa-rotate-left" /> {t("ปลดลิมิต")}
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ------- กติกาจับลิมิตของค่ายนี้ ------- */}
                <form
                  action={saveKeyLimitAction}
                  className="space-y-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                >
                  <input type="hidden" name="providerId" value={p.providerId} />
                  {/* เก็บสถานะเปิด/ปิดตามที่สวิตช์ตั้งไว้ แยกจากการแก้ไขเงื่อนไข */}
                  <input type="hidden" name="enabled" value={String(enabled)} />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-label text-fg-subtle">
                      {t("HTTP status ที่ถือว่าติดลิมิต")}
                      <input
                        name="httpStatuses"
                        defaultValue={listValue(rule?.httpStatuses)}
                        className="input mt-1 font-mono"
                        placeholder="402, 429"
                      />
                    </label>
                    <label className="text-label text-fg-subtle">
                      {t("error code / type ในข้อความตอบกลับ")}
                      <input
                        name="errorCodes"
                        defaultValue={listValue(rule?.errorCodes)}
                        className="input mt-1 font-mono"
                        placeholder="insufficient_quota"
                      />
                    </label>
                    <label className="text-label text-fg-subtle">
                      {t("คำสำคัญในข้อความ error")}
                      <input
                        name="keywords"
                        defaultValue={listValue(rule?.keywords)}
                        className="input mt-1 font-mono"
                        placeholder="quota exceeded, upgrade your plan"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
                    <label className="text-label text-fg-subtle">
                      {t("เวลารีเซตของค่าย")}
                      <input name="resetTime" type="time" defaultValue={rule?.resetTime ?? "13:00"} className="input mt-1" />
                    </label>
                    <label className="text-label text-fg-subtle">
                      {t("ไทม์โซนของเวลาดังกล่าว")}
                      <input
                        name="resetTimezone"
                        defaultValue={rule?.resetTimezone ?? "Asia/Bangkok"}
                        className="input mt-1 font-mono"
                        placeholder="Asia/Bangkok"
                      />
                    </label>
                    <button type="submit" className="btn-primary !py-2.5 whitespace-nowrap">
                      <Icon name="fa-floppy-disk" /> {t("บันทึกกติกา")}
                    </button>
                  </div>

                  <p className="text-label text-fg-subtle">
                    <Icon name="fa-clock-rotate-left" className="mr-1.5 text-brand-300" />
                    {t("ถ้ายิงแล้วตรงเงื่อนไข คีย์นั้นจะถูกพักจนถึง {time}", {
                      time: formatInZone(nextReset, rule?.resetTimezone ?? "Asia/Bangkok"),
                    })}
                  </p>
                </form>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
