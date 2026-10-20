/**
 * คำนิยาม + ตัวรันเครื่องมือของ Web Agent
 *
 * เซิร์ฟเวอร์เป็น "ตัวส่งต่อ" — ส่งรายการเครื่องมือไปให้โมเดล แล้วรับผลลัพธ์ที่เบราว์เซอร์
 * ของผู้ใช้รันกลับไปให้โมเดลอ่านต่อ การอ่าน/เขียนไฟล์เกิดบนเครื่องผู้ใช้จริง
 * (เนื้อหาไฟล์ที่เอเจนต์อ่านจะถูกส่งต่อให้โมเดลด้วย เพราะโมเดลเป็นคนต้องใช้มัน)
 * ส่วนการค้นเว็บใช้คีย์บนเซิร์ฟเวอร์ (Bright Data SERP) ไม่เกี่ยวอะไรกับเครื่องผู้ใช้
 */

import { SearchUnavailable, webSearch, type SearchResult } from "@/lib/agent/search";
import {
  canPickFolder,
  listWorkspace,
  makeWorkspaceDir,
  readWorkspaceFile,
  removeWorkspaceEntry,
  searchWorkspace,
  workspaceFileExists,
  writeWorkspaceFile,
} from "@/lib/agent/workspace";

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/** การเรียกเครื่องมือที่โมเดลขอ — รูปแบบ OpenAI (ประกาศซ้ำฝั่ง client เพื่อไม่ต้อง import โค้ดเซิร์ฟเวอร์) */
export type AgentToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** ข้อความในบทสนทนาที่ client ถือไว้ระหว่างรอบเครื่องมือ */
export type AgentChatMessage = {
  role: "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: AgentToolCall[];
  tool_call_id?: string;
  name?: string;
};

/** การกระทำที่ควรขออนุญาตผู้ใช้ก่อน — ลบไฟล์ต้องถามเสมอแม้เปิดโหมดอัตโนมัติ */
export type PendingAction = {
  kind: "write" | "mkdir" | "delete";
  path: string;
  /** เนื้อหาที่จะเขียน (ใช้แสดงในกล่องยืนยัน) */
  content?: string;
  /** ไฟล์มีอยู่ก่อนแล้ว (เขียนทับ) */
  overwrite?: boolean;
  /** ต่อท้ายไฟล์เดิม ไม่ได้เขียนทับ */
  append?: boolean;
};

export type ToolContext = {
  workspace: FileSystemDirectoryHandle | null;
  /** แจ้งเตือนระดับหน้า (เช่น ค้นเว็บใช้ไม่ได้) ให้ UI แสดงแถบเตือน */
  notify: (message: string) => void;
  /** ขออนุญาตผู้ใช้ — คืน false เมื่อปฏิเสธ */
  approve: (action: PendingAction) => Promise<boolean>;
  /** อนุญาตให้เขียนไฟล์ได้ทันทีโดยไม่ต้องถาม (ยังถามก่อนลบเสมอ) */
  autoWrite: boolean;
  /** ผู้ใช้กดหยุด — ตัด request ที่ยังวิ่งอยู่ (เช่นค้นเว็บ) */
  signal?: AbortSignal;
};

const str = (extra: Record<string, unknown> = {}) => ({ type: "string", ...extra });

