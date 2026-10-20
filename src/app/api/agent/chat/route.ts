import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listPublicRoutes } from "@/lib/data/models";
import { getPlanByKey } from "@/lib/data/plans";
import { buildAgentSystemPrompt } from "@/lib/agent/prompt";
import {
  createSseAccumulator,
  estimateTokensFromChars,
  GatewayError,
  invokeUpstream,
  logRequest,
  userSafeMessage,
  type GatewayTarget,
  type InvokeInput,
  type InvokeResult,
  type UpstreamMessage,
  type UpstreamToolCall,
} from "@/lib/gateway";
import {
  addFiles,
  addMessage,
  getChatSettings,
  getConversation,
  updateConversation,
  type ChatAttachment,
} from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** ชื่อ agent ของแชทในเว็บเราเอง — แยกจากแอปภายนอกที่เรียก /v1 */
const WEB_AGENT = "octopus-web";

/**
 * เพดานโต้นเอาต์พุตของเอเจนต์ — ตั้งให้กว้างพอที่โมเดลจะเขียนโค้ดไฟล์เดียวจบ
 * และให้ tool_call arguments เป็น JSON สมบูรณ์ (ค่า default ของค่ายมักสั้นมาก)
 */
const TOKENS_FROM_ENV = Number(process.env.AGENT_MAX_TOKENS);
const AGENT_MAX_TOKENS =
  Number.isFinite(TOKENS_FROM_ENV) && TOKENS_FROM_ENV > 0 ? TOKENS_FROM_ENV : 8000;

/**
 * เพดานขนาดบริบทที่ส่งไปค่ายต้นทาง (ตัวอักษร)
 *
 * แชทที่ยาวมากทำให้ช้าสองต่อ: อัปโหลด payload ใหญ่ + โมเดลประมวลผล prompt ยาว
 * จึงเก็บข้อความล่าสุดไว้ก่อน แล้วตัดทิ้งจากด้านเก่า
 */
const HISTORY_CHAR_BUDGET = 60_000;

function contentChars(content: unknown): number {
  if (typeof content === "string") return content.length;
  if (!content) return 0;
  if (Array.isArray(content)) return content.reduce((s, part) => s + JSON.stringify(part).length, 0);
  return JSON.stringify(content).length;
}

function trimToCharBudget(messages: UpstreamMessage[], budget: number): UpstreamMessage[] {
  let used = 0;
  const out: UpstreamMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const size = contentChars(messages[i].content);
    if (out.length > 0 && used + size > budget) break;
    used += size;
    out.unshift(messages[i]);
  }
  return out;
}

/**
 * ข้อความที่ client ส่งขึ้นมา
 *
 * ฝั่ง client เป็นเจ้าของบทสนทนาในรอบนี้ เพราะเครื่องมือ (ค้นเว็บ/อ่านไฟล์)
 * รันอยู่บนเครื่องผู้ใช้ ผลลัพธ์จึงต้องไหลจากเบราว์เซอร์ขึ้นมาก่อน แล้วค่อย
 * ส่งกลับไปให้โมเดลอ่านต่อ — เซิร์ฟเวอร์แค่ผ่านข้อความและคิด quota
 */
type ClientMessage = {
  role: "user" | "assistant" | "tool";
  content?: string | unknown[];
  tool_calls?: UpstreamToolCall[];
  tool_call_id?: string;
  name?: string;
};

type Body = {
  conversationId?: string;
  model?: string;
  /** มีเฉพาะรอบแรกที่ผู้ใช้พิมพ์ (รอบต่อมาเป็นผลลัพธ์เครื่องมือล้วน) */
  content?: string;
  attachments?: ChatAttachment[];
  messages?: ClientMessage[];
  /** OpenAI tools schema ที่ client สร้างตามเครื่องมือที่เปิดใช้จริง */
  tools?: unknown[];
  toolNames?: string[];
  workspaceReady?: boolean;
};

const ARTIFACT_LANGS = new Set(["html", "htm"]);

/** ตัดสิ่งที่ห้ามมีในชื่อไฟล์ออก แล้วเหลือคำสั้น ๆ ที่อ่านรู้เรื่อง */
function slug(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\.html?$/i, "")
    .slice(0, 48)
    .replace(/^[-.]+|[-.]+$/g, "");
}

