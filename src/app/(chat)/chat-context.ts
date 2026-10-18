import { getPlanByKey } from "@/lib/data/plans";
import { listPublicRoutes } from "@/lib/data/models";
import {
  DEFAULT_CHAT_SETTINGS,
  getChatSettings,
  listConversations,
  type ChatConversation,
  type ChatSettings,
} from "@/lib/chat/db";
import type { AgentModel } from "@/components/AgentWorkspace";

export type ChatContext = {
  models: AgentModel[];
  conversations: ChatConversation[];
  settings: ChatSettings;
  chatReady: boolean;
};

/**
 * ข้อมูลที่หน้า /agent และ /c/[id] ต้องใช้เหมือนกัน
 *
 * รายการที่เลือกได้คือ "route" ของหน้า /models (เช่น octopus-free) ไม่ใช่โมเดล
 * ของค่ายต้นทาง — ผู้ใช้ไม่ควรเห็นว่าเบื้องหลังส่งต่อไปไหน
 * เรียงโมเดลที่ไม่บังคับแผนขึ้นก่อน เพื่อให้ตัวฟรีถูกเลือกเป็นค่าเริ่มต้น
 */
/**
 * รายการ route ที่ผู้ใช้ระดับแผนนี้เลือกใช้ได้ — เรียงตัวที่ไม่บังคับแผนขึ้นก่อน
 * เพื่อให้โมเดลฟรีถูกเลือกเป็นค่าเริ่มต้น
 */
export async function loadAgentModels(planKey: string): Promise<AgentModel[]> {
  const models: AgentModel[] = [];
  try {
    const plan = await getPlanByKey(planKey);
    const routes = await listPublicRoutes();
    for (const r of routes) {
      const locked = r.requiredPlanTier != null && r.requiredPlanTier > plan.tier;
      if (locked) continue;
      models.push({
        id: r.publicModel,
        label: r.displayName || r.publicModel,
        logoUrl: r.logoUrl,
        description: r.description,
        inputPricePerM: r.inputPricePerM,
        outputPricePerM: r.outputPricePerM,
        contextWindow: r.targets.reduce((s, t) => Math.max(s, t.contextWindow), 0),
        supportsVision: r.targets.some((t) => t.supportsVision),
      });
    }
  } catch (err) {
    console.error("[agent] โหลดรายชื่อโมเดลไม่สำเร็จ:", err);
  }
  return models;
}

export async function loadChatContext(
  userId: string,
  planKey: string,
): Promise<ChatContext> {
  const models = await loadAgentModels(planKey);

  let conversations: ChatConversation[] = [];
  let settings: ChatSettings = DEFAULT_CHAT_SETTINGS;
  let chatReady = true;
  try {
    [conversations, settings] = await Promise.all([
      listConversations(userId),
      getChatSettings(),
    ]);
  } catch (err) {
    chatReady = false;
    console.error("[agent] เชื่อม CHAT_DATABASE ไม่ได้:", err);
  }

  return { models, conversations, settings, chatReady };
}
