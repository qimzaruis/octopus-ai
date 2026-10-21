import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ImageStudio from "@/components/ImageStudio";
import ImagesWorkspace from "@/components/ImagesWorkspace";
import { loadChatContext } from "@/app/(chat)/chat-context";
import { listImageJobs, type ImageJob } from "@/lib/chat/db";

export const dynamic = "force-dynamic";

/**
 * หน้าสร้างรูปภาพ — ใช้กรอบ/sidebar เดียวกับ Web Agent
 * ต่างกันแค่ main content ที่เป็น ImageStudio แทนห้องแชท
 */
export default async function ImagesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const [context, jobs] = await Promise.all([
    loadChatContext(user.id, user.plan),
    listImageJobs(user.id).catch((err) => {
      console.error("[images] โหลดคิวไม่สำเร็จ:", err);
      return [] as ImageJob[];
    }),
  ]);

  return (
    <ImagesWorkspace
      userName={user.name}
      conversations={context.conversations}
      modelCount={context.models.length}
    >
      <ImageStudio models={context.models} initialJobs={jobs} />
    </ImagesWorkspace>
  );
}