/**
 * ตั้งชื่อไฟล์ตามที่เนื้อหาจริงบอก ไม่ใช่ artifact-1, artifact-2
 *
 * เรียงตามความน่าเชื่อถือ: ชื่อที่โมเดลเขียนต่อท้าย ```html → <title> → <h1> →
 * ชื่อห้องแชท → artifact-<ลำดับ>
 */
function artifactName(explicit: string, body: string, roomTitle: string, seq: number): string {
  const candidates = [
    explicit,
    body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
    body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "",
    roomTitle,
  ];
  for (const raw of candidates) {
    const cleaned = slug(raw);
    if (cleaned) return `${cleaned}.html`;
  }
  return `artifact-${seq}.html`;
}

/** ดึง fenced code block ที่เป็น HTML ออกจากคำตอบของ AI เพื่อเก็บเข้าคลังไฟล์ */
function extractHtmlArtifacts(content: string, roomTitle: string): { name: string; content: string }[] {
  const out: { name: string; content: string }[] = [];
  const re = /```([A-Za-z0-9_-]+)?([^\n]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let seq = 0;
  while ((m = re.exec(content))) {
    const lang = (m[1] ?? "").toLowerCase();
    if (!ARTIFACT_LANGS.has(lang)) continue;
    const body = (m[3] ?? "").trim();
    if (!body) continue;
    seq += 1;
    const named = (m[2] ?? "").match(/[\w.\u0E00-\u0E79-]+\.html?/i);
    out.push({ name: artifactName(named ? named[0] : "", body, roomTitle, seq), content: body });
  }
  return out;
}

/**
 * ไฟล์แนบประเภทข้อความ/โค้ด → ส่วนของ prompt ที่โมเดลอ่านได้จริง
 *
 * เดิมทุกไฟล์ที่ไม่ใช่รูปถูกย่อเหลือแค่ "[แนบไฟล์: ชื่อ]" ซึ่งทำให้ไฟล์ .txt
 * ที่ผู้ใช้วางให้ (หรือเอเจนต์เคยบันทึกไว้) กลายเป็นชื่อเปล่า โมเดลไม่เห็นเนื้อหา
 * จึงถอด data URL กลับเป็นข้อความ จำกัดขนาดต่อไฟล์ไว้กันบริบทบวม
 */
const TEXT_FILE_CHARS = 20_000;
const TEXT_MIME = /^(text\/|application\/(json|xml|x-sh|javascript|typescript|sql|yaml|x-yaml|csv))/i;

function textFileBody(a: ChatAttachment): string | null {
  if (a.mime.startsWith("image/")) return null;
  if (!TEXT_MIME.test(a.mime) && !/\.(txt|md|markdown|json|csv|log|ya?ml|env|ini|tsv|py|rb|go|rs|java|c|h|cpp|hpp|cs|php|pl|lua|sh|bat|ps1|sql|txt)$/i.test(a.name)) {
    return null;
  }
  const comma = a.dataUrl.indexOf(",");
  if (comma < 0) return null;
  const meta = a.dataUrl.slice(0, comma);
  const body = a.dataUrl.slice(comma + 1);
  try {
    const text = meta.includes(";base64")
      ? Buffer.from(body, "base64").toString("utf8")
      : decodeURIComponent(body);
    if (!text.trim()) return null;
    return text.length > TEXT_FILE_CHARS ? `${text.slice(0, TEXT_FILE_CHARS)}\n…(ตัดเพราะยาวเกิน)` : text;
  } catch {
    return null;
  }
}

/** ส่วนหนึ่งของ message ตามประเภทไฟล์แนบ (รูป = image_url, ไฟล์ข้อความ = เนื้อหาเต็ม) */
function attachmentPart(a: ChatAttachment): Record<string, unknown> {
  if (a.mime.startsWith("image/")) return { type: "image_url", image_url: { url: a.dataUrl } };
  const body = textFileBody(a);
  if (body === null) return { type: "text", text: `\n[แนบไฟล์: ${a.name}]` };
  return { type: "text", text: `\n[ไฟล์ ${a.name}]\n${body}\n[จบไฟล์]` };
}

async function saveAssistantMessage(
  userId: string,
  conversationId: string,
  content: string,
  roomTitle: string,
  /** เวลาเริ่มรอบ — ใช้เมื่อบันทึกช้ากว่าคำถามถัดไป (ดู addMessage) */
  createdAt?: string,
): Promise<{ id: string; name: string; kind: string; sizeBytes: number }[]> {
  try {
    // ข้อความกับ artifact ไม่ผูกกันด้วย FK → ส่งสอง request พร้อมกันแทนที่จะไล่รอ
    const artifacts = extractHtmlArtifacts(content, roomTitle);
    const [, files] = await Promise.all([
      addMessage({ conversationId, role: "assistant", content, createdAt }),
      addFiles(
        artifacts.map((a) => ({
          userId,
          conversationId,
          name: a.name,
          kind: "html",
          content: a.content,
        })),
      ),
    ]);
    return files.map((f) => ({ id: f.id, name: f.name, kind: f.kind, sizeBytes: f.sizeBytes }));
  } catch (err) {
    console.error("[agent] save assistant message failed:", err);
    return [];
  }
}

/**
 * ชื่อห้องจากข้อความแรกของผู้ใช้
 *
 * เดิมใช้ 60 ตัวอักษรแรกของข้อความตรง ๆ ใครวาง HTML/โค้ดทั้งไฟล์จึงได้ชื่อห้องเป็น
 * "<!doctype html><html lang=..." ทั้งในรายการประวัติและบน header
 * ตัดโค้ดกับแท็กออกก่อน แล้วเก็บเฉพาะข้อความที่อ่านเป็นประโยค
 */
function titleFrom(content: string, fallback: string): string {
  const clean = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (clean || fallback).slice(0, 60) || "แชทใหม่";
}

function error(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * ตัดบทสนทนาให้สั้นพอ แต่ต้องไม่ทำให้คู่ tool_call/tool result ขาดกัน
 *
 * ค่ายต้นทางปฏิเสธ request ที่มี tool result โดยไม่มี assistant เรียกเครื่องมือนั้น
 * (หรือในทางกลับกัน) จึงกรองเป็นสองรอบ: เก็บเฉพาะ call ที่มีคำตอบครบ
 * แล้วทิ้งข้อความ tool ที่ไม่มีเจ้าของ
 */
function sanitizeTranscript(list: ClientMessage[], limit = 60): UpstreamMessage[] {
  const slice = list.slice(-limit);
  const answered = new Set(
    slice.filter((m) => m.role === "tool" && m.tool_call_id).map((m) => m.tool_call_id as string),
  );
  const announced = new Set<string>();
  for (const m of slice) {
    for (const call of m.tool_calls ?? []) announced.add(call.id);
  }

  const out: UpstreamMessage[] = [];
  for (const m of slice) {
    if (m.role === "tool") {
      if (!m.tool_call_id || !announced.has(m.tool_call_id)) continue;
      out.push({ role: "tool", content: m.content ?? "", tool_call_id: m.tool_call_id, name: m.name });
      continue;
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      const complete = m.tool_calls.every((call) => answered.has(call.id));
      if (!complete) continue;
      out.push({
        role: "assistant",
        content: m.content ?? "",
        tool_calls: m.tool_calls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: {
            name: call.function?.name ?? "",
            arguments: call.function?.arguments ?? "{}",
          },
        })),
      });
      continue;
    }
    out.push({ role: m.role, content: m.content ?? "" });
  }
  return out;
}

function event(value: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

/** placeholder target สำหรับ log ตอนที่ยังไม่ทันรู้ปลายทางจริง */
const UNKNOWN_TARGET = {
  modelRefId: 0,
  modelId: "",
  providerId: 0,
  providerName: "",
  baseUrl: "",
  inputPricePerM: 0,
  outputPricePerM: 0,
  supportsVision: false,
  contextWindow: 0,
} satisfies GatewayTarget;

/**
 * ข้อความที่บันทึกแทน error ในประวัติแชทของผู้ใช้ — ห้ามเอาข้อความดิบมาเก็บ
 * เพราะมันพาค่ายที่ระบบส่งต่อออกไปกับผู้ใช้อ่านได้
 */
const GENERIC_STREAM_ERROR =
  "เกิดข้อผิดพลาดระหว่างการเชื่อมต่อ โมเดลตอบกลับมาไม่ครบ กรุณาส่งข้อความเป็นรอบใหม่";

export async function POST(req: NextRequest) {
  // อ่าน session (ไป Supabase) พร้อมกับการ parse body — ไม่ต้องรอต่อกัน
  const [user, parsed] = await Promise.all([
    getSessionUser(),
    req.json().catch(() => ({}) as Body),
  ]);
  if (!user) return error("unauthorized", 401);

  const body = parsed as Body;
  const content = (body.content ?? "").trim();
  const attachments = (body.attachments ?? []).filter((a) => a && a.dataUrl);
  const conversationId = body.conversationId;
  const isFirstRound = Boolean(content || attachments.length > 0);

  if (!conversationId) return error("conversation_required", 400);
  if (!isFirstRound && (body.messages?.length ?? 0) === 0) {
    return error("empty_message", 400);
  }
  if (user.banned) return error("บัญชีนี้ถูกระงับการใช้งาน", 403);

  let settings;
  let conversation;
  try {
    // สอง query นี้ไม่เกี่ยวกัน — ส่งพร้อมกันลดเวลาได้ 1 รอบไป Turso (~115ms)
    [settings, conversation] = await Promise.all([
      getChatSettings(),
      getConversation(user.id, conversationId),
    ]);
  } catch (err) {
    console.error("[agent] chat preload failed:", err);
    return error("chat_db_unavailable", 503);
  }
  if (!conversation) return error("not_found", 404);

  // บังคับเพดานจำนวนไฟล์ฝั่ง server — ไม่เชื่อ client
  if (attachments.length > settings.maxAttachments) {
    return error(`แนบไฟล์ได้สูงสุด ${settings.maxAttachments} ไฟล์`, 400);
  }

  // "โมเดล" ในหน้า agent คือ route สาธารณะ (เช่น octopus-free) ไม่ใช่โมเดลของค่าย
  const model = (body.model || conversation.model || "").trim();
  const [plan, publicRoutes] = await Promise.all([getPlanByKey(user.plan), listPublicRoutes()]);
  const route = publicRoutes.find((r) => r.publicModel === model);
  if (!route) {
    // catalog ว่าง = DB อ่านไม่ออก (pool เต็ม) ไม่ใช่ "ไม่มีโมเดลนี้" — ตอบ 503 ให้ client ลองใหม่
    if (publicRoutes.length === 0) {
      return error("ระบบกำลังติดขัดชั่วคราว อ่านรายการโมเดลไม่ได้ กรุณาลองใหม่ในไม่กี่วินาที", 503);
    }
    return error(`ไม่พบโมเดล "${model}" ในรายการที่เปิดใช้`, 400);
  }
  if (route.requiredPlanTier != null && route.requiredPlanTier > plan.tier) {
    return error(`โมเดลนี้ต้องใช้แผน ${route.requiredPlanLabel} ขึ้นไป`, 403);
  }

  /**
   * ชื่อห้องที่ใช้ทั้งใน header ของรอบนี้และชื่อไฟล์ artifact
   *
   * เดิม header ส่ง conversation.title ที่โหลดมาก่อนบันทึกข้อความแรก (ค่าว่าง)
   * ทำให้ sidebar ไม่เปลี่ยนชื่อจนกว่าจะรีเฟรช ทั้งที่ DB ตั้งชื่อแล้ว
   */
  const roomTitle =
    conversation.title.trim() || (isFirstRound ? titleFrom(content, attachments[0]?.name ?? "") : "");

  if (isFirstRound) {
    const patch: { title?: string; model?: string } = { model };
    if (!conversation.title.trim()) patch.title = roomTitle;
    try {
      // คนละตาราง เขียนพร้อมกันได้เลย — เดิมรอต่อกัน 2 รอบ (~230ms) ก่อนที่โมเดลจะเริ่มตอบ
      await Promise.all([
        addMessage({ conversationId, role: "user", content, attachments }),
        updateConversation(user.id, conversationId, patch),
      ]);
    } catch (err) {
      console.error("[agent] save user message failed:", err);
      return error("chat_db_unavailable", 503);
    }
  }

  // บริบทหลักอ่านจาก DB (รวมถึงรูปที่แนบไว้ในอดีต) แล้วต่อด้วยรอบเครื่องมือของ run นี้
  //
  // รูปเก่าถูกตัดออกจาก payload ที่ส่งไปค่ายต้นทาง เพราะ base64 หลาย MB ทำให้ทั้ง
  // การอัปโหลดและการประมวลผลฝั่งโมเดลช้าลงมาก — ส่งเฉพาะรูปของ 2 ข้อความล่าสุด
  // ส่วนข้อความเดิมยังส่งครบ โดยรูปเก่าเหลือแค่หมายเหตุแทน
  const IMAGE_MEMORY = 2;
  const keepImage = new Set<number>();
  for (let i = conversation.messages.length - 1; i >= 0 && keepImage.size < IMAGE_MEMORY; i--) {
    const m = conversation.messages[i];
    if (m.role === "user" && m.attachments.some((a) => a.mime.startsWith("image/"))) keepImage.add(i);
  }

  const history: UpstreamMessage[] = conversation.messages.map((m, mi) => {
    if (m.role === "user" && m.attachments.length > 0) {
      const parts: Record<string, unknown>[] = [{ type: "text", text: m.content || "" }];
      for (const a of m.attachments) {
        // รูปเก่าถูกตัดออก (เหลือแค่หมายเหตุ) ส่วนไฟล์ข้อความเป็นบริบทที่มีประโยชน์
        // ของทุกข้อความ — ส่งเนื้อหาไปด้วย_trimToCharBudget_ที่กรองด้านเก่าอยู่ดี
        if (a.mime.startsWith("image/") && !keepImage.has(mi)) {
          parts.push({ type: "text", text: `\n[รูป ${a.name} ถูกตัดออกจากบริบทเก่า]` });
        } else {
          parts.push(attachmentPart(a));
        }
      }
      return { role: "user", content: parts };
    }
    return { role: m.role === "assistant" ? "assistant" : "user", content: m.content };
  });

  const system = buildAgentSystemPrompt({
    routeName: route.displayName || route.publicModel,
    tools: body.toolNames ?? [],
    workspaceReady: Boolean(body.workspaceReady),
  });

  const messages: UpstreamMessage[] = [
    { role: "system", content: system },
    ...trimToCharBudget(history.slice(-40), HISTORY_CHAR_BUDGET),
    ...sanitizeTranscript(body.messages ?? []),
  ];
  if (isFirstRound) {
    messages.push({
      role: "user",
      content:
        attachments.length > 0
          ? [
              { type: "text", text: content },
              ...attachments.map((a) => attachmentPart(a)),
            ]
          : content,
    });
  }

  // นับเฉพาะตัวอักษรข้อความ (ไม่นับ base64 ของรูปแนบ) เพื่อประมาณ token ตอน log
  const promptChars = messages.reduce((sum, m) => {
    if (typeof m.content === "string") return sum + m.content.length;
    const parts = Array.isArray(m.content) ? (m.content as { text?: string }[]) : [];
    return sum + parts.reduce((n, p) => n + (p?.text?.length ?? 0), 0);
  }, 0);

  const tools = Array.isArray(body.tools) ? body.tools : [];
  const wantsVision = attachments.some((a) => a.mime.startsWith("image/"));
  const startedAt = Date.now();
  const filter = wantsVision ? (t: GatewayTarget) => t.supportsVision : undefined;

  /**
   * เรียงลำดับการลอง — เอา tools + max_tokens เต็มรูปแบบก่อนแล้วค่อยถอยทีละขั้น
   *
   * max_tokens จำเป็นมาก: ถ้าไม่ส่งไป ค่ายส่วนใหญ่จะใช้ดีฟอลต์สั้น ๆ ทำให้โค้ดถูกตัด
   * กลางคัน และ arguments ของ tool_call กลายเป็น JSON ไม่สมบูรณ์ (write_file ล้มทั้งวง)
   * ค่ายไหนไม่รับฟิลด์ใดฟิลด์หนึ่ง จะได้ถอยลงแทนที่จะพังไปเลย
   */
  const attempts: { full: boolean; input: InvokeInput }[] = [
    {
      full: true,
      input: {
        publicModel: model,
        messages,
        stream: true,
        tools,
        maxTokens: AGENT_MAX_TOKENS,
        filter,
        signal: req.signal,
      },
    },
    {
      full: false,
      input: {
        publicModel: model,
        messages,
        stream: true,
        maxTokens: AGENT_MAX_TOKENS,
        filter,
        signal: req.signal,
      },
    },
    {
      full: false,
      input: { publicModel: model, messages, stream: true, filter, signal: req.signal },
    },
  ];

  let result: InvokeResult | null = null;
  let usedTools: unknown[] = [];
  let lastError: unknown = null;
  for (const attempt of attempts) {
    if (attempt.full && tools.length === 0) continue;
    try {
      result = await invokeUpstream(attempt.input);
      usedTools = attempt.input.tools ?? [];
      break;
    } catch (err) {
      lastError = err;
      // ผู้ใช้กดหยุดระหว่างรอค่ายต้นทาง — ไม่ต้องลองรูปแบบอื่นต่อ
      if (req.signal.aborted) break;
      // ไม่มี route / ไม่มีคีย์ / ไม่มีสิทธิ์ — ลองซ้ำรูปแบบอื่นก็เสียเวลาเปล่า
      if (!(err instanceof GatewayError) || err.code !== "upstream_error") break;
    }
  }

  if (req.signal.aborted) return error("client_aborted", 499);

  if (!result) {
    const gw = lastError instanceof GatewayError ? lastError : null;
    void logRequest({
      userId: user.id,
      target: UNKNOWN_TARGET,
      publicModel: model,
      agent: WEB_AGENT,
      status: gw?.code === "keys_limited" ? "rate_limited" : "error",
      httpStatus: gw?.status ?? 502,
      usage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: Date.now() - startedAt,
      error: gw?.message ?? (lastError as Error)?.message ?? "unknown",
    });
    return error(userSafeMessage(lastError), gw?.status ?? 502);
  }

  const target = result.target;
  const acc = createSseAccumulator(() => estimateTokensFromChars(promptChars));
  const decoder = new TextDecoder();
  const upstreamBody = result.body;

  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      /* ผู้ใช้กดหยุด/ปิดหน้า → abort fetch ต้นทางและหยุดอ่านทันที
         (signal ถูกส่งเข้า invokeUpstream แล้ว จึงตัดการเชื่อมต่อค่ายด้วย) */
      const stopUpstream = () => {
        cancelled = true;
        void upstreamReader?.cancel("client closed").catch(() => {});
      };
      if (req.signal.aborted) stopUpstream();
      req.signal.addEventListener("abort", stopUpstream, { once: true });

      const safeEnqueue = (chunk: Uint8Array) => {
        if (cancelled || req.signal.aborted) return false;
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          cancelled = true;
          return false;
        }
      };

      if (tools.length > 0 && usedTools.length === 0) {
        safeEnqueue(
          event({ t: "notice", v: "โมเดลนี้ยังไม่รองรับเครื่องมือ — รอบนี้จึงตอบจากข้อมูลที่มี" }),
        );
      }

      const reader = (upstreamReader = upstreamBody.getReader());
      let failed = "";
      try {
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          const delta = acc.push(decoder.decode(value, { stream: true }));
          if (delta && !safeEnqueue(event({ t: "d", v: delta }))) break;
        }
      } catch (err) {
        // abort จากผู้ใช้ไม่ใช่ความล้มเหลวของค่าย — อย่าเอาไปบันทึกเป็น error
        if (!cancelled && !req.signal.aborted) {
          failed = (err as Error).message;
          console.error(`[agent-chat] อ่าน stream ไม่สำเร็จ (${target.providerName}):`, err);
        }
      }

      const answer = acc.text();
      const calls = acc.toolCalls();
      const reason = acc.finishReason();

      if (cancelled || req.signal.aborted) {
        /* กดหยุดแล้ว: เก็บเฉพาะคำตอบบางส่วนที่ผู้ใช้เห็นไปแล้ว (ถ้ามี)
           ห้ามเขียน GENERIC_STREAM_ERROR ลงประวัติ เพราะผู้ใช้ไม่ได้เห็นข้อความนั้น
           และอย่า enqueue/close อะไรอีก — ฝั่ง client ตัด connection ไปแล้ว */
        // ถ้ามี tool_calls ข้อความนั้นคือ "ความคิดก่อนเรียกเครื่องมือ" ไม่ใช่คำตอบ
        if (answer.trim() && calls.length === 0) {
          try {
            // ประทับเวลาเริ่มรอบ: คำถามใหม่ของผู้ใช้อาจถูกบันทึกไปแล้วระหว่างที่เราบันทึกช้ากว่า
            await saveAssistantMessage(
              user.id,
              conversationId,
              answer,
              roomTitle,
              new Date(startedAt).toISOString(),
            );
          } catch (err) {
            console.error("[agent] save partial answer after stop failed:", err);
          }
        }
        void logRequest({
          userId: user.id,
          target,
          publicModel: model,
          agent: WEB_AGENT,
          status: "success",
          httpStatus: 200,
          usage: acc.usage(),
          latencyMs: Date.now() - startedAt,
        });
        // cancel อาจเกิดก่อนที่ start() จะสร้าง reader — ปล่อย body ค้างไม่ได้
        void reader.cancel("client closed").catch(() => {});
        req.signal.removeEventListener("abort", stopUpstream);
        return;
      }

      // โมเดลขอใช้เครื่องมือ → ส่งรายการกลับไปให้ client รันบนเครื่องผู้ใช้
      // (ยังไม่บันทึกอะไรลงประวัติ เพราะยังไม่ใช่คำตอบสุดท้าย)
      if (calls.length > 0 && !failed) {
        safeEnqueue(event({ t: "tool", v: calls, text: answer, fr: reason }));
        void logRequest({
          userId: user.id,
          target,
          publicModel: model,
          agent: WEB_AGENT,
          status: "success",
          httpStatus: 200,
          usage: acc.usage(),
          latencyMs: Date.now() - startedAt,
        });
        try {
          controller.close();
        } catch {
          /* client ปิดไปแล้ว */
        }
        req.signal.removeEventListener("abort", stopUpstream);
        return;
      }

      // ข้อความ error ดิบของค่าย/ของ bundler ห้ามถูกบันทึกค้างในประวัติแชทของผู้ใช้
      // เก็บไว้แค่ข้อความกลาง ๆ ส่วนรายละเอียดเต็มไปอยู่ใน log เซิร์ฟเวอร์กับตาราง requests
      const toStore = answer || (failed ? GENERIC_STREAM_ERROR : "");
      let saved: Awaited<ReturnType<typeof saveAssistantMessage>> = [];
      try {
        if (toStore) {
          saved = await saveAssistantMessage(user.id, conversationId, toStore, roomTitle);
        }
      } catch (err) {
        console.error("[agent] save assistant message failed:", err);
      } finally {
        // บอกรายชื่อไฟล์ที่บันทึกเสร็จแล้ว → ปุ่ม "แชร์" บน artifact ใช้ได้ทันทีโดยไม่ต้องโหลดห้องใหม่
        if (saved.length > 0) safeEnqueue(event({ t: "files", v: saved }));
        safeEnqueue(event({ t: "done", fr: reason }));
        try {
          controller.close();
        } catch {
          /* client ปิดไปแล้วระหว่างบันทึก — ไม่มีอะไรต้องปิด */
        }
        req.signal.removeEventListener("abort", stopUpstream);
      }

      void logRequest({
        userId: user.id,
        target,
        publicModel: model,
        agent: WEB_AGENT,
        status: failed ? "error" : "success",
        httpStatus: failed ? 500 : 200,
        usage: acc.usage(),
        latencyMs: Date.now() - startedAt,
        error: failed || undefined,
      });
    },
    // ผู้ใช้กดหยุด → ปล่อย stream ของต้นทางทันที จะได้ไม่จ่ายค่า token ต่อหลังหวด
    cancel() {
      cancelled = true;
      void upstreamReader?.cancel("client closed").catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "x-conversation-id": conversationId,
      "x-conversation-title": encodeURIComponent(roomTitle),
    },
  });
}
