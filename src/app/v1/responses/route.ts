/**
 * POST /v1/responses — API สาธารณะรูปแบบ OpenAI Responses API
 *
 *   curl https://<โดเมน>/v1/responses \
 *     -H "Authorization: Bearer sk-oct-..." -H "Content-Type: application/json" \
 *     -d '{"model":"octopus-free","input":"สวัสดี","stream":false}'
 *
 * client รุ่นใหม่ (OpenAI SDK >= 1.40, Agents SDK) เรียกด้วย shapes นี้แทน chat/completions
 * เราแปลง "input" เป็น messages, วิ่งผ่าน gateway ตัวเดิม แล้วประกอบ output กลับเป็นรูปแบบ response
 */

import { NextRequest } from "next/server";
import { authorizeCall, promptChars, type ApiError } from "@/lib/api-call";
import { apiId, responseObject, responsesEvent, responsesToMessages } from "@/lib/api-shapes";
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
  input?: unknown;
  instructions?: unknown;
  stream?: boolean;
  temperature?: number;
  max_output_tokens?: number;
};

function fail(error: ApiError) {
  return Response.json(
    {
      error: {
        message: error.message,
        type: error.kind === "permission_denied_error" ? "permission_denied" : error.kind,
        param: null,
        code: null,
      },
    },
    { status: error.status },
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const model = (body?.model ?? "").trim();
  const messages = responsesToMessages({ input: body?.input, instructions: body?.instructions });
  const chars = promptChars(messages);
  const stream = Boolean(body?.stream);

  const guard = await authorizeCall(req, model, messages);
  if (!guard.ok) return fail(guard.error);
  const call = guard.call;

  let result;
  try {
    result = await call.invoke({
      messages,
      stream,
      temperature: body?.temperature,
      maxTokens: body?.max_output_tokens,
    });
  } catch (err) {
    const gw = err instanceof GatewayError ? err : null;
    call.log({
      target: failedTarget(model),
      status: "error",
      httpStatus: gw?.status ?? 502,
      usage: { inputTokens: estimateTokensFromChars(chars), outputTokens: 0 },
      error: gw?.message ?? (err as Error).message,
    });
    return fail({ status: gw?.status ?? 502, kind: "upstream_error", message: userSafeMessage(err) });
  }

  const id = apiId("resp");

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
    const text =
      (json.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content ?? "";
    const up = json.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const usage: GatewayUsage = up
      ? { inputTokens: Number(up.prompt_tokens ?? 0), outputTokens: Number(up.completion_tokens ?? 0) }
      : { inputTokens: estimateTokensFromChars(chars), outputTokens: estimateTokens(text) };
    call.log({ target: result.target, status: "success", httpStatus: 200, usage });
    return Response.json(
      responseObject({ id, model, text, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }),
    );
  }

  // stream: ประกอบตัวเหตุการณ์ของ Responses API จาก delta ที่อ่านได้จากค่ายต้นทาง
  const acc = createSseAccumulator(() => estimateTokensFromChars(chars));
  const decoder = new TextDecoder();
  const upstream = result.body;
  const itemId = apiId("msg");
  const passed = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (name: string, data: Record<string, unknown> = {}) =>
        controller.enqueue(enc.encode(responsesEvent(name, { response_id: id, ...data })));
      const base = {
        id,
        object: "response",
        created_at: Math.floor(Date.now() / 1000),
        status: "in_progress",
        model,
        output: [],
      };
      send("response.created", { response: base });
      send("response.in_progress", { response: base });
      send("response.output_item.added", {
        output_index: 0,
        item: { id: itemId, type: "message", role: "assistant", status: "in_progress", content: [] },
      });
      send("response.content_part.added", {
        item_id: itemId,
        output_index: 0,
        content_index: 0,
        part: { type: "output_text", text: "", annotations: [] },
      });

      const reader = upstream.getReader();
      let failed = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const delta = acc.push(decoder.decode(value, { stream: true }));
          if (delta)
            send("response.output_text.delta", {
              item_id: itemId,
              output_index: 0,
              content_index: 0,
              delta,
            });
        }
      } catch (err) {
        failed = (err as Error).message;
      }
      const usage = acc.usage();
      const text = acc.text();
      send("response.output_text.done", {
        item_id: itemId,
        output_index: 0,
        content_index: 0,
        text,
      });
      send("response.content_part.done", {
        item_id: itemId,
        output_index: 0,
        content_index: 0,
        part: { type: "output_text", text, annotations: [] },
      });
      send("response.output_item.done", {
        output_index: 0,
        item: {
          id: itemId,
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text, annotations: [] }],
        },
      });
      send("response.completed", {
        response: responseObject({
          id,
          model,
          text,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        }),
      });
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
