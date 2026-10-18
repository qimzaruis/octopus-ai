import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listRequests } from "@/lib/data/usage";
import RequestsTable from "@/components/RequestsTable";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

const STATUS_TABS = [
  { key: "all", label: "ทั้งหมด", icon: "fa-solid fa-layer-group" },
  { key: "success", label: "สำเร็จ", icon: "fa-solid fa-circle-check" },
  { key: "error", label: "ผิดพลาด", icon: "fa-solid fa-circle-xmark" },
  { key: "rate_limited", label: "Rate limited", icon: "fa-solid fa-hourglass-half" },
];

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const user = (await getSessionUser())!;
  const t = await getT();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const q = sp.q ?? "";
  const status = sp.status ?? "all";

  const { items, total } = await listRequests(user.id, {
    page,
    perPage: PER_PAGE,
    q,
    status,
  });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hasFilter = Boolean(q) || status !== "all";

  const qs = (over: Record<string, string | number>) => {
    const params = new URLSearchParams();
    const merged = { q, status, page, ...over };
    if (merged.q) params.set("q", String(merged.q));
    if (merged.status && merged.status !== "all") params.set("status", String(merged.status));
    if (Number(merged.page) > 1) params.set("page", String(merged.page));
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title={t("ประวัติการเรียกใช้")}
        description={t("ทุก request ที่เรียกผ่าน Octopus API — คลิกแถวเพื่อดูรายละเอียด")}
        actions={
          <Badge tone="neutral" icon="fa-solid fa-list-check">
            {t("{n} รายการ", { n: total.toLocaleString() })}
          </Badge>
        }
      />

      {/* Filter bar */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <form className="relative flex-1" action="/requests" method="get">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Icon name="fa-magnifying-glass" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-fg-subtle" />
          <input
            name="q"
            defaultValue={q}
            aria-label={t("ค้นหาประวัติการเรียกใช้")}
            placeholder={t("ค้นหาจากโมเดล, agent หรือ route...")}
            className="input !pl-10"
          />
        </form>

        {/* scroll-x + max-w-full: 4 แท็บสถานะ intrinsic ~370px ซึ่งกว้างกว่าการ์ดที่ 360px
            เดิมไม่มีทางเลื่อนได้ (segmented เป็น inline-flex) แท็บสุดท้ายจึงถูกตัดหาย */}
        <div className="segmented scroll-x max-w-full shrink-0">
          {/* ชื่อตัวแปรต้องไม่ใช่ t เพราะชนกับฟังก์ชันแปลที่ประกาศไว้ด้านบน */}
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/requests${qs({ status: tab.key, page: 1 })}`}
              className={`chip-toggle ${status === tab.key ? "chip-toggle-active" : ""}`}
            >
              <Icon name={tab.icon} className="mr-1.5 text-micro" />
              {t(tab.label)}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {items.length === 0 && hasFilter ? (
          <EmptyState
            icon="fa-solid fa-magnifying-glass"
            title={t("ไม่พบรายการที่ตรงกับเงื่อนไข")}
            description="ลองปรับคำค้นหา หรือล้างตัวกรองสถานะเพื่อดูรายการทั้งหมด"
            action={
              <Link href="/requests" className="btn-ghost !py-2 text-xs">
                <Icon name="fa-rotate-left" className="text-label" /> {t("ล้างตัวกรอง")}
              </Link>
            }
          />
        ) : (
          <RequestsTable items={items} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-fg-subtle">
            {t("หน้า")} <span className="font-medium text-fg-muted">{page}</span> {t("จาก")} {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/requests${qs({ page: page - 1 })}`} className="btn-ghost !py-2 text-xs">
                <Icon name="fa-chevron-left" className="text-micro" /> {t("ก่อนหน้า")}
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/requests${qs({ page: page + 1 })}`} className="btn-ghost !py-2 text-xs">
                {t("ถัดไป")} <Icon name="fa-chevron-right" className="text-micro" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}