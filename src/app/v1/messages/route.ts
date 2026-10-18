/**
 * POST /v1/messages — API สาธารณะรูปแบบ Anthropic Messages
 *
 *   curl https://<โดเมน>/v1/messages \
 *     -H "x-api-key: sk-oct-..." -H "anthropic-version: 2023-06-01" \
 *     -H "Content-Type: application/json" \
 *     -d '{"model":"octopus-free","max_tokens":512,"messages":[{"role":"user","content":"สวัสดี"}]}'
 *
 * ภายในยังวิ่งผ่าน gateway ตัวเดียวกับ /v1/chat/completions (เลือกค่ายเอง, log, คิดเงิน)
 * แปลงเฉพาะโครงสร้าง request/response ให้ client ของ Claude ใช้ได้ทันที
 */

import { NextRequest } from "next/server";
import { authorizeCall, promptChars, type ApiError } from "@/lib/api-call";
import {
  anthropicEvent,
  anthropicResponse,
  anthropicToMessages,
  apiId,
} from "@/lib/api-shapes";
import {
  createSseAccumulator,
  estimateTokens,
  estimateTokensFromChars,
  failedTarget,
  GatewayError,
  userSafeMessage,
  type GatewayUsage,
} from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  model?: string;
  system?: unknown;
  messages?: unknown;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
};

const ERROR_TYPE: Record<ApiError["kind"], string> = {
  invalid_request_error: "invalid_request_error",
  authentication_error: "authentication_error",
  permission_denied_error: "permission_error",
  not_found_error: "not_found_error",
  rate_limit_error: "rate_limit_error",
  upstream_error: "api_error",
};

function fail(error: ApiError) {
  return Response.json(
    { type: "error", error: { type: ERROR_TYPE[error.kind], message: error.message } },
    { status: error.status },
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const model = (body?.model ?? "").trim();
  const messages = anthropicToMessages({ system: body?.system, messages: body?.messages });
  const chars = promptChars(messages);
  const stream = Boolean(body?.stream);

  const guard = await authorizeCall(req, model, messages);
  if (!guard.ok) return fail(guard.error); // ยังไม่ผ่าน auth/สิทธิ์ — ยังไม่มีเจ้าของ request ให้ log
  const call = guard.call;

  let result;
  try {
    result = await call.invoke({
      messages,
      stream,
      temperature: body?.temperature,
      maxTokens: body?.max_tokens,
    });
  } catch (err) {
    const gw = err instanceof GatewayError ? err : null;
    call.log({
      target: failedTarget(model),
      status: gw?.code === "keys_limited" ? "rate_limited" : "error",
      httpStatus: gw?.status ?? 502,
      usage: { inputTokens: estimateTokensFromChars(chars), outputTokens: 0 },
      error: gw?.message ?? (err as Error).message,
    });
    return fail({
      status: gw?.status ?? 502,
      kind: gw?.code === "keys_limited" ? "rate_limit_error" : "upstream_error",
      message: userSafeMessage(err),
    });
  }

  const id = apiId("msg");

  if (!stream) {
    const raw = await new Response(result.body).text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      call.log({
        target: result.target,
        status: "error",
        httpStatus: 502,
        usage: { inputTokens: 0, outputTokens: 0 },
        error: "upstream returned non-json",
      });
      return fail({ status: 502, kind: "upstream_error", message: "ค่ายต้นทางตอบกลับไม่ใช่ JSON" });
    }
    const choice = (json.choices as { message?: { content?: string }; finish_reason?: string }[] | undefined)?.[0];
    const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
    const up = json.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const usage: GatewayUsage = up
      ? { inputTokens: Number(up.prompt_tokens ?? 0), outputTokens: Number(up.completion_tokens ?? 0) }
      : { inputTokens: estimateTokensFromChars(chars), outputTokens: estimateTokens(text) };
    call.log({ target: result.target, status: "success", httpStatus: 200, usage });
    return Response.json(
      anthropicResponse({
        id,
        model,
        text,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        stopReason: choice?.finish_reason,
      }),
    );
  }

  // stream: อ่าน delta จากค่ายต้นทางแล้วค่อย ๆ ส่งออกเป็นตัวเหตุการณ์ของ Anthropic
  const acc = createSseAccumulator(() => estimateTokensFromChars(chars));
  const decoder = new TextDecoder();
  const upstream = result.body;
  const passed = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (name: string, data: Record<string, unknown>) =>
        controller.enqueue(enc.encode(anthropicEvent(name, data)));
      send("message_start", {
        message: {
          id,
          type: "message",
          role: "assistant",
          content: [],
          model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: estimateTokensFromChars(chars), output_tokens: 0 },
        },
      });
      send("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
      send("ping", {});

      const reader = upstream.getReader();
      let failed = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const delta = acc.push(decoder.decode(value, { stream: true }));
          if (delta) send("content_block_delta", { index: 0, delta: { type: "text_delta", text: delta } });
        }
      } catch (err) {
        failed = (err as Error).message;
      }
      const usage = acc.usage();
      send("content_block_stop", { index: 0 });
      send("message_delta", {
        delta: { stop_reason: failed ? null : "end_turn", stop_sequence: null },
        usage: { output_tokens: usage.outputTokens },
      });
      send("message_stop", {});
      controller.close();
      call.log({
        target: result.target,
        status: failed ? "error" : "success",
        httpStatus: failed ? 500 : 200,
        usage,
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
