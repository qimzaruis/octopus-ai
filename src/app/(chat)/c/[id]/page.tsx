import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AgentWorkspace, { type AgentUiMessage } from "@/components/AgentWorkspace";
import { getConversation } from "@/lib/chat/db";
import { loadChatContext } from "../../chat-context";

export const dynamic = "force-dynamic";

/** แชทหนึ่งห้องอยู่ที่ /c/<uuid> — เปิดซ้ำ/รีเฟรช/ส่งลิงก์ต่อได้ */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const { models, conversations, settings, chatReady } = await loadChatContext(
    user.id,
    user.plan,
  );

  let conversation = null;
  try {
    conversation = await getConversation(user.id, id);
  } catch (err) {
    console.error("[agent] โหลดห้องแชทไม่สำเร็จ:", err);
    notFound();
  }
  if (!conversation) redirect("/agent");

  const initialMessages: AgentUiMessage[] = conversation.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      attachments: m.attachments,
    }));

  return (
    <AgentWorkspace
      userName={user.name}
      initialConversations={conversations}
      models={models}
      maxAttachments={settings.maxAttachments}
      chatReady={chatReady}
      conversationId={conversation.id}
      initialMessages={initialMessages}
      initialModel={conversation.model}
    />
  );
}
