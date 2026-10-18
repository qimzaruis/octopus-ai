/**
 * POST /v1/chat/completions — API สาธารณะที่เข้ากันได้กับ OpenAI SDK
 *
 *   curl https://<โดเมนของคุณ>/v1/chat/completions \
 *     -H "Authorization: Bearer sk-oct-..." \
 *     -H "Content-Type: application/json" \
 *     -d '{"model":"octopus-free","messages":[{"role":"user","content":"สวัสดี"}],"stream":true}'
 *
 * ผู้ใช้เรียกด้วยชื่อ route (octopus-free) เสมอ — ระบบเป็นคนเลือกค่ายเอง
 * และ log ทุก request ลงตาราง requests เพื่อให้หน้า dashboard/requests เห็นจริง
 */

import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { detectAgent } from "@/lib/agent-detect";
import { getPlanByKey } from "@/lib/data/plans";
import { listPublicRoutes, getUserQuota } from "@/lib/data/models";
import {
  createSseAccumulator,
  estimateTokens,
  estimateTokensFromChars,
  GatewayError,
  invokeUpstream,
  logRequest,
  userSafeMessage,
  type GatewayTarget,
  type GatewayUsage,
  type InvokeResult,
  type UpstreamMessage,
} from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  model?: string;
  messages?: UpstreamMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  /** เครื่องมือแบบ OpenAI — ส่งต่อให้ต้นทางตามเดิม แอปภายนอก (claude code, cursor) ใช้เยอะ */
  tools?: unknown[];
};

/** error body รูปแบบเดียวกับ OpenAI เพื่อให้ client เดิมอ่านได้ */
function openaiError(message: string, type: string, status: number, code?: string) {
  return Response.json(
    { error: { message, type, param: null, code: code ?? null } },
    { status },
  );
}

