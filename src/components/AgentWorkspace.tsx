"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import type { ChatAttachment, ChatConversation } from "@/lib/chat/db";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import Menu from "@/components/Menu";
import { ConfirmDialog, Dialog } from "@/components/Dialog";
import { ModelPicker, type AgentModel } from "@/components/ModelPicker";
import AgentToolsBar from "@/components/AgentToolsBar";
import MessageBody from "@/components/MessageBody";
import ToolApprovalDialog from "@/components/ToolApprovalDialog";
import {
  canPickFolder,
  forgetWorkspace,
  grantWorkspaceAccess,
  pickWorkspaceFolder,
  recallWorkspace,
} from "@/lib/agent/workspace";
import {
  runTool,
  toolDefinitions,
  toolNames,
  type AgentChatMessage,
  type AgentToolCall,
  type PendingAction,
  type ToolContext,
} from "@/lib/agent/tools";

export type { AgentModel } from "@/components/ModelPicker";

/** ขั้นตอนเครื่องมือที่เอเจนต์เพิ่งทำในรอบนี้ (แสดงใต้ข้อความของผู้ช่วย) */
type ToolStep = {
  id: string;
  label: string;
  state: "running" | "done" | "error" | "stopped";
};

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: ChatAttachment[];
  steps?: ToolStep[];
  /** สิ่งที่โมเดลบอกก่อนเรียกเครื่องมือแต่ละรอบ (แสดงในกล่อง "กำลังคิด") */
  notes?: string[];
  /** เวลาที่ใช้ทั้งรอบ (คิด + เรียกเครื่องมือ) — แสดงในกล่องขั้นตอนหลังจบ */
  thinkingMs?: number;
  /** ผู้ใช้กดหยุดเอง — ข้อความอาจมีคำตอบบางส่วน */
  stopped?: boolean;
  /** ข้อความ error ที่อ่านรู้เรื่อง (เก็บแยกจากเนื้อคำตอบ เพื่อแสดงกล่องแจ้งเตือน) */
  error?: string;
};

export type AgentUiMessage = UiMessage;

type AgentFile = {
  id: string;
  conversationId: string;
  name: string;
  kind: string;
  sizeBytes: number;
  shareUrl: string | null;
  shareExpiresAt: string | null;
  createdAt: string;
};

/**
 * ไฟล์ที่เอเจนต์สร้างในห้องปัจจุบัน (เฉพาะข้อมูลที่พอจะจับคู่กับกล่องโค้ดในข้อความ)
 * ใช้กด "แชร์" จาก artifact ตรง ๆ ไม่ต้องเปิดคลังไฟล์ก่อน
 */
export type AgentArtifact = {
  id: string;
  name: string;
  kind: string;
  sizeBytes: number;
  shareUrl: string | null;
  shareExpiresAt: string | null;
};

/**
 * จับคู่กล่องโค้ดในข้อความกับไฟล์ที่เอเจนต์บันทึกไว้
 *
 * โมเดลมักไม่พิมพ์ชื่อไฟล์หลัง ``` และชื่อในคลังก็ตั้งจาก <title> ของโค้ด
 * จึงลอง ตรงชื่อ → ชื่อโผล่ในอีกชื่อ → ไฟล์ชนิดเดียวกันที่ขนาดใกล้ที่สุด
 */
function pickArtifact(
  list: AgentArtifact[],
  block: { name: string; lang: string; bytes: number },
): AgentArtifact | undefined {
  if (list.length === 0) return undefined;
  const want = block.name.trim().toLowerCase();
  const stem = want.replace(/\.[a-z0-9]+$/, "");
  if (stem.length > 3) {
    const loose = list.find((a) => {
      const name = a.name.toLowerCase();
      const other = name.replace(/\.[a-z0-9]+$/, "");
      return name === want || name.includes(stem) || (other.length > 3 && stem.includes(other));
    });
    if (loose) return loose;
  }

  const kind = (block.lang || "html").toLowerCase();
  const sameKind = list.filter((a) => (a.kind || "html").toLowerCase() === kind);
  // เอาเฉพาะไฟล์ชนิดเดียวกับกล่องโค้ด — กันไปแชร์คนละไฟล์ตอนที่ชื่อไม่ตรงกันเลย
  const pool = sameKind;
  if (pool.length === 0) return undefined;
  if (pool.length === 1) return pool[0];
  return pool.reduce((best, a) =>
    Math.abs(a.sizeBytes - block.bytes) < Math.abs(best.sizeBytes - block.bytes) ? a : best,
  );
}

const COLLAPSE_KEY = "octopus.agent.sidebar.collapsed";
const AUTOWRITE_KEY = "octopus.agent.autowrite";

/** จำนวนรอบสูงสุดที่เอเจนต์จะเรียกเครื่องมือต่อหนึ่งคำถาม — กันวนไม่จบ */
const MAX_TOOL_ROUNDS = 6;

function titleOf(c: ChatConversation) {
  return c.title?.trim() || "แชทใหม่";
}

/** รูปสี่เหลี่ยมมีเส้นแบ่งฝั่งซ้าย — ไอคอนย่อ/ขยาย sidebar (ไม่มีในชุด react-icons ที่ใช้อยู่) */
function PanelIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M9 3v18" />
    </svg>
  );
}

/**
 * กล่อง "กำลังคิด" — พับ/กางได้
 *
 * รวมสองอย่างที่เดิมกระจายอยู่: สิ่งที่โมเดลพิมพ์บอกก่อนเรียกเครื่องมือ (notes)
 * กับขั้นตอนเครื่องมือที่ทำไป (steps) ตอน stream จะกางให้เองและพับลงเมื่อจบรอบ
 */
