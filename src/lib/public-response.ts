/**
 * สิ่งที่ยอมให้หลุดออกจากเซิร์ฟเวอร์ไปหาลูกค้า
 *
 * คําตอบของค่ายต้นทางมีข้อมูลภายในปนมาด้วยเสมอ — system_fingerprint, id ที่ค่ายตั้ง,
 * metadata ของผู้ให้บริการ และช่อง model ที่เป็น id ปลายทางจริง ซึ่งโยงกลับมาหา
 * ค่ายที่เราใช้ให้ได้ จึงส่งต่อแค่ฟิลด์มาตรฐาน OpenAI ที่ client ต้องการจริง
 * แล้วใส่ชื่อ route ที่ผู้ใช้เรียกกลับเข้าไปแทน
 */

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function publicUsage(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  return pick(asRecord(raw), ["prompt_tokens", "completion_tokens", "total_tokens"]);
}

/** choices แบบไม่ stream — คง role/content/tool_calls ไว้ แต่ตัดฟิลด์อื่นของต้นทาง */
function publicChoice(raw: unknown): Record<string, unknown> {
  const c = asRecord(raw);
  const out: Record<string, unknown> = {
    index: typeof c.index === "number" ? c.index : 0,
    message: pick(asRecord(c.message), ["role", "content", "tool_calls", "function_call"]),
    finish_reason: c.finish_reason ?? null,
  };
  if (c.logprobs !== undefined) out.logprobs = c.logprobs;
  return out;
}

function publicDelta(raw: unknown): Record<string, unknown> {
  const c = asRecord(raw);
  return {
    index: typeof c.index === "number" ? c.index : 0,
    delta: pick(asRecord(c.delta), ["role", "content", "tool_calls", "function_call"]),
    finish_reason: c.finish_reason ?? null,
  };
}

/** id/created ของต้นทางเก็บไว้เพื่อ trace ต่อ request ได้ แต่ model ต้องเป็นชื่อ route */
function publicEnvelope(json: Record<string, unknown>, publicModel: string) {
  const created = typeof json.created === "number" ? json.created : Math.floor(Date.now() / 1000);
  const id = typeof json.id === "string" && json.id ? json.id : `chatcmpl-${created}`;
  return { id, created, model: publicModel };
}

export function publicCompletion(json: Record<string, unknown>, publicModel: string) {
  const usage = publicUsage(json.usage);
  return {
    ...publicEnvelope(json, publicModel),
    object: "chat.completion",
    choices: Array.isArray(json.choices) ? json.choices.map(publicChoice) : [],
    ...(usage ? { usage } : {}),
  };
}

/** 1 บรรทัด `data:` ของ stream → รูปแบบเดิมแต่เหลือเฉพาะฟิลด์มาตรฐาน (null = ห้ามส่งต่อ) */
function publicChunkLine(line: string, publicModel: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return line;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return line;
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    // บรรทัด data ที่ parse ไม่ขาด = ชิ้นที่ถูกตัดกลางบรรทัด ซึ่งมี id ของต้นทางปนอยู่
    // ทิ้งปลอดภัยกว่า และ client ปกติอ่าน chunk ที่หายไปตัวเดียวได้โดยไม่กระทบเนื้อหา
    return null;
  }
  const usage = publicUsage(json.usage);
  const chunk = {
    ...publicEnvelope(json, publicModel),
    object: typeof json.object === "string" ? json.object : "chat.completion.chunk",
    choices: Array.isArray(json.choices) ? json.choices.map(publicDelta) : [],
    ...(usage ? { usage } : {}),
  };
  return `data: ${JSON.stringify(chunk)}`;
}

/**
 * ตัวกรอง stream แบบกักบรรทัดที่ขาดไว้ต่อ chunk ถัดไป
 *
 * push() คืนเฉพาะบรรทัดที่ครบแล้ว flush() ใช้ตอนต้นทางปิด stream เพื่อกายบรรทัดท้ายสุด
 */
export function createPublicSseFilter(publicModel: string): {
  push(chunk: string): string;
  flush(): string;
} {
  let buffer = "";
  return {
    push(chunk: string): string {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      return lines
        .map((l) => publicChunkLine(l, publicModel))
        .filter((l): l is string => l !== null)
        .map((l) => `${l}\n`)
        .join("");
    },
    flush(): string {
      if (!buffer) return "";
      const rest = buffer;
      buffer = "";
      return publicChunkLine(rest, publicModel) ?? "";
    },
  };
}