/** สร้างรายการเครื่องมือตามสภาพจริงตอนผู้ใช้กดส่งข้อความ */
export function toolDefinitions(ctx: ToolContext): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      type: "function",
      function: {
        name: "web_search",
        description:
          "ค้นหาข้อมูลบนอินเทอร์เน็ตจากเครื่องของผู้ใช้เอง ใช้เมื่อต้องการข้อมูลปัจจุบันหรือสิ่งที่ไม่แน่ใจ ผลลัพธ์เป็นรายการลิงก์+คำโปรย",
        parameters: {
          type: "object",
          properties: {
            query: str({ description: "คำค้น" }),
            max_results: { type: "number", description: "จำนวนผลลัพธ์ (1-10, ค่าเริ่มต้น 6)" },
          },
          required: ["query"],
        },
      },
    },
  ];

  if (ctx.workspace && canPickFolder()) {
    tools.push(
      {
        type: "function",
        function: {
          name: "list_files",
          description: "ไลสต์ไฟล์และโฟลเดอร์ในเวิร์กสเปซของผู้ใช้ (โฟลเดอร์งานที่ผู้ใช้เลือกไว้บนเครื่องตัวเอง)",
          parameters: {
            type: "object",
            properties: {
              path: str({ description: "โฟลเดอร์ย่อย เช่น src/lib — เว้นว่างหมายถึงรากของเวิร์กสเปซ" }),
              depth: { type: "number", description: "ระดับความลึก 1-4 (ค่าเริ่มต้น 2)" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "search_files",
          description: "ค้นข้อความในไฟล์ทั่วเวิร์กสเปซ (แบบ grep) เพื่อหาว่าโค้ด/คำที่ต้องการอยู่ไฟล์ไหน",
          parameters: {
            type: "object",
            properties: {
              query: str({ description: "ข้อความที่ค้นหา (ไม่ต้องเป็น regex)" }),
              glob: str({ description: "กรองเฉพาะ path ที่มีข้อความนี้ เช่น .ts, src/app" }),
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "read_file",
          description: "อ่านเนื้อหาไฟล์ในเวิร์กสเปซของผู้ใช้ (ไฟล์ใหญ่จะถูกตัด) — ต้องอ่านก่อนเสนอแก้ไฟล์เสมอ",
          parameters: {
            type: "object",
            properties: { path: str({ description: "path เทียบจากรากเวิร์กสเปซ เช่น src/app/page.tsx" }) },
            required: ["path"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "write_file",
          description:
            "เขียนไฟล์ในเวิร์กสเปซของผู้ใช้ — mode=write คือส่งเนื้อหาทั้งไฟล์, mode=append คือต่อท้ายไฟล์เดิม (ใช้ตอนไฟล์ยาวเกินส่งครั้งเดียว) ระบบจะขออนุญาตผู้ใช้ก่อนยกเว้นเขาเปิดโหมดอัตโนมัติ",
          parameters: {
            type: "object",
            properties: {
              path: str({ description: "path เทียบจากรากเวิร์กสเปซ" }),
              content: str({ description: "เนื้อหาที่จะเขียน (ทั้งไฟล์ หรือท่อนที่จะต่อท้าย)" }),
              mode: {
                type: "string",
                enum: ["write", "append"],
                description: "write = เขียนใหม่ทั้งไฟล์ (ค่าเริ่มต้น), append = ต่อท้ายไฟล์เดิม",
              },
            },
            required: ["path", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_dir",
          description: "สร้างโฟลเดอร์ใหม่ในเวิร์กสเปซของผู้ใช้",
          parameters: {
            type: "object",
            properties: { path: str({ description: "path ของโฟลเดอร์ใหม่" }) },
            required: ["path"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "delete_path",
          description: "ลบไฟล์หรือโฟลเดอร์ในเวิร์กสเปซของผู้ใช้ — อันตรายและย้อนกลับไม่ได้ ผู้ใช้ต้องกดยืนยันทุกครั้ง",
          parameters: {
            type: "object",
            properties: { path: str({ description: "path ที่ต้องการลบ" }) },
            required: ["path"],
          },
        },
      },
    );
  }

  return tools;
}

/** ชื่อเครื่องมือที่ส่งไปบอก system prompt */
export function toolNames(ctx: ToolContext): string[] {
  return toolDefinitions(ctx).map((t) => t.function.name);
}

function fail(message: string): string {
  return JSON.stringify({ ok: false, error: message });
}

/** ข้อความที่บอกโมเดลตรง ๆ ว่าต้องทำยังไงต่อ เมื่อ arguments ถูกตัดกลางทาง */
const BROKEN_ARGS =
  "parameters ของเครื่องมือไม่สมบูรณ์ (โมเดลตอบถูกตัดกลางทาง) — ห้ามส่งแบบเดิมซ้ำ " +
  'ให้เขียนไฟล์เป็นท่อนสั้น ๆ โดยท่อนแรกใช้ mode="write" แล้วต่อท้ายด้วย mode="append"';

type ParsedArgs = { args: Record<string, unknown>; broken: boolean };

/**
 * อ่าน arguments ที่โมเดลส่งมา (เป็น JSON สตริงตามสเปก OpenAI)
 *
 * ถ้า parse ไม่สำเร็จแปลว่าโต้นเอาต์พุตถูกตัด — เราจะไม่เดาเนื้อหาต่อ
 * เพราะผลลัพธ์คือไฟล์ในเครื่องผู้ใช้ ถูกเขียนผิดไม่ได้
 */
function parseArgs(json: string): ParsedArgs {
  const raw = (json ?? "").trim();
  if (!raw) return { args: {}, broken: false };
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { args: value as Record<string, unknown>, broken: false };
    }
    // บางค่ายส่ง arguments มาเป็นอ็อบเจกต์สำเร็จรูป ไม่ใช่สตริง
    if (typeof value === "string") return parseArgs(value);
    return { args: {}, broken: true };
  } catch {
    return { args: salvagePath(raw), broken: true };
  }
}

/** กู้เฉพาะ "path" กลับมาเพื่อเขียนข้อความ error ให้ชี้จุดได้ */
function salvagePath(raw: string): Record<string, unknown> {
  const found = raw.match(/"path"\s*:\s*"([^"]{1,300})"/);
  return found ? { path: found[1] } : {};
}

const text = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

/**
 * รันเครื่องมือ 1 ตัวในเบราว์เซอร์ของผู้ใช้ แล้วคืนผลลัพธ์เป็นข้อความให้โมเดล
 *
 * ไม่ throw เลย — ทุกความล้มเหลวกลายเป็น { ok:false, error } เพื่อให้โมเดลอธิบาย
 * ให้ผู้ใช้ฟังและหาทางอื่นต่อได้
 */
export async function runTool(name: string, argsJson: string, ctx: ToolContext): Promise<string> {
  const { args, broken } = parseArgs(argsJson);
  if (broken) {
    const hint = text(args.path) ? ` (ไฟล์ที่ค้างอยู่: ${text(args.path)})` : "";
    return fail(`${BROKEN_ARGS}${hint}`);
  }

  switch (name) {
    case "web_search": {
      const query = text(args.query).trim();
      if (!query) return fail("ไม่มีคำค้น (query)");
      const count = Math.min(10, Math.max(1, Number(args.max_results) || 6));
      try {
        const results: SearchResult[] = await webSearch(query, count, ctx.signal);
        if (results.length === 0) {
          return JSON.stringify({
            ok: true,
            results: [],
            note: "ไม่พบผลลัพธ์สำหรับคำค้นนี้ ลองเปลี่ยนคำค้น",
          });
        }
        return JSON.stringify({ ok: true, engine: "google", results });
      } catch (err) {
        if (err instanceof SearchUnavailable) {
          ctx.notify(err.message);
          return JSON.stringify({
            ok: false,
            code: err.code,
            error:
              `${err.message} — ห้ามแต่งผลการค้นหาขึ้นเอง ` +
              "ให้ตอบจากความรู้ที่มีและบอกผู้ใช้สั้น ๆ ว่ารอบนี้ค้นเว็บไม่สำเร็จ",
          });
        }
        return fail(`ค้นหาไม่สำเร็จ: ${(err as Error).message}`);
      }
    }

    case "list_files": {
      if (!ctx.workspace) return fail("ผู้ใช้ยังไม่ได้เลือกโฟลเดอร์งาน");
      try {
        const depth = Math.min(4, Math.max(1, Number(args.depth) || 2));
        const entries = await listWorkspace(ctx.workspace, text(args.path), { depth, limit: 400 });
        return JSON.stringify({
          ok: true,
          workspace: ctx.workspace.name,
          count: entries.length,
          entries: entries.map((e) => (e.kind === "dir" ? `${e.path}` : `${e.path} (${e.size}B)`)),
        });
      } catch (err) {
        return fail(`ไลสต์ไฟล์ไม่สำเร็จ: ${(err as Error).message}`);
      }
    }

    case "search_files": {
      if (!ctx.workspace) return fail("ผู้ใช้ยังไม่ได้เลือกโฟลเดอร์งาน");
      const query = text(args.query).trim();
      if (!query) return fail("ไม่มีข้อความค้นหา");
      try {
        const hits = await searchWorkspace(ctx.workspace, query, { glob: text(args.glob) || undefined });
        return JSON.stringify({ ok: true, query, count: hits.length, hits });
      } catch (err) {
        return fail(`ค้นในไฟล์ไม่สำเร็จ: ${(err as Error).message}`);
      }
    }

    case "read_file": {
      if (!ctx.workspace) return fail("ผู้ใช้ยังไม่ได้เลือกโฟลเดอร์งาน");
      const path = text(args.path).trim();
      if (!path) return fail("ไม่ได้ระบุ path ไฟล์");
      try {
        const content = await readWorkspaceFile(ctx.workspace, path);
        return JSON.stringify({ ok: true, path, chars: content.length, content });
      } catch (err) {
        return fail(`อ่าน ${path} ไม่สำเร็จ: ${(err as Error).message}`);
      }
    }

    case "write_file": {
      if (!ctx.workspace) return fail("ผู้ใช้ยังไม่ได้เลือกโฟลเดอร์งาน");
      const path = text(args.path).trim();
      const content = text(args.content);
      const append = text(args.mode).toLowerCase() === "append";
      if (!path) return fail("ไม่ได้ระบุ path ไฟล์");
      if (!content.trim()) return fail("เนื้อหาที่จะเขียนว่างเปล่า");
      const exists = await workspaceFileExists(ctx.workspace, path).catch(() => false);
      const allowed = await ctx.approve({
        kind: "write",
        path,
        content,
        overwrite: exists,
        append,
      });
      if (!allowed) return JSON.stringify({ ok: false, error: "ผู้ใช้ปฏิเสธการเขียนไฟล์นี้", cancelled: true });
      try {
        const result = await writeWorkspaceFile(ctx.workspace, path, content, append ? "append" : "write");
        return JSON.stringify({ ok: true, ...result, bytes: content.length });
      } catch (err) {
        return fail(`เขียน ${path} ไม่สำเร็จ: ${(err as Error).message}`);
      }
    }

    case "create_dir": {
      if (!ctx.workspace) return fail("ผู้ใช้ยังไม่ได้เลือกโฟลเดอร์งาน");
      const path = text(args.path).trim();
      if (!path) return fail("ไม่ได้ระบุ path โฟลเดอร์");
      const allowed = await ctx.approve({ kind: "mkdir", path });
      if (!allowed) return JSON.stringify({ ok: false, error: "ผู้ใช้ปฏิเสธการสร้างโฟลเดอร์", cancelled: true });
      try {
        return JSON.stringify({ ok: true, path: await makeWorkspaceDir(ctx.workspace, path) });
      } catch (err) {
        return fail(`สร้างโฟลเดอร์ ${path} ไม่สำเร็จ: ${(err as Error).message}`);
      }
    }

    case "delete_path": {
      if (!ctx.workspace) return fail("ผู้ใช้ยังไม่ได้เลือกโฟลเดอร์งาน");
      const path = text(args.path).trim();
      if (!path) return fail("ไม่ได้ระบุ path ที่ต้องการลบ");
      const allowed = await ctx.approve({ kind: "delete", path });
      if (!allowed) return JSON.stringify({ ok: false, error: "ผู้ใช้ปฏิเสธการลบ", cancelled: true });
      try {
        return JSON.stringify({ ok: true, removed: await removeWorkspaceEntry(ctx.workspace, path) });
      } catch (err) {
        return fail(`ลบ ${path} ไม่สำเร็จ: ${(err as Error).message}`);
      }
    }

    default:
      return fail(`ไม่รู้จักเครื่องมือ "${name}"`);
  }
}
