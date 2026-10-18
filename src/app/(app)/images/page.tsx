import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ImageStudio from "@/components/ImageStudio";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { getT } from "@/lib/i18n/server";
import { loadAgentModels } from "@/app/(chat)/chat-context";
import { listImageJobs, type ImageJob } from "@/lib/chat/db";

export const dynamic = "force-dynamic";

/**
 * หน้าสร้างรูปภาพ — แยกจากหน้าแชท
 * ขั้นนี้ยังเป็นการเก็บงานเข้าคิว (ตัวสร้างรูปจริงต่อเข้ากับ gateway ในขั้นถัดไป)
 */
export default async function ImagesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const t = await getT();

  const models = await loadAgentModels(user.plan);
  let jobs: ImageJob[] = [];
  try {
    jobs = await listImageJobs(user.id);
  } catch (err) {
    console.error("[images] โหลดคิวไม่สำเร็จ:", err);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t("สร้างรูปภาพ")}
        description={t("บอกสิ่งที่ต้องการ เลือกสัดส่วน และแนบรูปเป็นอ้างอิงได้")}
        actions={
          <Badge tone="brand" icon="fa-solid fa-wand-magic-sparkles">
            {t("{n} โมเดล", { n: models.length })}
          </Badge>
        }
      />
      <ImageStudio models={models} initialJobs={jobs} />
    </div>
  );
}