function hasImage(messages: UpstreamMessage[]): boolean {
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

/** จำนวนอักขระใน prompt — ใช้ประมาณ token เมื่อค่ายต้นทางไม่ส่ง usage มา */
function promptChars(messages: UpstreamMessage[]): number {
  return messages.reduce((sum, m) => {
    if (typeof m.content === "string") return sum + m.content.length;
    if (!Array.isArray(m.content)) return sum;
    return (
      sum +
      (m.content as { text?: string }[]).reduce((s, p) => s + (p?.text?.length ?? 0), 0)
    );
  }, 0);
}

/** log request ที่ล้มเหลวตั้งแต่ยังไม่ถึงค่ายต้นทาง (ไม่มี target จริง) */
function failedTarget(publicModel: string): GatewayTarget {
  return {
    modelRefId: 0,
    modelId: publicModel,
    providerId: 0,
    providerName: "",
    baseUrl: "",
    inputPricePerM: 0,
    outputPricePerM: 0,
    supportsVision: false,
    contextWindow: 0,
  };
}

export async function POST(req: NextRequest) {
  // เช็คคีย์ (ไป DB) ควบคู่ไปกับการอ่าน body — client ที่ส่ง payload ใหญ่จะได้ไม่ต้องรอต่อกัน
  const [principal, parsed] = await Promise.all([
    authenticateApiKey(req),
    req.json().catch(() => null),
  ]);
  if (!principal) {
    return openaiError(
      "ไม่ได้ให้ API key ที่ถูกต้อง (ใส่ Authorization: Bearer sk-oct-...)",
      "invalid_request_error",
      401,
      "invalid_api_key",
    );
  }
  if (principal.user.banned) {
    return openaiError("บัญชีนี้ถูกระงับการใช้งาน", "permission_denied_error", 403);
  }

  const body = parsed as Body | null;
  const model = (body?.model ?? "").trim();
  const messages = body?.messages;
  if (!model) return openaiError("ขาดฟิลด์ model", "invalid_request_error", 400);
  if (!Array.isArray(messages) || messages.length === 0) {
    return openaiError("ขาดฟิลด์ messages (ต้องเป็น array)", "invalid_request_error", 400);
  }
  const stream = Boolean(body?.stream);

  // ตรวจสิทธิ์ตามแผนของผู้ใช้ — ไม่เชื่อชื่อโมเดลที่ client ส่งมาเฉย ๆ
  const [plan, publicRoutes] = await Promise.all([
    getPlanByKey(principal.user.plan),
    listPublicRoutes(),
  ]);
  const route = publicRoutes.find((r) => r.publicModel === model);
  if (!route) {
    return openaiError(
      `ไม่พบโมเดล "${model}" — ดูรายชื่อที่ GET /v1/models`,
      "invalid_request_error",
      404,
      "model_not_found",
    );
  }
  if (route.requiredPlanTier != null && route.requiredPlanTier > plan.tier) {
    return openaiError(
      `โมเดลนี้ต้องใช้แผน ${route.requiredPlanLabel} ขึ้นไป`,
      "insufficient_quota",
      403,
      "plan_required",
    );
  }

  const quota = await getUserQuota(principal.user.id, principal.user.plan);
  if (quota.cycleExhausted || quota.dailyExhausted) {
    return openaiError(
      "ใช้โควต้าครบแล้วสำหรับรอบนี้ — รอรีเซตหรืออัปเกรดแผน",
      "insufficient_quota",
      429,
      "quota_exceeded",
    );
  }

  const chars = promptChars(messages);
  const startedAt = Date.now();
  const log = (input: {
    target: GatewayTarget;
    status: "success" | "error" | "rate_limited";
    httpStatus: number;
    usage: GatewayUsage;
    error?: string;
  }) =>
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
    });

  let result;
  try {
    result = await invokeUpstream({
      publicModel: model,
      messages,
      stream,
      temperature: body?.temperature,
      maxTokens: body?.max_tokens,
      tools: body?.tools,
      filter: hasImage(messages) ? (t) => t.supportsVision : undefined,
    });
  } catch (err) {
    const gw = err instanceof GatewayError ? err : null;
    const message = gw?.message ?? (err as Error).message ?? "unknown error";
    // รายละเอียดเต็ม (รวมชื่อค่าย) เก็บไว้ที่ log ฝั่งเซิร์ฟเวอร์เท่านั้น
    log({
      target: failedTarget(model),
      status: gw?.code === "keys_limited" ? "rate_limited" : "error",
      httpStatus: gw?.status ?? 502,
      usage: { inputTokens: estimateTokensFromChars(chars), outputTokens: 0 },
      error: message,
    });
    return openaiError(
      userSafeMessage(err),
      gw?.code === "keys_limited" ? "rate_limit_error" : "upstream_error",
      gw?.status ?? 502,
      gw?.code,
    );
  }

  if (!stream) {
    const raw = await new Response(result.body).text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      log({
        target: result.target,
        status: "error",
        httpStatus: 502,
        usage: { inputTokens: 0, outputTokens: 0 },
        error: "upstream returned non-json",
      });
      return openaiError("ค่ายต้นทางตอบกลับไม่ใช่ JSON", "upstream_error", 502);
    }
    const up = json.usage as
      | { prompt_tokens?: number; completion_tokens?: number }
      | undefined;
    const answer = (json.choices as { message?: { content?: string } }[] | undefined)?.[0]
      ?.message?.content;
    const usage: GatewayUsage = up
      ? {
          inputTokens: Number(up.prompt_tokens ?? 0),
          outputTokens: Number(up.completion_tokens ?? 0),
        }
      : {
          inputTokens: estimateTokensFromChars(chars),
          outputTokens: estimateTokens(typeof answer === "string" ? answer : ""),
        };
    log({ target: result.target, status: "success", httpStatus: 200, usage });
    return Response.json({ ...json, model });
  }

  // stream: ส่ง SSE ของค่ายต้นทางผ่านไปตามเดิม พร้อมนับ usage ไปด้วย
  const acc = createSseAccumulator(() => estimateTokensFromChars(chars));
  const decoder = new TextDecoder();
  const upstream = result.body;
  const passed = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let failed = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc.push(decoder.decode(value, { stream: true }));
          controller.enqueue(value);
        }
      } catch (err) {
        failed = (err as Error).message;
      }
      controller.close();
      log({
        target: result.target,
        status: failed ? "error" : "success",
        httpStatus: failed ? 500 : 200,
        usage: acc.usage(),
        error: failed || undefined,
      });
    },
  });

  return new Response(passed, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
