/**
 * ส่วนกลางของ endpoint สาธารณะ /v1/* — ตรวจคีย์ → สิทธิ์แผน → โควต้า → log
 *
 * ทุกรูปแบบ API ที่เรารองรับ (OpenAI chat completions, Anthropic messages,
 * OpenAI responses) ใช้ร่วมกัน แล้วค่อยแปลง request/response ตามรูปแบบของตัวเอง
 * ในแต่ละ route เพื่อไม่ให้กติกาการคิดเงินต่างกันตาม path
 */

import type { NextRequest } from "next/server";
import { authenticateApiKey, type ApiPrincipal } from "@/lib/api-auth";
import { detectAgent } from "@/lib/agent-detect";
import { getPlanByKey } from "@/lib/data/plans";
import { getUserQuota, listPublicRoutes } from "@/lib/data/models";
import {
  invokeUpstream,
  logRequest,
  type GatewayTarget,
  type GatewayUsage,
  type InvokeInput,
  type InvokeResult,
  type UpstreamMessage,
} from "@/lib/gateway";

export type ApiError = {
  status: number;
  message: string;
  /** ประเภท error แบบ OpenAI — route ของ Anthropic แปลงเป็นศัพท์ของตัวเองอีกที */
  kind:
    | "invalid_request_error"
    | "authentication_error"
    | "permission_denied_error"
    | "not_found_error"
    | "rate_limit_error"
    | "upstream_error";
};

export type ApiCall = {
  principal: ApiPrincipal;
  model: string;
  invoke: (input: Omit<InvokeInput, "publicModel">) => Promise<InvokeResult>;
  /** เขียนประวัติลงตาราง requests แบบไม่รอ (ทุก path ต้อง log แม้ล้มก่อนถึงค่าย) */
  log: (input: {
    target: GatewayTarget;
    status: "success" | "error" | "rate_limited";
    httpStatus: number;
    usage: GatewayUsage;
    error?: string;
  }) => void;
};

/** จำนวนอักขระใน prompt ทั้งหมด — ใช้ประมาณ token เมื่อค่ายต้นทางไม่ส่ง usage มา */
export function promptChars(messages: UpstreamMessage[]): number {
  return messages.reduce((sum, m) => {
    if (typeof m.content === "string") return sum + m.content.length;
    if (!Array.isArray(m.content)) return sum;
    return (
      sum + (m.content as { text?: string }[]).reduce((s, p) => s + (p?.text?.length ?? 0), 0)
    );
  }, 0);
}

/** ในข้อความมีรูปภาพไหม — มีให้จำกัดเฉพาะปลายทางที่รับรูปได้ */
export function hasImage(messages: UpstreamMessage[]): boolean {
  return messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some(
        (part) =>
          typeof part === "object" &&
          part !== null &&
          (part as { type?: string }).type === "image_url",
      ),
  );
}

export async function authorizeCall(
  req: NextRequest,
  model: string,
  messages: UpstreamMessage[],
): Promise<{ ok: true; call: ApiCall } | { ok: false; error: ApiError }> {
  const principal = await authenticateApiKey(req);
  if (!principal) {
    return {
      ok: false,
      error: {
        status: 401,
        kind: "authentication_error",
        message: "ไม่ได้ให้ API key ที่ถูกต้อง (ใส่ Authorization: Bearer sk-oct-... หรือ x-api-key)",
      },
    };
  }
  if (principal.user.banned) {
    return { ok: false, error: { status: 403, kind: "permission_denied_error", message: "บัญชีนี้ถูกระงับการใช้งาน" } };
  }
  if (!model) {
    return { ok: false, error: { status: 400, kind: "invalid_request_error", message: "ขาดฟิลด์ model" } };
  }
  if (messages.length === 0) {
    return {
      ok: false,
      error: { status: 400, kind: "invalid_request_error", message: "ขาดฟิลด์ messages (ต้องเป็น array)" },
    };
  }

  const [plan, publicRoutes] = await Promise.all([
    getPlanByKey(principal.user.plan),
    listPublicRoutes(),
  ]);
  const route = publicRoutes.find((r) => r.publicModel === model);
  if (!route) {
    return {
      ok: false,
      error: {
        status: 404,
        kind: "not_found_error",
        message: `ไม่พบโมเดล "${model}" — ดูรายชื่อที่ GET /v1/models`,
      },
    };
  }
  if (route.requiredPlanTier != null && route.requiredPlanTier > plan.tier) {
    return {
      ok: false,
      error: {
        status: 403,
        kind: "permission_denied_error",
        message: `โมเดลนี้ต้องใช้แผน ${route.requiredPlanLabel} ขึ้นไป`,
      },
    };
  }

  const quota = await getUserQuota(principal.user.id, principal.user.plan);
  if (quota.cycleExhausted || quota.dailyExhausted) {
    return {
      ok: false,
      error: {
        status: 429,
        kind: "rate_limit_error",
        message: "ใช้โควต้าครบแล้วสำหรับรอบนี้ — รอรีเซตหรืออัปเกรดแผน",
      },
    };
  }

  const chars = promptChars(messages);
  const startedAt = Date.now();

  return {
    ok: true,
    call: {
      principal,
      model,
      invoke: (input) =>
        invokeUpstream({
          publicModel: model,
          messages: input.messages,
          stream: input.stream,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          tools: input.tools,
          filter: input.filter ?? (hasImage(messages) ? (t) => t.supportsVision : undefined),
        }),
      log: (input) =>
        void logRequest({
          userId: principal.user.id,
          apiKeyId: principal.apiKeyId,
          target: input.target,
          publicModel: model,
          agent: detectAgent(req.headers),
          status: input.status,
          httpStatus: input.httpStatus,
          usage: input.usage,
          latencyMs: Date.now() - startedAt,
          error: input.error,
        }),
    },
  };
}
