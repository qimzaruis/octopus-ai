import type { ProviderKeyDTO } from "@/lib/data/admin";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

/**
 * ป้ายสถานะคีย์ของ provider — ใช้ร่วมกันทั้งหน้า providers และ key-limits
 *
 * "ติดลิมิต" = โควต้าของค่ายหมด (พักถึงเวลารีเซตของค่ายนั้นตามกติกาใน
 * /admin/key-limits) ซึ่งต่างจาก "พัก" = backoff ชั่วคราวหลังเจอ error
 */
const PILL = "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-label";

export default async function KeyHealthBadge({ k }: { k: ProviderKeyDTO }) {
  const t = await getT();

  if (!k.enabled) {
    return (
      <span className={`${PILL} bg-white/[0.06] text-fg-subtle`}>
        <Icon name="fa-circle-pause" className="text-micro" />
        {t("ปิด")}
      </span>
    );
  }

  if (k.health === "limited") {
    const hours = Math.ceil(k.limitMinutes / 60);
    return (
      <span
        className={`${PILL} bg-rose-500/10 text-rose-300`}
        title={k.limitReason || undefined}
      >
        <Icon name="fa-triangle-exclamation" className="text-micro" />
        {hours >= 2
          ? t("ติดลิมิต · อีก {n} ชม.", { n: hours })
          : t("ติดลิมิต · อีก {n} นาที", { n: Math.max(1, k.limitMinutes) })}
      </span>
    );
  }

  if (k.health === "cooling") {
    return (
      <span className={`${PILL} bg-amber-glow/10 text-amber-glow`}>
        <Icon name="fa-hourglass-half" className="text-micro" />
        {t("พัก {n} นาที", { n: k.cooldownMinutes })}
      </span>
    );
  }

  return (
    <span className={`${PILL} bg-leaf/10 text-leaf`}>
      <Icon name="fa-circle-check" className="text-micro" />
      {t("พร้อมใช้")}
    </span>
  );
}
