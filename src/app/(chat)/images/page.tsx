import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ImageStudio from "@/components/ImageStudio";
import Badge from "@/components/Badge";
import Icon from "@/components/Icon";
import { getT } from "@/lib/i18n/server";
import { loadAgentModels } from "@/app/(chat)/chat-context";
import { listImageJobs, type ImageJob } from "@/lib/chat/db";

export const dynamic = "force-dynamic";

/**
 * หน้าสร้างรูปภาพ — full-screen เหมือนโหมดแชท ไม่มี sidebar ของ dashboard
 * มีปุ่มย้อนกลับไป dashboard ที่มุมซ้ายบน
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
    <div className="flex h-dvh flex-col bg-ink-950">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 pt-[env(safe-area-inset-top)] sm:px-6">
        <Link
          href="/dashboard"
          aria-label={t("กลับ Dashboard")}
          className="touch-min inline-flex shrink-0 items-center gap-2 rounded-md px-2.5 text-caption font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg"
        >
          <Icon name="fa-arrow-left" className="text-micro" />
          <span className="text-micro sm:text-caption">{t("กลับ Dashboard")}</span>
        </Link>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-body-sm font-semibold text-fg">{t("สร้างรูปภาพ")}</p>
          <p className="hidden truncate text-label text-fg-subtle sm:block">
            {t("บอกสิ่งที่ต้องการ เลือกสัดส่วน และแนบรูปเป็นอ้างอิงได้")}
          </p>
        </div>
        <Badge tone="brand" icon="fa-solid fa-wand-magic-sparkles">
          {t("{n} โมเดล", { n: models.length })}
        </Badge>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pt-5">
        <div className="mx-auto max-w-6xl">
          <ImageStudio models={models} initialJobs={jobs} />
        </div>
      </div>
    </div>
  );
}
