"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";

/**
 * แถบค้นหา + ตัวกรองหน้าจัดการผู้ใช้ (แอดมิน)
 *
 * ค้นหาเป็น GET form เหมือนเดิม (กด Enter เพื่อค้น) ส่วนตัวเลือก "สถานะ" และ "แผน"
 * ส่งฟอร์มอัตโนมัติเมื่อเปลี่ยนค่า (form.requestSubmit) เพื่อให้กรองได้ในคลิกเดียว
 */
export default function UserFilterForm({
  q,
  status,
  plan,
  plans,
}: {
  q: string;
  status: string;
  plan: string;
  plans: { key: string; label: string }[];
}) {
  const t = useT();
  const hasFilter = Boolean(q || status || plan);

  return (
    <form action="/admin/users" method="get" className="space-y-3">
      <div className="relative">
        <Icon name="fa-magnifying-glass" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-caption text-fg-subtle" />
        <input
          name="q"
          defaultValue={q}
          aria-label={t("ค้นหาผู้ใช้")}
          placeholder={t("ค้นหาจากชื่อหรืออีเมล...")}
          className="input !pl-10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Icon name="fa-filter" className="text-caption text-fg-subtle" />

        <select
          name="status"
          defaultValue={status}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          aria-label={t("สถานะบัญชี")}
          className="input !w-auto !py-2 text-caption"
        >
          <option value="">{t("ทุกสถานะ")}</option>
          <option value="active">{t("บัญชีปกติ")}</option>
          <option value="banned">{t("ถูกระงับ")}</option>
        </select>

        <select
          name="plan"
          defaultValue={plan}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          aria-label={t("แผนการใช้งาน")}
          className="input !w-auto !py-2 text-caption"
        >
          <option value="">{t("ทุกแผน")}</option>
          {plans.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>

        <noscript>
          <button type="submit" className="btn-secondary !py-2 text-label">
            {t("กรอง")}
          </button>
        </noscript>

        {hasFilter && (
          <Link href="/admin/users" className="btn-ghost !py-2 text-label">
            <Icon name="fa-rotate-left" className="text-label" /> {t("ล้างตัวกรอง")}
          </Link>
        )}
      </div>
    </form>
  );
}