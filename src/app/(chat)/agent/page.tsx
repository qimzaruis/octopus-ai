import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AgentWorkspace from "@/components/AgentWorkspace";
import { loadChatContext } from "../chat-context";

export const dynamic = "force-dynamic";

/** หน้าเริ่มแชทใหม่ (ไม่มีห้องใน URL) */
export default async function AgentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const { models, conversations, settings, chatReady } = await loadChatContext(
    user.id,
    user.plan,
  );

  return (
    <AgentWorkspace
      userName={user.name}
      initialConversations={conversations}
      models={models}
      maxAttachments={settings.maxAttachments}
      chatReady={chatReady}
      conversationId={null}
    />
  );
}
