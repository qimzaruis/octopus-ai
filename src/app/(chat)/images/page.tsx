import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ImageStudio from "@/components/ImageStudio";
import ImagesWorkspace from "@/components/ImagesWorkspace";
import { loadImageModels } from "@/app/(chat)/chat-context";
import { listConversations, listImageJobs, type ImageJob } from "@/lib/chat/db";

export const dynamic = "force-dynamic";

/**
 * หน้าสร้างรูปภาพ — ใช้กรอบ/sidebar เดียวกับ Web Agent
 * ต่างกันแค่ main content ที่เป็น ImageStudio แทนห้องแชท
 */
export default async function ImagesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const [imageModels, jobs, conversations] = await Promise.all([
    loadImageModels(user.plan),
    listImageJobs(user.id).catch((err) => {
      console.error("[images] โหลดคิวไม่สำเร็จ:", err);
      return [] as ImageJob[];
    }),
    listConversations(user.id).catch((err) => {
      console.error("[images] โหลดประวัติแชทไม่สำเร็จ:", err);
      return [];
    }),
  ]);

  return (
    <ImagesWorkspace userName={user.name} conversations={conversations}>
      <ImageStudio models={imageModels} initialJobs={jobs} />
    </ImagesWorkspace>
  );
}