function ThinkingPanel({
  running,
  notes,
  steps,
  startedAt,
  durationMs,
  /** มีข้อความคำตอบไหลอยู่แล้ว — พับกล่องให้อัตโนมัติ จะได้ไม่บังคำตอบ */
  hasText = false,
}: {
  running: boolean;
  notes: string[];
  steps: ToolStep[];
  startedAt?: number;
  durationMs?: number;
  hasText?: boolean;
}) {
  const t = useT();
  const regionId = useId();
  const [manual, setManual] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const elapsed = running
    ? startedAt
      ? Math.max(0, Math.floor((now - startedAt) / 1000))
      : null
    : durationMs != null
      ? Math.max(1, Math.round(durationMs / 1000))
      : null;

  const activeStep = running ? [...steps].reverse().find((s) => s.state === "running") : undefined;
  const expandable = notes.length > 0 || steps.length > 0;
  // ไม่มีอะไรให้กาง และคำตอบเริ่มไหลแล้ว → ซ่อนแถว "กำลังคิด" ไม่ให้เกะกะเหนือคำตอบ
  if (!expandable && (!running || hasText)) return null;

  // ระหว่างที่ยังไม่มีคำตอบให้กางไว้ก่อน (เห็นว่ากำลังทำอะไร) พอคำตอบเริ่มไหลค่อยพับ
  const open = expandable && (manual ?? (running && !hasText));

  const title = running
    ? (activeStep?.label ?? (hasText ? t("ขั้นตอนการทำงาน") : t("กำลังคิด...")))
    : elapsed !== null
      ? t("ใช้เวลา {n} วิ", { n: elapsed })
      : t("ขั้นตอนการทำงาน");
  const meta = running
    ? elapsed != null && elapsed > 0
      ? t("{n} วิ", { n: elapsed })
      : null
    : steps.length > 0
      ? t("{n} ขั้นตอน", { n: steps.length })
      : null;

  const head = (
    <>
      <Icon
        name={running ? "fa-circle-notch" : "fa-lightbulb"}
        className={`shrink-0 ${running ? "animate-spin text-brand-300" : "text-amber-glow"}`}
      />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {meta && <span className="shrink-0 text-micro tabular-nums text-fg-subtle">{meta}</span>}
      {expandable && (
        <Icon
          name={open ? "fa-chevron-up" : "fa-chevron-down"}
          className="shrink-0 text-micro text-fg-subtle"
        />
      )}
    </>
  );
  const headClass =
    "touch-min flex w-full items-center gap-2 px-3 py-2 text-left text-caption text-fg-subtle transition";

  return (
    <div className="mb-2 mt-2 overflow-hidden rounded-xl bg-white/[0.025] ring-1 ring-white/[0.06]">
      {expandable ? (
        <button
          type="button"
          onClick={() => setManual(!open)}
          aria-expanded={open}
          aria-controls={regionId}
          className={`${headClass} hover:bg-white/[0.02] hover:text-fg`}
        >
          {head}
        </button>
      ) : (
        <div className={headClass} aria-live="polite">
          {head}
        </div>
      )}
      {open && (
        <div
          id={regionId}
          className="space-y-2.5 border-t border-white/[0.06] px-3 py-2.5"
        >
          {notes.map((note, i) => (
            <p
              key={`note-${i}`}
              className="whitespace-pre-wrap border-l-2 border-white/[0.10] pl-2.5 text-caption leading-relaxed text-fg-subtle"
            >
              {note}
            </p>
          ))}
          {steps.map((s) => (
            <p key={s.id} className="flex items-center gap-2 text-caption text-fg-muted">
              <Icon
                name={
                  s.state === "running"
                    ? "fa-circle-notch"
                    : s.state === "stopped"
                      ? "fa-stop"
                      : s.state === "error"
                        ? "fa-circle-xmark"
                        : "fa-circle-check"
                }
                className={`shrink-0 ${
                  s.state === "running"
                    ? "animate-spin text-brand-300"
                    : s.state === "stopped"
                      ? "text-fg-subtle"
                      : s.state === "error"
                        ? "text-rose-300"
                        : "text-leaf"
                }`}
              />
              <span className="min-w-0 truncate">{s.label}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentWorkspace({
  userName,
  initialConversations,
  models,
  maxAttachments,
  chatReady,
  conversationId = null,
  initialMessages,
  initialModel,
  initialArtifacts,
}: {
  userName: string;
  initialConversations: ChatConversation[];
  models: AgentModel[];
  maxAttachments: number;
  chatReady: boolean;
  /** id ห้องที่เปิดอยู่ (มาจาก URL /c/<id>) — null = แชทใหม่ */
  conversationId?: string | null;
  initialMessages?: UiMessage[];
  initialModel?: string;
  /** ไฟล์ที่เอเจนต์สร้างไว้ในห้องนี้ มากับหน้าแรกเพื่อไม่ต้อง fetch ซ้ำ */
  initialArtifacts?: AgentArtifact[];
}) {
  const t = useT();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ChatConversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(conversationId);
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages ?? []);
  /** artifact ของห้องนี้ (id + ชื่อไฟล์) — ปุ่มแชร์ในกล่องโค้ดใช้ตามชื่อไฟล์ */
  const [artifacts, setArtifacts] = useState<AgentArtifact[]>(initialArtifacts ?? []);
  const [model, setModel] = useState(
    initialModel && models.some((m) => m.id === initialModel)
      ? initialModel
      : (models[0]?.id ?? ""),
  );
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesNotice, setFilesNotice] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  /** ห้องที่กำลังแก้ชื่อ (null = ไม่ได้เปิดกล่องแก้ชื่อ) */
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** ห้องที่กำลังดึงข้อความมาแทน (สลับห้องฝั่ง client) — แสดง spinner ที่แถวนั้น */
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  /** ผลของ fetch ห้องเก่าต้องไม่ทับห้องที่ผู้ใช้กดทีหลัง */
  const switchSeqRef = useRef(0);
  /** ตั้งชื่อไฟล์จากที่วาง (pasted-1.txt, pasted-2.txt) */
  const pasteSeqRef = useRef(0);
  /** คำค้นในประวัติแชท (กรองฝั่ง client — รายการถูกโหลดมาครบแล้ว) */
  const [historyQuery, setHistoryQuery] = useState("");
  /**
   * ลำดับของ run ที่กำลังทำงาน — ทุก async ต้องตรวจว่าตัวเองยังเป็น run ปัจจุบันก่อนเขียน state
   *
   * บั๊กเดิม: กดหยุดระหว่าง "กำลังคิด" แล้วพิมพ์คำถามใหม่ รอบเก่ายังทำงานต่อ
   * (await tool/approval) แล้วเขียน notes/steps/loading ของรอบเก่าทับรอบใหม่
   * ตัวเลขนี้ทำให้รอบเก่าเห็นว่าตัวเอง stale แล้วเลิกแตะ UI ทั้งหมด
   */
  const runSeqRef = useRef(0);
  const stepsRef = useRef<ToolStep[]>([]);
  const notesRef = useRef<string[]>([]);
  /** กันการกดส่งซ้ำก่อน React จะ re-render ด้วย loading = true */
  const busyRef = useRef(false);
  /** ข้อความที่ stream ล่าสุด — ใช้กู้คำตอบบางส่วนตอน error/กดหยุด */
  const answerRef = useRef("");
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);

  // ---- เครื่องมือเอเจนต์ — การอ่าน/เขียนไฟล์เกิดในเครื่องผู้ใช้ ----
  const [workspace, setWorkspace] = useState<FileSystemDirectoryHandle | null>(null);
  const [autoWrite, setAutoWrite] = useState(false);
  /** ขั้นตอนที่กำลังทำในรอบนี้ (แสดงใต้ข้อความ "กำลังคิด...") */
  const [steps, setSteps] = useState<ToolStep[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  /** showDirectoryPicker มีเฉพาะฝั่งเบราว์เซอร์ เปิดใช้หลัง hydrate เพื่อไม่ให้ DOM ต่างกัน */
  const [folderApi, setFolderApi] = useState(false);
  const approveRef = useRef<((ok: boolean) => void) | null>(null);

  /** สิ่งที่โมเดลพิมพ์บอกก่อนเรียกเครื่องมือในรอบนี้ (แสดงในกล่องกำลังคิด) */
  const [notes, setNotes] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /** index ของข้อความที่กำลังแก้ — ดึงข้อความกลับมาพิมพ์ต่อในกล่องพิมพ์เลย (ไม่มี popup) */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  /** ผู้ใช้ยังดูอยู่ตรงขอบล่างไหม — ตัวคุมว่า streaming จะเลื่อนตามหรือไม่ (ดู scrollToBottom) */
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    setFolderApi(canPickFolder());
    try {
      setAutoWrite(window.localStorage.getItem(AUTOWRITE_KEY) === "1");
    } catch {
      /* เบราว์เซอร์บล็อก localStorage (โหมดส่วนตัว) — ใช้ค่าเริ่มต้น */
    }
    // เคยเลือกโฟลเดอร์ไว้ก็ดึงกลับมาใช้ต่อ (เบราว์เซอร์จะขออนุญาตใหม่ตอนเรียกเครื่องมือ)
    void recallWorkspace().then((handle) => {
      if (handle) setWorkspace(handle);
    });
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // เปลี่ยนห้องจากลิงก์ /c/<id> — React ใช้ component เดิมต่อ จึงต้อง sync state กับ props
  useEffect(() => {
    // ถ้ามี run ค้างอยู่ (เช่นกดลิงก์ระหว่างรอคำตอบ) ต้องทำให้เป็น run เก่าก่อนสลับห้อง
    runSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setActiveId(conversationId);
    setMessages(initialMessages ?? []);
    setArtifacts(initialArtifacts ?? []);
    if (initialModel && models.some((m) => m.id === initialModel)) setModel(initialModel);
    setInput("");
    setAttachments([]);
    setEditingIndex(null);
    setNotice(null);
    setSteps([]);
    setNotes([]);
    stepsRef.current = [];
    notesRef.current = [];
    setRunStartedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ออกจากหน้าแชทระหว่างที่ยัง stream อยู่ — ตัด fetch ทิ้ง ไม่ให้กิน token ต่อ
  useEffect(
    () => () => {
      runSeqRef.current += 1;
      abortRef.current?.abort();
      approveRef.current?.(false);
    },
    [],
  );

  /* สถานะ "ย่อแถบข้าง" เป็นของจอใหญ่เท่านั้น ( sidebar ถาวร ) — บนมือถือมันคือ drawer
     ที่ลากออกมา ถ้ายอมให้ค่าจาก localStorage มาบังคับด้วย ผู้ใช้ที่เคยย่อบนเดสก์ท็อป
     จะได้อะไรที่กว้าง 288px แต่เหลือแค่ไอคอน และ "ประวัติแชท" หายไปทั้งบล็อก */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      let stored = false;
      try {
        stored = localStorage.getItem(COLLAPSE_KEY) === "1";
      } catch {
        /* ignore */
      }
      setCollapsed(mq.matches && stored);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    // จอเล็กอย่าเขียนค่ากลับ ลงในคีย์ของจอใหญ่ (ไม่อย่างนั้นความชอบบนเดสก์ท็อปจะถูกลบ)
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  /**
   * เลื่อนตามคำตอบที่กำลังไหล — แต่เฉพาะตอนที่ผู้ใช้ยังอยู่ใกล้ขอบล่าง
   * เดิมเรียกตรง ๆ ทุก token ทำให้คนที่เลื่อนขึ้นไปอ่านบรรทัดก่อนหน้าโดนกระชากกลับลง
   * และ smooth restart ทุก token = ภาพสั่น
   */
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 12 * 16;
  }, []);

  const scrollToBottom = useCallback(
    (force = false) => {
      if (!force && !isNearBottom()) return;
      setAtBottom(true);
      const apply = () => {
        const el = scrollRef.current;
        if (!el) return;
        // ระหว่าง stream ต้องกระโดดแบบ instant: smooth ที่ถูกรีสตาร์ททุก chunk จะสั่น
        el.scrollTop = el.scrollHeight;
      };
      // force = ข้อความใหม่เพิ่งถูกเพิ่มใน state; รอให้ React commit ก่อนแล้วค่อยวัดความสูง
      requestAnimationFrame(force ? () => requestAnimationFrame(apply) : apply);
    },
    [isNearBottom],
  );

  /** ปุ่มลูกศรลง — ผู้ใช้ตั้งใจกด จึงค่อยเลื่อนแบบ smooth */
  const jumpToBottom = useCallback(() => {
    setAtBottom(true);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  /** ผู้ใช้เลื่อนขึ้นมาอ่านเอง → หยุดเลื่อนตาม แล้วโชว์ปุ่มลงข้างล่าง */
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 96 /* 6rem */);
  }

  /* กล่องพิมพ์โตตามเนื้อหา: ของเดิมล็อก rows=2 ทำให้กล่องสูงแค่ราว 59px
     พิมพ์ยาวแล้วข้อความจะซ่อนอยู่ใน scrollbar ของตัวเอง และปุ่มส่งอยู่ใต้โคนนิ้วโป้ง
     (ตั้ง height = scrollHeight แล้วให้ max-h-44 ในคลาสเป็นเพดานของ CSS เอง) */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  /* iOS Safari ไม่ย่อ layout viewport ตอนคีย์บอร์ดเปิด (interactive-widget ใช้ไม่ได้กับมัน)
     ถ้าปล่อยไว้ composer จมใต้คีย์บอร์ดถาวรบน iPhone จึงต้องหด container ตาม visualViewport เอง
     Chrome Android ย่อให้แล้วเพราะเราตั้ง resizes-content ส่วนต่างจึงใกล้ 0 ไม่แตะอะไร
     เกณฑ์ 80px กันกรณีแถบ URL หด-ขยายที่ทำให้ค่าขยับนิดหน่อย */
  useEffect(() => {
    const vv = window.visualViewport;
    const shell = shellRef.current;
    if (!vv || !shell) return;
    const apply = () => {
      const keyboardUp = window.innerHeight - vv.height > 80;
      shell.style.height = keyboardUp ? `${vv.height}px` : "";
      if (keyboardUp) requestAnimationFrame(() => scrollToBottom(true));
    };
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    apply();
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, [scrollToBottom]);

  /* เปิดห้องเก่า: ต้องเห็นข้อความล่าสุด ไม่ใช่จุดเริ่มต้นของบทสนทนา
     ใช้ activeId (ไม่ใช่ prop conversationId) เพราะการสลับห้องฝั่ง client ไม่ทำให้ prop เปลี่ยน */
  useEffect(() => {
    requestAnimationFrame(() => scrollToBottom(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  /* drawer บนมือถือคือ modal: ต้องมี Escape, ล็อกสครอลล์หลังผ้าม่าน, ย้าย focus เข้าแผง
     และคืน focus ตอนปิด — ไม่งั้นปุ่ม "ปิดเมนู" เป็นทางออกเดียวของคนใช้คีย์บอร์ด */
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [drawerOpen]);

  const remaining = Math.max(0, maxAttachments - attachments.length);

  /**
   * ยกเลิก run ที่กำลังทำงานทันที
   *
   * เพิ่มเลข run ก่อน abort เพื่อให้ทุก await ที่ยังค้างอยู่ของรอบเก่ารู้ตัวว่า stale
   * แล้วไม่เขียนทับ UI ของรอบใหม่ (ต้นเหตุของ "think อันเก่าโผล่มาอีก")
   */
  function cancelActiveRun() {
    runSeqRef.current += 1;
    busyRef.current = false;
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    // ถ้ากล่องขออนุญาตไฟล์เปิดอยู่ ต้องปิดและคืน false ให้ runTool ไปต่อได้ ไม่ค้างตลอดกาล
    approveRef.current?.(false);
    approveRef.current = null;
    setPending(null);
    setLoading(false);
    setSteps([]);
    setNotes([]);
    stepsRef.current = [];
    notesRef.current = [];
    answerRef.current = "";
    setRunStartedAt(null);
  }

  function startNewChat() {
    cancelActiveRun();
    // ยกเลิก fetch ห้องเก่าที่ค้างอยู่ด้วย (ผู้ใช้อาจกดห้องแล้วเปลี่ยนใจมาแชทใหม่)
    switchSeqRef.current += 1;
    setSwitchingId(null);
    setActiveId(null);
    setMessages([]);
    setArtifacts([]);
    setInput("");
    setAttachments([]);
    setEditingIndex(null);
    setNotice(null);
    setDrawerOpen(false);
    // replaceState ไม่ทำให้ page component รีเมานต์ → ข้อความที่พิมพ์ไว้ไม่หาย
    if (pathname !== "/agent") window.history.replaceState(null, "", "/agent");
  }

  /**
   * เปิดห้องแชทอื่นโดยไม่ render หน้าที่เซิร์ฟเวอร์
   *
   * เดิมทุกการกดใน "ประวัติแชท" เป็น <Link> → Next ต้อง render /c/<id> ใหม่ทั้งต้น:
   * proxy ไปถาม Supabase Auth 1 รอบ + layout กับ page เรียก getSessionUser() ซ้ำอีก
   * + อ่าน catalog/ประวัติแชทอีกหลายรอบ ทั้งที่บนหน้าจอมีโครงเดิมอยู่แล้ว
   * ทางนี้เรียก API ที่คืนเฉพาะข้อความ (1 request) แล้ว swap state ในเครื่องผู้ใช้
   * เร็วกว่าเดิมหลายเท่าและใช้ CPU ของ function เพียงเสี้ยวเดียว
   * (ยังเข้าห้องทางลิงก์/รีเฟรช/ส่งต่อ URL ได้ตามเดิม เพราะหน้า /c/<id> ยังอยู่)
   */
  async function switchConversation(id: string) {
    if (id === activeId) {
      setDrawerOpen(false);
      return;
    }
    const seq = ++switchSeqRef.current;
    cancelActiveRun(); // ห้องก่อนหน้ายังตอบไม่จบ — หยุดก่อน ไม่งั้นข้อความจะข้ามห้อง
    setDrawerOpen(false);
    setActiveId(id);
    setSwitchingId(id);
    setInput("");
    setAttachments([]);
    setEditingIndex(null);
    setNotice(null);
    setMessages([]);
    if (pathname !== `/c/${id}`) window.history.replaceState(null, "", `/c/${id}`);
    try {
      const res = await fetch(`/api/agent/conversations/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        conversation: {
          model?: string;
          artifacts?: AgentArtifact[];
          messages?: {
            id: string;
            role: string;
            content: string;
            attachments?: ChatAttachment[];
          }[];
        };
      };
      if (seq !== switchSeqRef.current) return; // มีคลิกที่ใหม่กว่านำไปแล้ว — ผลเก่าต้องทิ้ง
      setArtifacts(data.conversation.artifacts ?? []);
      setMessages(
        (data.conversation.messages ?? [])
          .filter((m) => m.role !== "system")
          .map((m) => ({
            id: m.id,
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content,
            attachments: m.attachments ?? [],
          })),
      );
      const want = data.conversation.model ?? "";
      if (want && models.some((m) => m.id === want)) setModel(want);
    } catch {
      if (seq === switchSeqRef.current) setNotice(t("เปิดห้องแชทไม่สำเร็จ ลองอีกครั้ง"));
    } finally {
      if (seq === switchSeqRef.current) setSwitchingId(null);
    }
  }

  /** ขอยืนยันผ่าน Dialog ก่อนลบ (ไม่ใช้ confirm() ของเบราว์เซอร์) */
  function deleteConversation(id: string) {
    setDrawerOpen(false);
    setPendingDelete(id);
  }

  async function confirmDelete() {
    const id = pendingDelete;
    if (!id) return;
    const removed = conversations.find((c) => c.id === id);
    setDeleting(true);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) startNewChat();
    try {
      const res = await fetch(`/api/agent/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setPendingDelete(null);
    } catch {
      // ลบไม่สำเร็จ = ยังมีห้องอยู่ใน DB → คืนรายการกลับ ไม่ให้หายจาก sidebar จนกว่าจะรีเฟรช
      if (removed) {
        setConversations((prev) =>
          [removed, ...prev.filter((c) => c.id !== id)].sort((a, b) =>
            (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
          ),
        );
      }
      setNotice(t("ลบแชทไม่สำเร็จ"));
    } finally {
      setDeleting(false);
    }
  }

  function startRename(id: string, currentTitle: string) {
    setDrawerOpen(false);
    setRenaming({ id, title: currentTitle });
    setRenameValue(currentTitle);
  }

  async function confirmRename() {
    if (!renaming) return;
    const title = renameValue.trim().slice(0, 80);
    if (!title) return;
    setRenameBusy(true);
    const id = renaming.id;
    const previous = conversations.find((c) => c.id === id)?.title ?? "";
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      const res = await fetch(`/api/agent/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setRenaming(null);
    } catch {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: previous } : c)),
      );
      setNotice(t("แก้ชื่อแชทไม่สำเร็จ"));
    } finally {
      setRenameBusy(false);
    }
  }

  async function loadFiles() {
    setFilesLoading(true);
    setFilesNotice(null);
    try {
      const res = await fetch("/api/agent/files", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { files: AgentFile[] };
      setFiles(data.files);
    } catch {
      setFilesNotice(t("โหลดคลังไฟล์ไม่สำเร็จ"));
    } finally {
      setFilesLoading(false);
    }
  }

  async function downloadFile(f: AgentFile) {
    try {
      const res = await fetch(`/api/agent/files/${f.id}?download=1`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name || "artifact.html";
      a.click();
      // เพิ่ง revoke หลัง click ทันทีทำให้บางเบราว์เซอร์ยกเลิกดาวน์โหลดก่อนเริ่ม
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setFilesNotice(t("ดาวน์โหลดไม่สำเร็จ ลองอีกครั้ง"));
    }
  }

  async function shareFile(id: string) {
    setSharingId(id);
    setFilesNotice(null);
    try {
      const res = await fetch(`/api/agent/files/${id}/share`, { method: "POST" });
      const data = (await res.json()) as {
        shareUrl?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!res.ok || !data.shareUrl) throw new Error(data.error ?? String(res.status));
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, shareUrl: data.shareUrl!, shareExpiresAt: data.expiresAt ?? null }
            : f,
        ),
      );
    } catch {
      setFilesNotice(t("แชร์ไม่สำเร็จ ลองอีกครั้ง"));
    } finally {
      setSharingId(null);
    }
  }

  /**
   * แชร์ artifact จากในข้อความเลย ไม่ต้องเปิดคลังไฟล์ก่อน
   *
   * กล่องโค้ดในข้อความมีแค่ชื่อที่โมเดลพิมพ์หลัง ``` (บ่อย kali ไม่พิมพ์) ขณะที่ไฟล์ในคลัง
   * ถูกตั้งชื่อจาก <title>/<h1> ของโค้ด จึงต้องจับตัวอื่นด้วย: ตรงชื่อ → มีคำในชื่อซึ่งกัน
   * → ขนาดใกล้สุดในกลุ่มชนิดเดียวกัน และแจ้งชื่อไฟล์ที่แชร์ให้ผู้ใช้เห็น จะได้รู้ว่าลิงก์คือไฟล์ไหน
   */
  async function shareArtifact(block: { name: string; lang: string; bytes: number }): Promise<string | null> {
    if (!activeId) return null;
    let file = pickArtifact(artifacts, block);
    if (!file) {
      try {
        const res = await fetch(`/api/agent/conversations/${activeId}`, { cache: "no-store" });
        if (!res.ok) return null;
        const data = (await res.json()) as { conversation?: { artifacts?: AgentArtifact[] } };
        const list = data.conversation?.artifacts ?? [];
        setArtifacts(list);
        file = pickArtifact(list, block);
      } catch {
        return null;
      }
    }
    if (!file) {
      setNotice(t("ยังหาไฟล์นี้ในคลังไม่เจอ — ลองใหม่อีกครั้ง"));
      return null;
    }
    if (file.shareUrl) {
      setNotice(t("แชร์ {name} แล้ว", { name: file.name }));
      return file.shareUrl;
    }

    const id = file.id;
    try {
      const res = await fetch(`/api/agent/files/${id}/share`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        shareUrl?: string;
        expiresAt?: string;
      } | null;
      const url = data?.shareUrl;
      if (!res.ok || !url || !data) {
        setNotice(t("แชร์ไม่สำเร็จ ลองอีกครั้ง"));
        return null;
      }
      const expiresAt = data.expiresAt ?? null;
      setArtifacts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, shareUrl: url, shareExpiresAt: expiresAt } : a,
        ),
      );
      setNotice(t("แชร์ {name} แล้ว", { name: file.name }));
      return url;
    } catch {
      setNotice(t("แชร์ไม่สำเร็จ ลองอีกครั้ง"));
      return null;
    }
  }

  async function copyShare(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* เบราว์เซอร์บางตัวบล็อก clipboard — ผู้ใช้คลิกขวาคัดลอกลิงก์เองได้ */
    }
  }

  useEffect(() => {
    if (filesOpen) void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesOpen]);

  async function fileToAttachment(file: File): Promise<ChatAttachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          mime: file.type || "application/octet-stream",
          dataUrl: reader.result as string,
        });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * วางโค้ดยาว ๆ ในช่องพิมพ์ → แปลงเป็นไฟล์ .txt แนบให้เอง
   *
   * เดิมวางไฟล์ทั้งก้อนแล้วข้อความ 500 บรรทัดไปกองอยู่ในกล่องพิมพ์ ทั้งเลื่อนทั้งกดผิด
   * จึงย้ายไปเป็นไฟล์แนบ (เซิร์ฟเวอร์ถอดเนื้อหาจากไฟล์ส่งให้โมเดลอ่านเต็ม ๆ)
   * ข้อความสั้นยังวางเป็นข้อความตามปกติไม่แตะเลย
   */
  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!text || attachments.length >= maxAttachments) return;
    const lines = text.split("\n").length;
    if (text.length < 1200 && lines < 24) return;
    e.preventDefault();
    const n = pasteSeqRef.current + 1;
    pasteSeqRef.current = n;
    const name = `pasted-${n}.txt`;
    setAttachments((prev) =>
      [...prev, { name, mime: "text/plain", dataUrl: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}` }].slice(
        0,
        maxAttachments,
      ),
    );
    setNotice(t("แปลงโค้ดที่วางเป็นไฟล์ {name} ให้แล้ว — พิมพ์คำถามสั้น ๆ ต่อได้เลย", { name }));
    inputRef.current?.focus();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const slots: ChatAttachment[] = [];
    for (const f of Array.from(files)) {
      if (slots.length >= remaining) {
        setNotice(t("แนบไฟล์ได้สูงสุด {n} ไฟล์", { n: maxAttachments }));
        break;
      }
      if (f.size > 10 * 1024 * 1024) {
        setNotice(t("ไฟล์ใหญ่เกิน 10MB: {name}", { name: f.name }));
        continue;
      }
      try {
        slots.push(await fileToAttachment(f));
      } catch {
        setNotice(t("อ่านไฟล์ไม่สำเร็จ: {name}", { name: f.name }));
      }
    }
    setAttachments((prev) => [...prev, ...slots].slice(0, maxAttachments));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function ensureConversation(
    signal: AbortSignal,
    isCurrent: () => boolean,
  ): Promise<string | null> {
    try {
      const res = await fetch("/api/agent/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { conversation: ChatConversation };
      // กดหยุด/สลับห้องระหว่างรอสร้างห้อง → ห้ามยัดห้องใหม่ทับหน้าจอที่เปลี่ยนไปแล้ว
      if (!isCurrent() || signal.aborted) return null;
      setConversations((prev) => [data.conversation, ...prev]);
      setActiveId(data.conversation.id);
      // ให้ URL เป็น /c/<uuid> ทันทีที่ห้องถูกสร้าง (รีเฟรชแล้วยังกลับเข้ามาเจอ)
      window.history.replaceState(null, "", `/c/${data.conversation.id}`);
      return data.conversation.id;
    } catch {
      // ปล่อยให้ผู้เรียกแสดง error พร้อมปุ่มลองใหม่ในข้อความของผู้ช่วย
      return null;
    }
  }

  function toggleAutoWrite(value: boolean) {
    setAutoWrite(value);
    try {
      window.localStorage.setItem(AUTOWRITE_KEY, value ? "1" : "0");
    } catch {
      /* โหมดส่วนตัวที่เบราว์เซอร์บล็อก localStorage — ค่าเริ่มต้นคือถามทุกครั้ง */
    }
  }

  async function chooseWorkspace() {
    const handle = await pickWorkspaceFolder();
    if (!handle) return;
    setWorkspace(handle);
    if (!(await grantWorkspaceAccess(handle, "readwrite"))) {
      setNotice(t("ไม่ได้รับสิทธิ์เข้าถึงโฟลเดอร์นี้ เอเจนต์จะอ่านและแก้ไฟล์ไม่ได้"));
    }
  }

  async function dropWorkspace() {
    await forgetWorkspace();
    setWorkspace(null);
  }

  /** กล่องยืนยันจะ resolve ฟังก์ชันนี้ — ใช้ขออนุญาตก่อนแตะไฟล์ในเครื่องผู้ใช้ */
  function approve(action: PendingAction): Promise<boolean> {
    if (autoWrite && action.kind === "write") return Promise.resolve(true);
    return new Promise((resolve) => {
      approveRef.current = resolve;
      setPending(action);
    });
  }

  function decide(approved: boolean) {
    approveRef.current?.(approved);
    approveRef.current = null;
    setPending(null);
  }

  function stepLabel(call: AgentToolCall): string {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
    } catch {
      /* โมเดลส่ง args ไม่สมบูรณ์ — แสดงแค่ชื่อเครื่องมือก็ยังอ่านรู้เรื่อง */
    }
    const path = typeof args.path === "string" ? args.path : "";
    const query = typeof args.query === "string" ? args.query : "";
    switch (call.function.name) {
      case "web_search":
        return `${t("ค้นเว็บ")} · ${query}`;
      case "list_files":
        return `${t("ไลสต์ไฟล์")}${path ? ` · ${path}` : ""}`;
      case "search_files":
        return `${t("ค้นในไฟล์")} · ${query}`;
      case "read_file":
        return `${t("อ่านไฟล์")} · ${path}`;
      case "write_file":
        return `${t("เขียนไฟล์")} · ${path}`;
      case "create_dir":
        return `${t("สร้างโฟลเดอร์")} · ${path}`;
      case "delete_path":
        return `${t("ลบ")} · ${path}`;
      default:
        return call.function.name;
    }
  }

  function setStreamingText(text: string) {
    answerRef.current = text;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.id !== "streaming") return prev;
      const copy = [...prev];
      copy[copy.length - 1] = { id: "streaming", role: "assistant", content: text, attachments: [] };
      return copy;
    });
  }

  /** ยิงหนึ่งรอบแล้วอ่าน event (NDJSON) กลับมาเป็นข้อความ + รายการเครื่องมือที่โมเดลขอ */
  async function streamRound(
    convId: string,
    payload: {
      content: string;
      attachments: ChatAttachment[];
      messages: AgentChatMessage[];
      tools: unknown[];
      toolNames: string[];
      workspaceReady: boolean;
    },
    signal: AbortSignal,
    runId: number,
  ): Promise<{ text: string; calls: AgentToolCall[] }> {
    const current = () => runSeqRef.current === runId && !signal.aborted;
    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: convId, model, ...payload }),
      signal,
    });
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    if (!current()) return { text: "", calls: [] };

    const newTitle = res.headers.get("x-conversation-title");
    if (newTitle) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: decodeURIComponent(newTitle) } : c)),
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let calls: AgentToolCall[] = [];

    /* วาดข้อความรวมเป็นเฟรมเดียว: upstream ส่ง chunk ถี่มาก ถ้าอัปเดต state
       ทุก chunk จะ re-render ข้อความทั้งแชทหลายสิบครั้งต่อวินาที */
    let frame = 0;
    const paint = () => {
      frame = 0;
      if (!current()) return;
      setStreamingText(text);
      scrollToBottom();
    };
    const schedulePaint = () => {
      if (frame || !current()) return;
      frame = requestAnimationFrame(paint);
    };
    const cancelPaint = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const handleLine = (line: string) => {
      if (!line) return;
      let event: { t?: string; v?: unknown; text?: string; fr?: string };
      try {
        event = JSON.parse(line) as typeof event;
      } catch {
        return;
      }
      if (event.fr === "length" && current()) {
        setNotice(t("คำตอบถูกตัดเพราะยาวเกินจำกัด — ให้เอเจนต์เขียนต่อเป็นท่อน ๆ ได้"));
      }
      if (event.t === "d") {
        text += String(event.v ?? "");
        // เก็บล่าสุดไว้ใน ref ทุก chunk ไม่รอ frame — กดหยุดแล้วได้คำตอบครบถึงตัวอักษรสุดท้าย
        if (current()) answerRef.current = text;
        schedulePaint();
      } else if (event.t === "tool") {
        cancelPaint();
        calls = (event.v as AgentToolCall[]) ?? [];
        if (typeof event.text === "string") text = event.text;
        if (current()) {
          answerRef.current = text;
          setStreamingText(text);
        }
      } else if (event.t === "notice" && current()) {
        setNotice(String(event.v ?? ""));
      } else if (event.t === "files" && current()) {
        // เซิร์ฟเวอร์เพิ่งบันทึก artifact ลงคลังไฟล์ → จับชื่อไว้ให้ปุ่มแชร์ในกล่องโค้ด
        const created =
          (event.v as { id: string; name: string; kind: string; sizeBytes: number }[]) ?? [];
        if (created.length > 0) {
          setArtifacts((prev) => {
            const byName = new Map(prev.map((a) => [a.name.toLowerCase(), a]));
            for (const f of created) {
              byName.set(f.name.toLowerCase(), {
                id: f.id,
                name: f.name,
                kind: f.kind,
                sizeBytes: f.sizeBytes,
                shareUrl: null,
                shareExpiresAt: null,
              });
            }
            return [...byName.values()];
          });
        }
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!current()) {
          await reader.cancel().catch(() => {});
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let cut = buffer.indexOf("\n");
        while (cut >= 0) {
          const line = buffer.slice(0, cut).trim();
          buffer = buffer.slice(cut + 1);
          cut = buffer.indexOf("\n");
          handleLine(line);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) handleLine(buffer.trim());
      cancelPaint();
      if (current()) setStreamingText(text);
      return { text, calls };
    } finally {
      cancelPaint();
    }
  }

  /**
   * หนึ่งรอบสนทนา: บันทึกคำถาม → stream → รันเครื่องมือ → stream ต่อ จนจบ
   *
   * ทุก await ตรวจ runId ก่อนเขียน state เสมอ — รอบที่ถูกกดหยุด/สลับห้องแล้ว
   * ต้องไม่ไปยุ่งกับข้อความของรอบใหม่
   */
  async function startTurn(
    question: string,
    files: ChatAttachment[],
    editFrom: number | null,
  ) {
    if (busyRef.current) return;
    if (!question && files.length === 0) return;
    if (models.length === 0) return;
    busyRef.current = true;

    const runId = ++runSeqRef.current;
    const isCurrent = () => runSeqRef.current === runId;
    const startedAt = Date.now();
    const controller = new AbortController();
    abortRef.current = controller;
    answerRef.current = "";

    setInput("");
    setAttachments([]);
    setEditingIndex(null);
    setNotice(null);
    setLoading(true);
    setRunStartedAt(startedAt);
    // ส่งข้อความ = ห้องนี้ถูกอัปเดตล่าสุด → ย้ายขึ้นบนสุดและจัดกลุ่ม "วันนี้" ทันที
    if (activeId) {
      const nowIso = new Date(startedAt).toISOString();
      setConversations((prev) => {
        const hit = prev.find((c) => c.id === activeId);
        if (!hit) return prev;
        return [{ ...hit, updatedAt: nowIso }, ...prev.filter((c) => c.id !== activeId)];
      });
    }
    const collected: ToolStep[] = [];
    const notesLog: string[] = [];
    stepsRef.current = collected;
    notesRef.current = notesLog;
    setSteps(collected);
    setNotes(notesLog);

    type FinishPatch = {
      content: string;
      steps?: ToolStep[];
      notes?: string[];
      thinkingMs?: number;
      stopped?: boolean;
      error?: string;
    };
    const finish = (patch: FinishPatch) => {
      if (!isCurrent()) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.id !== "streaming") return prev;
        const copy = [...prev];
        copy[copy.length - 1] = {
          id: `a-${Date.now()}`,
          role: "assistant",
          attachments: [],
          ...patch,
          steps: patch.steps && patch.steps.length > 0 ? patch.steps : undefined,
          notes: patch.notes && patch.notes.length > 0 ? [...patch.notes] : undefined,
        };
        return copy;
      });
    };

    // กำลังแก้ข้อความเดิม → เล็มประวัติตั้งแต่ข้อความนั้นไป ทั้งบนจอและใน DB
    if (editFrom !== null) {
      setMessages((prev) => prev.slice(0, editFrom));
    }

    const userMsg: UiMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: question,
      attachments: files,
    };
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: "streaming", role: "assistant", content: "", attachments: [] },
    ]);
    /* ผู้ใช้กดส่งเอง = ต้องเห็นข้อความของตัวเองเสมอ แม้จะเลื่อนขึ้นไปอ่านของเก่าอยู่
       (จุดอื่นตอน stream ปล่อยให้ isNearBottom เป็นผู้ตัดสิน) */
    scrollToBottom(true);

    if (editFrom !== null && activeId) {
      try {
        await fetch(`/api/agent/conversations/${activeId}/trim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: editFrom }),
          signal: controller.signal,
        });
      } catch {
        if (!isCurrent() || controller.signal.aborted) return;
        setNotice(t("เล็มประวัติไม่สำเร็จ แต่จะส่งข้อความที่แก้ใหม่ไปแทน"));
      }
      if (!isCurrent() || controller.signal.aborted) return;
    }

    let convId = activeId;
    if (!convId) {
      convId = await ensureConversation(controller.signal, isCurrent);
      if (!isCurrent() || controller.signal.aborted) return;
      if (!convId) {
        finish({
          content: "",
          error: t("เริ่มแชทไม่สำเร็จ ลองอีกครั้ง"),
          thinkingMs: Date.now() - startedAt,
        });
        return;
      }
    }

    // หลังรีเฟรชเบราว์เซอร์จะลดสิทธิ์โฟลเดอร์ลง ต้องขอใหม่ก่อนแตะไฟล์จริง
    if (workspace && !(await grantWorkspaceAccess(workspace, "readwrite"))) {
      if (!isCurrent() || controller.signal.aborted) return;
      setNotice(t("ยังไม่มีสิทธิ์เข้าถึงโฟลเดอร์งาน — เอเจนต์จะอ่านและแก้ไฟล์ไม่ได้"));
    }
    if (!isCurrent() || controller.signal.aborted) return;

    const sentAttachments = files;
    const runMessages: AgentChatMessage[] = [];
    let answer = "";
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        if (!isCurrent() || controller.signal.aborted) return;
        const ctx: ToolContext = {
          workspace,
          autoWrite,
          approve,
          signal: controller.signal,
          notify: (message) => {
            if (isCurrent()) setNotice(message);
          },
        };
        const tools = toolDefinitions(ctx);
        const { text, calls } = await streamRound(
          convId,
          {
            content: round === 0 ? question : "",
            attachments: round === 0 ? sentAttachments : [],
            messages: runMessages,
            tools,
            toolNames: tools.map((tool) => tool.function.name),
            workspaceReady: Boolean(workspace),
          },
          controller.signal,
          runId,
        );
        if (!isCurrent() || controller.signal.aborted) return;
        answer = text;
        if (calls.length === 0) break;

        // สิ่งที่โมเดลพิมพ์ก่อนเรียกเครื่องมือ คือ "ความคิด" ที่ผู้ใช้อยากเห็น
        if (text.trim()) {
          notesLog.push(text.trim());
          notesRef.current = [...notesLog];
          setNotes([...notesLog]);
        }
        runMessages.push({ role: "assistant", content: text, tool_calls: calls });
        for (const call of calls) {
          if (!isCurrent() || controller.signal.aborted) return;
          const step: ToolStep = {
            id: `${round}-${call.id}`,
            label: stepLabel(call),
            state: "running",
          };
          collected.push(step);
          stepsRef.current = [...collected];
          setSteps([...collected]);
          scrollToBottom();
          const result = await runTool(call.function.name, call.function.arguments, ctx);
          // กดหยุดระหว่างรอเครื่องมือ/กล่องอนุญาต → ไม่ต้องเอาผลไปทำต่อหรือวาดอะไรทั้งนั้น
          if (!isCurrent() || controller.signal.aborted) return;
          step.state = /"ok"\s*:\s*false/.test(result) ? "error" : "done";
          stepsRef.current = [...collected];
          setSteps([...collected]);
          runMessages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: result,
          });
        }
        setStreamingText("");
      }

      finish({
        content: answer || t("เอเจนต์ไม่ได้ตอบกลับมา"),
        steps: collected,
        notes: notesLog,
        thinkingMs: Date.now() - startedAt,
      });
    } catch (err) {
      if (!isCurrent()) return;
      const stopped = controller.signal.aborted;
      const msg = err instanceof Error ? err.message : String(err);
      finish({
        content: answerRef.current,
        error: stopped ? undefined : msg,
        stopped,
        // เครื่องมือที่ค้างอยู่ตอน error/ถูกตัดconnection ต้องไม่โชว์ spinner หมุนค้าง
        steps: collected.map((s) => (s.state === "running" ? { ...s, state: "error" } : s)),
        notes: notesLog,
        thinkingMs: Date.now() - startedAt,
      });
    } finally {
      if (isCurrent()) {
        abortRef.current = null;
        busyRef.current = false;
        setLoading(false);
        setSteps([]);
        setNotes([]);
        stepsRef.current = [];
        notesRef.current = [];
        setRunStartedAt(null);
      }
    }
  }

  function send() {
    if (busyRef.current) return;
    const question = input.trim();
    if (!question && attachments.length === 0) return;
    if (models.length === 0) return;
    const files = attachments;
    const editFrom = editingIndex;
    void startTurn(question, files, editFrom);
  }

  /** สร้างคำตอบของคำถามล่าสุดใหม่ — เล็มคำตอบเดิมแล้วถามซ้ำด้วยข้อความเดิม */
  function retryLast() {
    if (busyRef.current) return;
    let lastUser = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        lastUser = i;
        break;
      }
    }
    if (lastUser < 0) return;
    const m = messages[lastUser];
    void startTurn(m.content, m.attachments, lastUser);
  }

  function stopRun() {
    if (!busyRef.current) return;
    const partial = answerRef.current;
    const stoppedSteps = stepsRef.current;
    const stoppedNotes = notesRef.current;
    const started = runStartedAt;
    cancelActiveRun();
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.id !== "streaming") return prev;
      const copy = [...prev];
      copy[copy.length - 1] = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: partial,
        attachments: [],
        steps: stoppedSteps.length
          ? stoppedSteps.map((s) => (s.state === "running" ? { ...s, state: "stopped" } : s))
          : undefined,
        notes: stoppedNotes.length ? [...stoppedNotes] : undefined,
        thinkingMs: started ? Date.now() - started : undefined,
        stopped: true,
      };
      return copy;
    });
  }

  async function copyMessage(m: UiMessage) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1600);
    } catch {
      /* เบราว์เซอร์ไม่อนุญาต clipboard (ไม่ใช่ https) — เงียบไว้ */
    }
  }

  /** ดึงข้อความกลับมาพิมพ์ต่อในกล่องพิมพ์ — ส่งแล้วถึงเล็มประวัติ (ดู send) */
  function startEdit(m: UiMessage, index: number) {
    if (busyRef.current || loading) return;
    setEditingIndex(index);
    setInput(m.content);
    setAttachments(m.attachments);
    setNotice(null);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollTop = el.scrollHeight;
    });
  }

  function cancelEdit() {
    setEditingIndex(null);
    setInput("");
    setAttachments([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && editingIndex !== null) {
      e.preventDefault();
      cancelEdit();
      return;
    }
    // อย่าส่งระหว่าง composing (IME ภาษาจีน/ญี่ปุ่น) — Enter ตอนเลือกตัวอักษรไม่ใช่การส่ง
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!loading) send();
    }
  }

  const filteredConversations = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => titleOf(c).toLowerCase().includes(q));
  }, [conversations, historyQuery]);

  /** จัดประวัติเป็นกลุ่มวันที่แบบ Claude — หาแชทเก่าเร็วขึ้นเมื่อรายการยาว */
  const historyGroups = useMemo(() => {
    const groups: { key: string; label: string; items: ChatConversation[] }[] = [
      { key: "today", label: t("วันนี้"), items: [] },
      { key: "yesterday", label: t("เมื่อวาน"), items: [] },
      { key: "week", label: t("7 วันล่าสุด"), items: [] },
      { key: "older", label: t("เก่ากว่า"), items: [] },
    ];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const DAY = 86_400_000;
    for (const c of filteredConversations) {
      const raw = c.updatedAt || c.createdAt;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        groups[3].items.push(c);
        continue;
      }
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const diff = Math.round((todayStart - start) / DAY);
      const idx = diff <= 0 ? 0 : diff === 1 ? 1 : diff <= 7 ? 2 : 3;
      groups[idx].items.push(c);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [filteredConversations, t]);

  const renderHistoryItem = (c: ChatConversation) => (
    <li key={c.id} className="group/item relative">
      <Link
        href={`/c/${c.id}`}
        title={titleOf(c)}
        onClick={(e) => {
          // คลิกซ้ายธรรมดา = สลับห้องฝั่ง client ไม่ต้อง render ทั้งหน้าที่เซิร์ฟเวอร์
          // ส่วน ctrl/shift/คลิกกลาง ยังให้เบราว์เซอร์เปิดลิงก์แบบเดิม
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          void switchConversation(c.id);
        }}
        aria-current={activeId === c.id ? "page" : undefined}
        className={`flex min-h-11 items-center gap-1.5 rounded-md py-2 pl-3 pr-11 text-left text-caption transition-colors ${
          activeId === c.id
            ? "bg-white/[0.10] text-fg"
            : "text-fg-muted hover:bg-white/[0.06] hover:text-fg"
        }`}
      >
        {switchingId === c.id && (
          <Icon name="fa-circle-notch" className="h-3 w-3 shrink-0 animate-spin text-brand-300" />
        )}
        <span className="truncate">{titleOf(c)}</span>
      </Link>
      {/* row-actions: จอสัมผัสต้องเห็นเสมอ (ดู globals.css) — เดิม opacity-0 + group-hover
          อย่างเดียว ทำให้บนมือถือเมนู ⋮ มองไม่เห็นแต่ยังกดถูก (ช่อง pr-11 เว้นไว้)
          ไม่มีพื้นหลังทึบ: เดิม bg-ink-950/40 + ปุ่มสูง 44px ล้นแถว 36px
          แถวจึงกลายเป็นคอลัมน์บล็อกดำทับชื่อแชทอ่านไม่ออก */}
      <span className="row-actions absolute right-0 top-1/2 -translate-y-1/2">
        <Menu
          label={t("ตัวเลือกแชท")}
          widthPx={176}
          placement="right"
          triggerClassName="h-7 w-7"
          items={[
            {
              icon: "fa-pen",
              label: t("แก้ชื่อแชท"),
              onClick: () => startRename(c.id, titleOf(c)),
            },
            {
              icon: "fa-trash",
              label: t("ลบแชท"),
              tone: "danger",
              onClick: () => deleteConversation(c.id),
            },
          ]}
        />
      </span>
    </li>
  );

  /** แถบเครื่องมือเอเจนต์ — เวอร์ชันไอคอนสำหรับมือถือกับเวอร์ชันเต็มสำหรับจอใหญ่ */
  const toolsBar = (compact: boolean) => (
    <AgentToolsBar
      workspaceName={workspace?.name ?? null}
      canPick={folderApi}
      autoWrite={autoWrite}
      onPick={chooseWorkspace}
      onDisconnect={dropWorkspace}
      onAutoWriteChange={toggleAutoWrite}
      compact={compact}
    />
  );

  const activeTitle = activeId
    ? titleOf(conversations.find((c) => c.id === activeId) ?? { title: "" } as ChatConversation)
    : t("แชทใหม่");

  const asideBody = (
    <>
      <div className={`flex h-14 shrink-0 items-center gap-2 px-3 ${collapsed ? "justify-center px-2" : ""}`}>
        {collapsed ? (
          // ตอนย่อ: โลโก้อยู่บนสุด ชี้เมาส์แล้วสลับเป็นไอคอนแผง เพื่อขยายกลับมา
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label={t("ขยายแถบข้าง")}
            title={t("ขยายแถบข้าง")}
            className="group/head relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition hover:bg-white/[0.08]"
          >
            <Logo size={30} className="transition-opacity duration-150 group-hover/head:opacity-0" />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-fg opacity-0 transition-opacity duration-150 group-hover/head:opacity-100">
              <PanelIcon />
            </span>
          </button>
        ) : (
          <>
            <Logo size={30} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-body-sm font-semibold tracking-tight text-fg">
              Web <span className="text-brand-300">Agent</span>
            </span>
            {/* ปุ่มย่ออยู่ใน sidebar ฝั่งขวา ตามที่ผู้ใช้ขอ — โชว์เฉพาะจอใหญ่
                เพราะใน drawer มือถือตำแหน่งนี้ทับปุ่ม ✕ ปิดเมนูจนอ่านไม่รู้เรื่อง */}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label={t("ย่อแถบข้าง")}
              title={t("ย่อแถบข้าง")}
              className="touch-min-icon hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition hover:bg-white/[0.08] hover:text-fg lg:flex"
            >
              <PanelIcon />
            </button>
          </>
        )}
      </div>

      <div className="space-y-1 px-3">
        <button
          type="button"
          onClick={startNewChat}
          title={t("แชทใหม่")}
          className={`touch-min flex w-full items-center gap-2.5 rounded-lg bg-brand-500/90 px-3 py-2.5 text-caption font-semibold text-fg transition hover:bg-brand-500 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-square-pen" className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t("แชทใหม่")}</span>}
        </button>
        <Link
          href="/images"
          onClick={() => setDrawerOpen(false)}
          title={t("สร้างรูปภาพ")}
          className={`touch-min flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-caption font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-image" className="h-4 w-4 shrink-0 text-brand-300" />
          {!collapsed && <span>{t("สร้างรูป")}</span>}
        </Link>
        <button
          type="button"
          onClick={() => {
            setFilesOpen(true);
            setDrawerOpen(false);
          }}
          title={t("คลังไฟล์")}
          className={`touch-min flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-caption font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-folder-open" className="h-4 w-4 shrink-0 text-brand-300" />
          {!collapsed && <span>{t("คลังไฟล์")}</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <p className="px-4 pb-2 text-micro font-semibold uppercase tracking-[0.16em] text-fg-subtle">
            {t("ประวัติแชท")}
          </p>
          {conversations.length > 0 && (
            <div className="relative mb-1.5 px-2">
              <Icon
                name="fa-magnifying-glass"
                className="pointer-events-none absolute left-[1.3rem] top-1/2 -translate-y-1/2 text-micro text-fg-subtle"
              />
              <input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder={t("ค้นหาแชท")}
                aria-label={t("ค้นหาแชท")}
                type="search"
                className="h-10 w-full rounded-md bg-white/[0.04] pl-8 pr-11 text-caption text-fg outline-none transition placeholder:text-fg-subtle hover:bg-white/[0.06] focus:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-white/[0.14] focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden"
              />
              {historyQuery && (
                <button
                  type="button"
                  onClick={() => setHistoryQuery("")}
                  aria-label={t("ล้างคำค้น")}
                  className="touch-min-icon absolute right-0.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-micro text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg"
                >
                  <Icon name="fa-xmark" />
                </button>
              )}
            </div>
          )}
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {conversations.length === 0 ? (
              <p className="px-3 py-2 text-label text-fg-subtle">{t("ยังไม่มีประวัติแชท")}</p>
            ) : historyGroups.length === 0 ? (
              <p className="px-3 py-2 text-label text-fg-subtle">{t("ไม่พบแชทที่ตรงกัน")}</p>
            ) : (
              historyGroups.map((g) => (
                <div key={g.key} className="mb-2">
                  <p className="px-3 pb-1 pt-1.5 text-micro font-semibold uppercase tracking-[0.14em] text-fg-subtle/80">
                    {g.label}
                  </p>
                  <ul className="space-y-0.5">{g.items.map(renderHistoryItem)}</ul>
                </div>
              ))
            )}
          </nav>
        </div>
      )}
      {collapsed && <div className="flex-1" />}

      <div className={`shrink-0 border-t border-white/[0.07] p-3 ${collapsed ? "text-center" : ""}`}>
        {!collapsed && (
          <p className="mb-2 truncate px-1 text-label text-fg-subtle">{userName}</p>
        )}
        <Link
          href="/dashboard"
          title={t("กลับหน้าหลัก")}
          className={`touch-min flex items-center gap-2.5 rounded-md px-3 py-2 text-caption text-fg-muted transition hover:bg-white/[0.06] hover:text-fg ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-arrow-left" className="h-4 w-4 shrink-0 text-label" />
          {!collapsed && <span>{t("กลับหน้าหลัก")}</span>}
        </Link>
      </div>
    </>
  );

  /** คำถามล่าสุดของผู้ใช้เท่านั้นที่แก้ได้ (ปุ่มแก้ไขไปโผล่ที่ข้อความท้ายสุด) */
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");

  /** ตัวอย่างงานที่กดแล้วเติมคำถามลงช่องพิมพ์ทันที — ไม่ส่งเอง ผู้ใช้ยังแก้ถ้อยคำได้ */
  const quickStarts = [
    {
      icon: "fa-code",
      title: t("สร้างหน้าเว็บ"),
      desc: t("HTML/CSS หน้าเดียวที่เปิดดูได้ทันที"),
      prompt: t("ช่วยสร้างหน้าเว็บ portfolio เรียบ ๆ สวย ๆ หนึ่งหน้าให้หน่อย"),
    },
    {
      icon: "fa-magnifying-glass",
      title: t("ค้นเว็บและสรุป"),
      desc: t("ข้อมูลล่าสุดพร้อมลิงก์อ้างอิง"),
      prompt: t("ช่วยค้นเว็บแล้วสรุปข่าว AI ล่าสุดให้ฟังหน่อย พร้อมลิงก์อ้างอิง"),
    },
    {
      icon: "fa-terminal",
      title: t("ช่วยเขียนโค้ด"),
      desc: t("อธิบายแนวคิดและเขียนให้พร้อมใช้"),
      prompt: t("ช่วยเขียนฟังก์ชัน TypeScript สำหรับเรียก API พร้อมจัดการ error ให้หน่อย"),
    },
    {
      icon: "fa-pen",
      title: t("ร่างข้อความ"),
      desc: t("อีเมล ประกาศ หรือโพสต์โทนมืออาชีพ"),
      prompt: t("ช่วยร่างอีเมลตอบลูกค้าที่แจ้งปัญหาการใช้งาน ให้สุภาพและกระชับ"),
    },
  ];

  return (
    <div ref={shellRef} className="flex h-dvh w-full overflow-hidden bg-ink-950">
      {/* Sidebar (desktop) */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-white/[0.07] bg-ink-900 transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[4.5rem]" : "w-72"
        }`}
      >
        {asideBody}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} aria-hidden />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("เมนูแชทและประวัติ")}
            tabIndex={-1}
            className="animate-drawer-in absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col border-r border-white/[0.07] bg-ink-900 outline-none pt-[env(safe-area-inset-top)]"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label={t("ปิดเมนู")}
              className="touch-min-icon absolute right-3 top-[calc(0.75rem_+_env(safe-area-inset-top))] z-10 rounded-md p-1.5 text-fg-subtle transition hover:text-fg"
            >
              <Icon name="fa-xmark" />
            </button>
            {asideBody}
          </aside>
        </div>
      )}

      {/* Chat area */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("เปิดเมนู")}
            className="touch-min-icon flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition hover:bg-white/[0.08] hover:text-fg lg:hidden"
          >
            <Icon name="fa-bars" />
          </button>
          <span className="flex-1" aria-hidden="true" />
          <Menu
            label={t("ตัวเลือกแชท")}
            items={[
              {
                icon: "fa-pen",
                label: t("แก้ชื่อแชท"),
                disabled: !activeId,
                onClick: () => activeId && startRename(activeId, activeTitle),
              },
              {
                icon: "fa-trash",
                label: t("ลบแชท"),
                tone: "danger",
                disabled: !activeId,
                onClick: () => activeId && deleteConversation(activeId),
              },
            ]}
          />
        </header>

        {/* Messages — เนื้อความอยู่ในกรอบเดียวกับกล่องพิมพ์: กันแถบเลื่อนกินพื้นที่ข้างเดียว (both-edges)
            ปุ่ม "ลงล่าง" อยู่ในกรอบนี้ ไม่ใช่ในกรอบแชท → composer สูงแค่ไหนก็ไม่ทับกัน */}
        <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          role="log"
          aria-label={t("บทสนทนา")}
          aria-busy={loading}
          className={`h-full space-y-4 overflow-y-auto overflow-x-clip px-3 py-6 sm:px-6 sm:[scrollbar-gutter:stable_both-edges] ${
            messages.length === 0 ? "flex items-center" : ""
          }`}
        >
          {messages.length === 0 && switchingId && (
            <div className="mx-auto flex items-center gap-2 text-caption text-fg-subtle" role="status">
              <Icon name="fa-circle-notch" className="animate-spin" />
              {t("กำลังโหลด...")}
            </div>
          )}
          {messages.length === 0 && !switchingId && (
            // ห้องว่าง: โลโก้ + คำทัก + ตัวอย่างงานที่กดเติมในช่องพิมพ์ได้ทันที
            // (อยู่กึ่งกลางพื้นที่ที่เหลือ ไม่เกาะขอบบนจนดูเหมือนหน้าพัง)
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
              <Logo size={48} className="mb-4" />
              {models.length === 0 ? (
                <>
                  <p className="text-body-sm text-fg-muted">{t("ยังไม่มีโมเดลที่เปิดให้ใช้")}</p>
                  <p className="mt-1.5 text-caption text-fg-subtle">
                    {t("แอดมินต้องเปิดโมเดลให้ผู้ใช้เห็นก่อน จึงจะเริ่มแชทได้")}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-h3 font-semibold tracking-tight text-fg">
                    {t("มีอะไรให้ช่วย?")}
                  </h1>
                  <p className="mt-1.5 max-w-md text-body-sm leading-relaxed text-fg-muted">
                    {t("ถาม ตัดโค้ด ค้นเว็บ หรือให้เอเจนต์ช่วยแก้ไฟล์ในเครื่อง — แนบไฟล์และรูปได้เลย")}
                  </p>
                  <div className="mt-6 grid w-full grid-cols-2 gap-2">
                    {quickStarts.map((s) => (
                      <button
                        key={s.title}
                        type="button"
                        onClick={() => {
                          setInput(s.prompt);
                          requestAnimationFrame(() => inputRef.current?.focus());
                        }}
                        className="group flex flex-col gap-1 rounded-xl bg-white/[0.03] p-3 text-left ring-1 ring-white/[0.06] transition hover:bg-white/[0.06] hover:ring-white/[0.12] active:scale-[0.99]"
                      >
                        <span className="flex items-center gap-2 text-caption font-medium text-fg">
                          <Icon name={s.icon} className="text-brand-300" />
                          <span className="min-w-0 truncate">{s.title}</span>
                        </span>
                        <span className="text-label leading-relaxed text-fg-subtle">{s.desc}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {messages.map((m, mi) => {
            const streaming = m.id === "streaming";
            const isLastUser = m.role === "user" && mi === lastUserIndex;
            const isLastAssistant =
              m.role === "assistant" && mi === messages.length - 1 && !streaming;
            const showActions =
              Boolean(m.content) || Boolean(m.error) || (isLastAssistant && lastUserIndex >= 0);
            return (
              <div
                key={m.id}
                className={`mx-auto flex w-full max-w-4xl ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {/* chat-row = กรอบที่ปุ่มคัดลอก/แก้ไขจะโผล่เมื่อชี้ (ดู .msg-actions ใน globals.css)
                    ฝั่ง assistant กระจายเต็มคอลัมน์ เพื่อให้กล่องโค้ด/กล่องกำลังคิดไม่หดเหลือเท่าความยาวบรรทัดสั้นสุด */}
                <div
                  className={`chat-row flex min-w-0 max-w-full flex-col ${
                    m.role === "user" ? "items-end" : "w-full items-start"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-label text-fg-subtle">
                      <span aria-hidden>
                        <Logo size={16} />
                      </span>
                      <span className="font-medium text-fg-muted">OctopusAI</span>
                      {m.stopped && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-1.5 py-0.5 text-micro">
                          <Icon name="fa-stop" size={9} />
                          {t("หยุดแล้ว")}
                        </span>
                      )}
                    </div>
                  )}
                  {/* ฝั่ง assistant ไม่มีพื้นหลังข้อความ (อ่านบนพื้นเว็บตรง ๆ) — ฝั่ง user ยังเป็นฟอง */}
                  <div
                    className={`max-w-full break-words text-body-sm [overflow-wrap:anywhere] ${
                      m.role === "user"
                        ? "rounded-2xl bg-brand-500/20 px-4 py-3 text-fg"
                        : "w-full px-0.5 py-1 leading-relaxed text-fg"
                    }`}
                  >
                    {m.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {m.attachments.map((a, j) => (
                          <div key={j} className="overflow-hidden rounded-md border border-white/[0.07]">
                            {a.mime.startsWith("image/") ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.dataUrl} alt={a.name} className="max-h-40 max-w-full object-cover" />
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-2 text-caption">
                                <Icon name="fa-file" />
                                <span className="max-w-[12rem] truncate">{a.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* กล่องความคิดอยู่เหนือคำตอบ (แบบ Claude) — ระหว่างทำงานกางไว้ พอคำตอบไหลค่อยพับ */}
                    {m.role === "assistant" && (
                      <ThinkingPanel
                        running={streaming && loading}
                        notes={streaming ? notes : (m.notes ?? [])}
                        steps={streaming ? steps : (m.steps ?? [])}
                        startedAt={streaming ? (runStartedAt ?? undefined) : undefined}
                        durationMs={streaming ? undefined : m.thinkingMs}
                        hasText={m.content.length > 0}
                      />
                    )}
                    {m.content && (
                      <MessageBody
                        text={m.content}
                        live={streaming}
                        onShare={m.role === "assistant" ? shareArtifact : undefined}
                      />
                    )}
                    {m.error && (
                      <div
                        role="alert"
                        className="mt-2 flex items-start gap-2 rounded-xl bg-rose-500/10 px-3 py-2.5 text-caption leading-relaxed text-rose-200 ring-1 ring-rose-500/20"
                      >
                        <Icon name="fa-circle-exclamation" className="mt-0.5 shrink-0" />
                        <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                          <span className="font-medium">{t("เกิดข้อผิดพลาด")}: </span>
                          {m.error}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* ปุ่มอยู่ใต้ฟอง นอกข้อความ — เล็กและโผล่เฉพาะตอนชี้ */}
                  {showActions && (
                    <div className="msg-actions mt-1 flex items-center gap-1.5">
                      {m.content && (
                        <button
                          type="button"
                          onClick={() => copyMessage(m)}
                          title={copiedId === m.id ? t("คัดลอกแล้ว") : t("คัดลอกข้อความ")}
                          aria-label={t("คัดลอกข้อความ")}
                          className="touch-min-icon inline-flex h-7 w-7 items-center justify-center rounded-md text-label text-fg-subtle transition hover:bg-white/[0.07] hover:text-fg"
                        >
                          <Icon
                            name={copiedId === m.id ? "fa-check" : "fa-copy"}
                            className={copiedId === m.id ? "text-leaf" : ""}
                          />
                        </button>
                      )}
                      {isLastUser && !loading && (
                        <button
                          type="button"
                          onClick={() => startEdit(m, mi)}
                          title={t("แก้ข้อความนี้แล้วส่งใหม่")}
                          aria-label={t("แก้ข้อความนี้แล้วส่งใหม่")}
                          className="touch-min-icon inline-flex h-7 w-7 items-center justify-center rounded-md text-label text-fg-subtle transition hover:bg-white/[0.07] hover:text-fg"
                        >
                          <Icon name="fa-pen" />
                        </button>
                      )}
                      {isLastAssistant && !loading && lastUserIndex >= 0 && (
                        <button
                          type="button"
                          onClick={retryLast}
                          title={t("สร้างคำตอบใหม่")}
                          aria-label={t("สร้างคำตอบใหม่")}
                          className="touch-min-icon inline-flex h-7 w-7 items-center justify-center rounded-md text-label text-fg-subtle transition hover:bg-white/[0.07] hover:text-fg"
                        >
                          <Icon name="fa-rotate" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ผู้ใช้เลื่อนขึ้นอ่านแล้วคำตอบไหลต่อ → ให้มีทางลงแบบไม่ต้องลากนิ้วกลับ */}
        {!atBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={jumpToBottom}
            aria-label={t("เลื่อนลงข้อความล่าสุด")}
            className="touch-min-icon absolute bottom-4 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-ink-850 text-fg shadow-floating ring-1 ring-white/[0.10] transition hover:bg-ink-800 active:scale-95"
          >
            <Icon name="fa-chevron-down" className="text-label" />
          </button>
        )}
        </div>

        {/* Composer — การ์ดลอยไม่ติดขอบ มีไฟล์แนบ ปุ่มแนบไฟล์ ตัวเลือกโมเดล และปุ่มส่งอยู่ในกรอบเดียว
            safe-bottom = 1rem + env(safe-area-inset-bottom): ปลายนิ้วกดส่งต้องไม่ชน gesture bar
            (ห้ามใส่ pb-* ซ้ำบนธาตุนี้ utility จะทับคลาส) */}
        <div className="safe-bottom relative shrink-0 px-3 pt-2 sm:px-6">
          {/* ข้อความที่เลื่อนมาจากด้านบนจะได้จางลงก่อนชนการ์ด ไม่ใช่ตัดเป็นเส้นแข็ง */}
          <div
            className="pointer-events-none absolute inset-x-0 -top-12 h-12 bg-gradient-to-b from-transparent to-ink-950"
            aria-hidden
          />
          {notice && (
            <div
              role="status"
              className="mx-auto mb-2 flex max-w-4xl items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-caption text-amber-300"
            >
              <Icon name="fa-triangle-exclamation" className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{notice}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label={t("ปิดการแจ้งเตือน")}
                className="touch-min-icon -mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-amber-300/80 transition hover:bg-white/[0.08] hover:text-amber-200"
              >
                <Icon name="fa-xmark" className="text-micro" />
              </button>
            </div>
          )}

          {/* กรอบเดียวเท่านั้น: ring ของการ์ด — textarea ห้ามใส่ ring ของตัวเอง
              เพราะ global :focus-visible ของฟอร์มจะวาดกรอบซ้ําข้างในดูรก */}
          <div className="mx-auto w-full max-w-4xl rounded-2xl bg-ink-900 p-2 shadow-floating ring-1 ring-white/[0.08] transition focus-within:ring-white/[0.16]">
            {attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-1 pb-1.5 pt-0.5">
                {attachments.map((a, i) => (
                  <div key={i} className="relative overflow-hidden rounded-md border border-white/[0.07] bg-white/[0.04]">
                    {a.mime.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.dataUrl} alt={a.name} className="h-14 w-14 object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center text-micro text-fg-muted">
                        <Icon name="fa-file" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                      className="touch-min-icon group/remove absolute right-0 top-0 flex h-6 w-6 items-start justify-end rounded-bl-md text-micro text-fg"
                      aria-label={t("ลบไฟล์")}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-bl-md bg-black/60 transition group-hover/remove:bg-black/80">
                        <Icon name="fa-xmark" />
                      </span>
                    </button>
                  </div>
                ))}
                <span className="text-micro text-fg-subtle">
                  {t("{n}/{max} ไฟล์", { n: attachments.length, max: maxAttachments })}
                </span>
              </div>
            )}
            {editingIndex !== null && (
              <div className="mb-1 flex items-center gap-2 rounded-lg bg-brand-500/10 px-2.5 py-1.5 text-label text-brand-200">
                <Icon name="fa-pen" className="shrink-0 text-micro" />
                <span className="min-w-0 flex-1 truncate">
                  {t("กำลังแก้ข้อความนี้ — กดส่งเพื่อถามใหม่ คำตอบหลังจากนี้จะถูกลบ")}
                </span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  title={t("ยกเลิกการแก้")}
                  aria-label={t("ยกเลิกการแก้")}
                  className="touch-min-icon flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-200 transition hover:bg-white/[0.10] hover:text-fg"
                >
                  <Icon name="fa-xmark" className="text-micro" />
                </button>
              </div>
            )}
            <label className="sr-only" htmlFor="agent-input">
              {t("พิมพ์ข้อความ")}
            </label>
            <textarea
              id="agent-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={onPaste}
              onKeyDown={onKeyDown}
              rows={2}
              disabled={models.length === 0}
              placeholder={
                models.length === 0
                  ? t("ยังไม่มีโมเดลที่เปิดให้ใช้")
                  : editingIndex !== null
                    ? t("แก้ข้อความแล้วกดส่ง")
                    : t("ถามได้เลย")
              }
              className="block max-h-44 min-h-[3.25rem] w-full resize-none break-words bg-transparent px-2.5 py-2 text-body-sm leading-relaxed text-fg outline-none [overflow-wrap:anywhere] placeholder:text-fg-subtle focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <div className="mt-1 flex flex-wrap items-center gap-1.5 px-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={models.length === 0 || remaining === 0}
                title={t("แนบไฟล์ (สูงสุด {n})", { n: maxAttachments })}
                aria-label={t("แนบไฟล์")}
                className="touch-min-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-muted transition hover:bg-white/[0.08] hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="fa-plus" />
              </button>

              {/* มือถือโชว์เฉพาะไอคอน: ชิป "เลือกโฟลเดอร์งาน" ทำให้แถวนี้ตกบรรทัด
                  กลายเป็นสามแถวซ้อนกันจนกดไม่ถูกว่าอันไหนส่งข้อความ */}
              <div className="min-w-0 flex-1">
                <ModelPicker models={models} value={model} onChange={setModel} />
              </div>

              <div className="flex sm:hidden">{toolsBar(true)}</div>
              <div className="hidden sm:flex">{toolsBar(false)}</div>

              <button
                type="button"
                onClick={loading ? stopRun : () => send()}
                disabled={!loading && (models.length === 0 || (!input.trim() && attachments.length === 0))}
                aria-label={loading ? t("หยุด") : t("ส่งข้อความ")}
                title={loading ? t("หยุด") : t("ส่ง")}
                className="touch-min-icon ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-fg transition hover:bg-brand-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-fg-subtle"
              >
                {loading ? (
                  <Icon name="fa-stop" />
                ) : (
                  <Icon name="fa-arrow-up" />
                )}
              </button>
            </div>
          </div>

          <div className="mx-auto mt-2 flex max-w-4xl items-center justify-center text-center text-micro text-fg-subtle">
            <span>{t("OctopusAI อาจทําผิดพลาดได้ โปรดตรวจสอบข้อมูลสําคัญอีกครั้ง")}</span>
          </div>
          {!chatReady && (
            <p className="mt-1 text-center text-micro text-fg-subtle">
              {t("ยังเชื่อม CHAT_DATABASE_URL ไม่ได้ — ประวัติแชทจะไม่ถูกบันทึก")}
            </p>
          )}
        </div>
      </div>

      {/* คลังไฟล์ — slide-over ด้านขวา */}
      {filesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setFilesOpen(false)}
            aria-hidden
          />
          <aside className="animate-fade-in relative flex h-full w-full max-w-md flex-col border-l border-white/[0.07] bg-ink-900">
            <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-4">
              <Icon name="fa-folder-open" className="text-brand-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-semibold text-fg">{t("คลังไฟล์")}</p>
                <p className="truncate text-micro text-fg-subtle">
                  {t("ไฟล์ที่ AI สร้างให้ในแชทของคุณ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilesOpen(false)}
                aria-label={t("ปิดเมนู")}
                className="touch-min-icon rounded-md p-1.5 text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg"
              >
                <Icon name="fa-xmark" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {filesNotice && (
                <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-caption text-amber-300">
                  <Icon name="fa-triangle-exclamation" className="mr-1.5" />
                  {filesNotice}
                </p>
              )}
              {filesLoading ? (
                <p className="px-2 py-10 text-center text-caption text-fg-subtle">
                  <Icon name="fa-circle-notch" className="mr-2 animate-spin" />
                  {t("กำลังโหลด...")}
                </p>
              ) : files.length === 0 ? (
                <p className="px-2 py-10 text-center text-caption text-fg-subtle">
                  {t("ยังไม่มีไฟล์ — ลองให้ AI สร้างหน้า HTML หรือ artifact ในแชท")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {files.map((f) => {
                    const shareAlive =
                      Boolean(f.shareUrl) &&
                      Boolean(f.shareExpiresAt) &&
                      new Date(f.shareExpiresAt!).getTime() > Date.now();
                    return (
                      <li
                        key={f.id}
                        className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-300">
                            <Icon name={f.kind === "html" ? "fa-code" : "fa-file"} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-caption font-medium text-fg">{f.name}</p>
                            <p className="mt-0.5 text-micro text-fg-subtle">
                              {f.createdAt.slice(0, 10)} · {(f.sizeBytes / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => downloadFile(f)}
                            title={t("ดาวน์โหลด")}
                            className="rounded-md p-1.5 text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg"
                          >
                            <Icon name="fa-download" />
                          </button>
                        </div>

                        {shareAlive ? (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-2.5">
                            <a
                              href={f.shareUrl!}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost !py-1.5 text-label"
                            >
                              <Icon name="fa-arrow-up-right-from-square" className="text-micro" />{" "}
                              {t("เปิดลิงก์")}
                            </a>
                            <button
                              type="button"
                              onClick={() => copyShare(f.shareUrl!)}
                              className="btn-ghost !py-1.5 text-label"
                            >
                              <Icon name="fa-copy" className="text-micro" /> {t("คัดลอกลิงก์")}
                            </button>
                            <span className="ml-auto text-micro text-fg-subtle">
                              {t("ลิงก์สาธารณะถึง {date}", {
                                date: f.shareExpiresAt!.slice(0, 10),
                              })}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2.5 border-t border-white/[0.07] pt-2.5">
                            <button
                              type="button"
                              onClick={() => shareFile(f.id)}
                              disabled={sharingId === f.id}
                              className="btn-secondary !py-1.5 text-label disabled:opacity-50"
                            >
                              <Icon
                                name={
                                  sharingId === f.id
                                    ? "fa-circle-notch animate-spin"
                                    : "fa-share-nodes"
                                }
                                className="text-micro"
                              />{" "}
                              {t("แชร์เป็นลิงก์สาธารณะ")}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* กล่องแก้ชื่อแชท */}
      <Dialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title={t("แก้ชื่อแชท")}
        description={t("ตั้งชื่อที่หาเจอง่ายในประวัติแชท")}
        icon="fa-pen"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-quiet" onClick={() => setRenaming(null)}>
              {t("ยกเลิก")}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={renameBusy || !renameValue.trim()}
              onClick={confirmRename}
            >
              {renameBusy && <Icon name="fa-circle-notch" className="animate-spin" />}
              {t("บันทึก")}
            </button>
          </>
        }
      >
        <input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmRename();
          }}
          maxLength={80}
          placeholder={t("ชื่อแชท")}
          aria-label={t("ชื่อแชท")}
          className="input"
        />
      </Dialog>

      {/* ยืนยันลบแชท — แทน confirm() ของเบราว์เซอร์ */}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t("ลบแชทนี้?")}
        message={t("ข้อความและไฟล์ในแชทนี้จะหายไปจากประวัติของคุณ")}
        confirmLabel={t("ลบแชท")}
        cancelLabel={t("ยกเลิก")}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {/* ขออนุญาตก่อนแตะไฟล์ในเครื่องผู้ใช้ — โมเดลเขียน/ลบเองเงียบ ๆ ไม่ได้ */}
      <ToolApprovalDialog action={pending} onDecision={decide} />
    </div>
  );
}
