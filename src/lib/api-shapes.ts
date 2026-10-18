/**
 * แปลงโครงสร้าง request/response ระหว่างรูปแบบ API สาธารณะกับรูปแบบภายใน
 *
 * ภายใน gateway ใช้โครงสร้าง OpenAI (chat/completions) เสมอ เพราะค่ายต้นทาง
 * ส่วนใหญ่พูดภาษาเดียวกัน — ไฟล์นี้แค่แปล "หน้าฉาก" ให้ client ของ Anthropic
 * (/v1/messages) และ OpenAI Responses API (/v1/responses) ใช้ได้จริง
 */

import type { UpstreamMessage, UpstreamToolCall } from "@/lib/gateway";

type Block = {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  source?: { type?: string; media_type?: string; data?: string };
};

/** รวมข้อความจาก content แบบ string | block[] ให้เป็น string เดียว */
function blockText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return (value as Block[])
    .filter((b) => b && b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("");
}

/**
 * Anthropic messages → OpenAI messages
 *
 * system แยกฟิลด์, tool_use กลายเป็น assistant.tool_calls,
 * tool_result (ซึ่ง Anthropic ส่งมาเป็น message ฝั่ง user) กลายเป็น role:"tool"
 */
export function anthropicToMessages(input: {
  system?: unknown;
  messages?: unknown;
}): UpstreamMessage[] {
  const out: UpstreamMessage[] = [];
  const system = blockText(input.system);
  if (system) out.push({ role: "system", content: system });

  for (const raw of Array.isArray(input.messages) ? input.messages : []) {
    const m = raw as { role?: string; content?: unknown };
    const role: "user" | "assistant" = m.role === "assistant" ? "assistant" : "user";
    if (typeof m.content === "string") {
      out.push({ role, content: m.content });
      continue;
    }
    const blocks = (Array.isArray(m.content) ? m.content : []) as Block[];
    const texts: string[] = [];
    const images: Record<string, unknown>[] = [];
    const toolCalls: UpstreamToolCall[] = [];
    const toolResults: UpstreamMessage[] = [];

    for (const b of blocks) {
      if (!b || typeof b !== "object") continue;
      if (b.type === "text" && b.text) texts.push(b.text);
      else if (b.type === "image" && b.source?.data)
        images.push({
          type: "image_url",
          image_url: { url: `data:${b.source.media_type ?? "image/png"};base64,${b.source.data}` },
        });
      else if (b.type === "tool_use" && b.id)
        toolCalls.push({
          id: b.id,
          type: "function",
          function: { name: b.name ?? "tool", arguments: JSON.stringify(b.input ?? {}) },
        });
      else if (b.type === "tool_result" && b.tool_use_id)
        toolResults.push({ role: "tool", tool_call_id: b.tool_use_id, content: blockText(b.content) });
    }

    if (toolResults.length > 0) out.push(...toolResults);
    else if (images.length > 0)
      out.push({ role, content: [{ type: "text", text: texts.join("\n") }, ...images] });
    else if (toolCalls.length > 0)
      out.push({ role: "assistant", content: texts.join("\n"), tool_calls: toolCalls });
    else out.push({ role, content: texts.join("\n") });
  }
  return out;
}

export function anthropicResponse(args: {
  id: string;
  model: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
  stopReason?: string;
}): Record<string, unknown> {
  return {
    id: args.id,
    type: "message",
    role: "assistant",
    model: args.model,
    content: args.text ? [{ type: "text", text: args.text }] : [],
    stop_reason: args.stopReason === "length" ? "max_tokens" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: args.inputTokens, output_tokens: args.outputTokens },
  };
}

/** 1 event ของ SSE รูปแบบ Anthropic */
export function anthropicEvent(name: string, data: Record<string, unknown>): string {
  return `event: ${name}\ndata: ${JSON.stringify({ type: name, ...data })}\n\n`;
}

/** OpenAI responses API: "input" เป็น string หรือ array ของ items */
export function responsesToMessages(input: {
  input?: unknown;
  instructions?: unknown;
}): UpstreamMessage[] {
  const out: UpstreamMessage[] = [];
  const instructions = blockText(input.instructions);
  if (instructions) out.push({ role: "system", content: instructions });

  if (typeof input.input === "string") {
    out.push({ role: "user", content: input.input });
    return out;
  }
  for (const raw of Array.isArray(input.input) ? input.input : []) {
    const item = raw as {
      type?: string;
      role?: string;
      content?: unknown;
      call_id?: string;
      name?: string;
      args?: unknown;
      output?: unknown;
    };
    if (item.type === "function_call" && item.call_id) {
      out.push({
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: item.call_id,
            type: "function",
            function: {
              name: item.name ?? "tool",
              arguments: typeof item.args === "string" ? item.args : JSON.stringify(item.args ?? {}),
            },
          } as UpstreamToolCall,
        ],
      });
      continue;
    }
    if (item.type === "function_call_output" && item.call_id) {
      out.push({ role: "tool", tool_call_id: item.call_id, content: blockText(item.output) });
      continue;
    }
    const role: UpstreamMessage["role"] =
      item.role === "assistant" ? "assistant" : item.role === "system" ? "system" : "user";
    out.push({ role, content: blockText(item.content) });
  }
  return out;
}

export function responseObject(args: {
  id: string;
  model: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
}): Record<string, unknown> {
  return {
    id: args.id,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: "completed",
    error: null,
    model: args.model,
    output: [
      {
        id: `msg_${args.id}`,
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: args.text, annotations: [] }],
      },
    ],
    output_text: args.text,
    usage: {
      input_tokens: args.inputTokens,
      output_tokens: args.outputTokens,
      total_tokens: args.inputTokens + args.outputTokens,
    },
  };
}

export function responsesEvent(name: string, data: Record<string, unknown>): string {
  return `event: ${name}\ndata: ${JSON.stringify({ type: name, ...data })}\n\n`;
}

/** id สั้น ๆ ที่ขึ้นต้นตามแบบของแต่ละ API (msg_..., resp_...) */
export function apiId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
