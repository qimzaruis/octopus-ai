import Link from "next/link";
import { listPublicRoutes } from "@/lib/data/models";
import { getPublicModelHealth24h, getPublicModelUsage } from "@/lib/data/usage";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import ModelsExplorer, { type ExplorerModel } from "@/components/ModelsExplorer";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * หน้า "โมเดลที่ใช้ได้" ฝั่งผู้ใช้
 *
 * อ้างอิง route เป็นหลัก (route = โมเดลที่ผู้ใช้เรียกจริง) ไม่เปิดเผยว่า
 * เบื้องหลังส่งต่อไปค่ายไหน — โลโก้/หมวดมาจากคลังรูปที่แอดมินตั้งไว้
 * ตัวกรอง/ค้นหา/เรียงลำดับทำงานฝั่ง client ทั้งหมด (รายการมีไม่กี่สิบตัว)
 */
export default async function ModelsPage() {
  const t = await getT();
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 24 * 3600_000);
  const [routes, usage, health] = await Promise.all([
    listPublicRoutes(),
    getPublicModelUsage("all"),
    getPublicModelHealth24h(),
  ]);

  const models: ExplorerModel[] = routes
    .filter((route) => route.kind !== "image")
    .map((route) => {
    const totals = usage.get(route.publicModel);
    const recent = health.get(route.publicModel);
    return {
      id: route.id,
      publicModel: route.publicModel,
      name: route.displayName || route.publicModel,
      description: route.description,
      logoUrl: route.logoUrl,
      category: route.category
        ? { name: route.category.name, logoUrl: route.category.logoUrl }
        : null,
      inputPricePerM: route.inputPricePerM,
      outputPricePerM: route.outputPricePerM,
      contextWindow: route.targets.reduce((top, target) => Math.max(top, target.contextWindow), 0),
      supportsVision: route.targets.some((target) => target.supportsVision),
      // uptime จาก request จริง 24 ชม.ล่าสุด ไม่ใช่ค่าสถิติรายวันที่รีเซ็ตเที่ยงคืน
      uptime: recent && recent.requests > 0 ? (recent.ok / recent.requests) * 100 : null,
      uptimeRequests: recent?.requests ?? 0,
      tokens: totals?.tokens ?? 0,
      requests: totals?.requests ?? 0,
      requiredPlanLabel: route.requiredPlanLabel,
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={t("โมเดลที่ใช้ได้")}
        description={t(
          "ค้นหาและกรองโมเดลที่บัญชีของคุณเรียกใช้ได้ พร้อมราคา uptime และ tokens ที่ใช้ไป",
        )}
        actions={
          <Badge tone="brand" icon="fa-solid fa-cube">
            {t("{n} โมเดล", { n: models.length })}
          </Badge>
        }
      />

      {models.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="fa-solid fa-cube"
            title={t("ยังไม่มีโมเดลที่เปิดให้ใช้")}
            description={t("แอดมินจะเปิดโมเดลให้ผู้ใช้เห็นจากหน้า โมเดลที่แสดง")}
          />
        </div>
      ) : (
        <ModelsExplorer
          models={models}
          windowStart={windowStart.toISOString()}
          windowEnd={windowEnd.toISOString()}
        />
      )}

      <p className="text-caption text-fg-subtle">
        {t("อยากเริ่มยิง request? ไปสร้างคีย์ที่หน้า")}{" "}
        <Link href="/keys" className="text-brand-300 underline-offset-2 hover:underline">
          API Keys
        </Link>
        {" · "}
        {t("ดูเพดานการใช้งานและแผนที่หน้า")}{" "}
        <Link href="/subscription" className="text-brand-300 underline-offset-2 hover:underline">
          Subscription Plan
        </Link>
      </p>
    </div>
  );
}
