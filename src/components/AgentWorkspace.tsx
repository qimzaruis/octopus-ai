"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  state: "running" | "done" | "error";
};

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: ChatAttachment[];
  steps?: ToolStep[];
  /** สิ่งที่โมเดลบอกก่อนเรียกเครื่องมือแต่ละรอบ (แสดงในกล่อง "กำลังคิด") */
  notes?: string[];
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
}: {
  running: boolean;
  notes: string[];
  steps: ToolStep[];
}) {
  const t = useT();
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? running;
  if (notes.length === 0 && steps.length === 0) return null;
  return (
    <div className="mt-2 overflow-hidden rounded-lg bg-ink-950/40 ring-1 ring-white/[0.06]">
      <button
        type="button"
        onClick={() => setManual(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-micro text-fg-subtle transition hover:text-fg"
      >
        <Icon
          name={running ? "fa-circle-notch" : "fa-lightbulb"}
          className={running ? "animate-spin" : "text-amber-glow"}
        />
        <span>{running ? t("กำลังคิด...") : t("ขั้นตอนการทำงาน")}</span>
        <Icon
          name={open ? "fa-chevron-up" : "fa-chevron-down"}
          className="ml-auto shrink-0"
        />
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-white/[0.06] px-2.5 py-2">
          {notes.map((note, i) => (
            <p key={`note-${i}`} className="whitespace-pre-wrap text-micro leading-relaxed text-fg-subtle">
              {note}
            </p>
          ))}
          {steps.map((s) => (
            <p key={s.id} className="flex items-center gap-2 text-micro text-fg-subtle">
              <Icon
                name={
                  s.state === "running"
                    ? "fa-circle-notch"
                    : s.state === "error"
                      ? "fa-circle-xmark"
                      : "fa-circle-check"
                }
                className={`shrink-0 ${
                  s.state === "running"
                    ? "animate-spin"
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
}) {
  const t = useT();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ChatConversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(conversationId);
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages ?? []);
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
  /** คำถามที่กำลังแก้: index = ตำแหน่งข้อความในห้อง, attachments = ไฟล์เดิมของมัน */
  const [editing, setEditing] = useState<{
    index: number;
    value: string;
    attachments: ChatAttachment[];
  } | null>(null);

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
  const scrollRef = useRef<HTMLDivElement>(null);

  // เปลี่ยนห้องจากลิงก์ /c/<id> — React ใช้ component เดิมต่อ จึงต้อง sync state กับ props
  useEffect(() => {
    setActiveId(conversationId);
    setMessages(initialMessages ?? []);
    if (initialModel && models.some((m) => m.id === initialModel)) setModel(initialModel);
    setInput("");
    setAttachments([]);
    setNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // อ่านสถานะย่อ/ขยาย sidebar จาก localStorage (ครั้งแรก)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const remaining = Math.max(0, maxAttachments - attachments.length);

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setAttachments([]);
    setNotice(null);
    setDrawerOpen(false);
    // replaceState ไม่ทำให้ page component รีเมานต์ → ข้อความที่พิมพ์ไว้ไม่หาย
    if (pathname !== "/agent") window.history.replaceState(null, "", "/agent");
  }

  /** ขอยืนยันผ่าน Dialog ก่อนลบ (ไม่ใช้ confirm() ของเบราว์เซอร์) */
  function deleteConversation(id: string) {
    setDrawerOpen(false);
    setPendingDelete(id);
  }

  async function confirmDelete() {
    const id = pendingDelete;
    if (!id) return;
    setDeleting(true);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) startNewChat();
    try {
      const res = await fetch(`/api/agent/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setPendingDelete(null);
    } catch {
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
      URL.revokeObjectURL(url);
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
      slots.push(await fileToAttachment(f));
    }
    setAttachments((prev) => [...prev, ...slots].slice(0, maxAttachments));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function ensureConversation(): Promise<string | null> {
    try {
      const res = await fetch("/api/agent/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { conversation: ChatConversation };
      setConversations((prev) => [data.conversation, ...prev]);
      setActiveId(data.conversation.id);
      // ให้ URL เป็น /c/<uuid> ทันทีที่ห้องถูกสร้าง (รีเฟรชแล้วยังกลับเข้ามาเจอ)
      window.history.replaceState(null, "", `/c/${data.conversation.id}`);
      return data.conversation.id;
    } catch {
      setNotice(t("เริ่มแชทไม่สำเร็จ ลองอีกครั้ง"));
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
    setMessages((prev) => {
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
    signal?: AbortSignal,
  ): Promise<{ text: string; calls: AgentToolCall[] }> {
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut = buffer.indexOf("\n");
      while (cut >= 0) {
        const line = buffer.slice(0, cut).trim();
        buffer = buffer.slice(cut + 1);
        cut = buffer.indexOf("\n");
        if (!line) continue;
        let event: { t?: string; v?: unknown; text?: string; fr?: string };
        try {
          event = JSON.parse(line) as typeof event;
        } catch {
          continue;
        }
        if (event.fr === "length") {
          setNotice(t("คำตอบถูกตัดเพราะยาวเกินจำกัด — ให้เอเจนต์เขียนต่อเป็นท่อน ๆ ได้"));
        }
        if (event.t === "d") {
          text += String(event.v ?? "");
          setStreamingText(text);
          scrollToBottom();
        } else if (event.t === "tool") {
          calls = (event.v as AgentToolCall[]) ?? [];
          if (typeof event.text === "string") text = event.text;
        } else if (event.t === "notice") {
          setNotice(String(event.v ?? ""));
        }
      }
    }
    return { text, calls };
  }

  /**
   * วนลูปแบบเอเจนต์: โมเดลขอเครื่องมือ → เบราว์เซอร์ของผู้ใช้รัน → ส่งผลกลับ → โมเดลทำต่อ
   *
   * ข้อความผู้ใช้ถูกบันทึกครั้งเดียวในรอบแรก และบันทึกคำตอบตอนรอบสุดท้ายที่ไม่มี
   * tool_calls — รอบกลางทาง (ข้อความเครื่องมือ) เป็นของชั่วคราวในเครื่องผู้ใช้เท่านั้น
   */
  async function send(override?: { text: string; attachments: ChatAttachment[] }) {
    const question = (override?.text ?? input).trim();
    const files = override?.attachments ?? attachments;
    if (loading) return;
    if (!question && files.length === 0) return;
    if (models.length === 0) return;

    const userMsg: UiMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: question,
      attachments: files,
    };
    const sentAttachments = files;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: "streaming", role: "assistant", content: "", attachments: [] },
    ]);
    setInput("");
    setAttachments([]);
    setNotice(null);
    setLoading(true);
    const collected: ToolStep[] = [];
    const notesLog: string[] = [];
    setSteps(collected);
    setNotes(notesLog);
    const controller = new AbortController();
    abortRef.current = controller;
    scrollToBottom();

    let convId = activeId;
    if (!convId) {
      convId = await ensureConversation();
      if (!convId) {
        setLoading(false);
        setMessages((prev) => prev.filter((m) => m.id !== "streaming"));
        return;
      }
    }

    // หลังรีเฟรชเบราว์เซอร์จะลดสิทธิ์โฟลเดอร์ลง ต้องขอใหม่ก่อนแตะไฟล์จริง
    if (workspace && !(await grantWorkspaceAccess(workspace, "readwrite"))) {
      setNotice(t("ยังไม่มีสิทธิ์เข้าถึงโฟลเดอร์งาน — เอเจนต์จะอ่านและแก้ไฟล์ไม่ได้"));
    }

    const runMessages: AgentChatMessage[] = [];
    let answer = "";
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        const ctx: ToolContext = {
          workspace,
          autoWrite,
          approve,
          notify: (message) => setNotice(message),
        };
        const tools = toolDefinitions(ctx);
        const { text, calls } = await streamRound(convId, {
          content: round === 0 ? question : "",
          attachments: round === 0 ? sentAttachments : [],
          messages: runMessages,
          tools,
          toolNames: tools.map((tool) => tool.function.name),
          workspaceReady: Boolean(workspace),
        }, controller.signal);
        answer = text;
        if (calls.length === 0) break;

        // สิ่งที่โมเดลพิมพ์ก่อนเรียกเครื่องมือ คือ "ความคิด" ที่ผู้ใช้อยากเห็น
        if (text.trim()) {
          notesLog.push(text.trim());
          setNotes([...notesLog]);
        }
        runMessages.push({ role: "assistant", content: text, tool_calls: calls });
        for (const call of calls) {
          const step: ToolStep = { id: `${round}-${call.id}`, label: stepLabel(call), state: "running" };
          collected.push(step);
          setSteps([...collected]);
          scrollToBottom();
          const result = await runTool(call.function.name, call.function.arguments, ctx);
          step.state = /"ok"\s*:\s*false/.test(result) ? "error" : "done";
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

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: answer || t("เอเจนต์ไม่ได้ตอบกลับมา"),
          attachments: [],
          steps: collected.length ? collected : undefined,
          notes: notesLog.length ? [...notesLog] : undefined,
        };
        return copy;
      });
    } catch (err) {
      const stopped = err instanceof DOMException && err.name === "AbortError";
      const msg = stopped ? "" : err instanceof Error ? err.message : String(err);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          id: stopped ? `a-${Date.now()}` : "streaming",
          role: "assistant",
          content: stopped
            ? answer || t("หยุดแล้ว")
            : `${t("เกิดข้อผิดพลาด")}: ${msg}`,
          attachments: [],
          steps: collected.length ? collected : undefined,
          notes: notesLog.length ? [...notesLog] : undefined,
        };
        return copy;
      });
    } finally {
      abortRef.current = null;
      setLoading(false);
      setSteps([]);
      setNotes([]);
    }
  }

  function stopRun() {
    abortRef.current?.abort();
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

  /**
   * แก้คำถามล่าสุดแล้วส่งใหม่ — ต้องเล็มประวัติทั้งใน DB และบนจอ
   * มิฉะนั้นโมเดลจะยังเห็นคำถามเก่าที่ผู้ใช้แก้ทิ้งไปแล้ว
   */
  async function applyEdit() {
    if (!editing || !activeId) return;
    const { index, value, attachments: oldFiles } = editing;
    setEditing(null);
    setMessages((prev) => prev.slice(0, index));
    try {
      await fetch(`/api/agent/conversations/${activeId}/trim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: index }),
      });
    } catch {
      setNotice(t("เล็มประวัติไม่สำเร็จ แต่จะส่งข้อความที่แก้ใหม่ไปแทน"));
    }
    await send({ text: value, attachments: oldFiles });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) send();
    }
  }

  const historyList = useMemo(
    () =>
      conversations.map((c) => (
        <li key={c.id} className="group/item relative">
          <Link
            href={`/c/${c.id}`}
            title={titleOf(c)}
            onClick={() => setDrawerOpen(false)}
            className={`block truncate rounded-md py-2 pl-3 pr-10 text-left text-caption transition-colors ${
              activeId === c.id
                ? "bg-white/[0.10] text-fg"
                : "text-fg-muted hover:bg-white/[0.06] hover:text-fg"
            }`}
          >
            {titleOf(c)}
          </Link>
          <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/item:opacity-100 focus-within:opacity-100">
            <Menu
              label={t("ตัวเลือกแชท")}
              widthPx={176}
              placement="right"
              triggerClassName="h-7 w-7 bg-ink-950/40"
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
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversations, activeId],
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
            {/* ปุ่มย่ออยู่ใน sidebar ฝั่งขวา ตามที่ผู้ใช้ขอ */}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label={t("ย่อแถบข้าง")}
              title={t("ย่อแถบข้าง")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition hover:bg-white/[0.08] hover:text-fg"
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
          className={`flex w-full items-center gap-2.5 rounded-lg bg-brand-500/90 px-3 py-2.5 text-caption font-semibold text-fg transition hover:bg-brand-500 ${
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
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-caption font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-wand-magic-sparkles" className="h-4 w-4 shrink-0 text-brand-300" />
          {!collapsed && <span>{t("สร้างรูป")}</span>}
        </Link>
        <button
          type="button"
          onClick={() => {
            setFilesOpen(true);
            setDrawerOpen(false);
          }}
          title={t("คลังไฟล์")}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-caption font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Icon name="fa-folder-open" className="h-4 w-4 shrink-0 text-aqua" />
          {!collapsed && <span>{t("คลังไฟล์")}</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <p className="px-4 pb-2 text-micro font-semibold uppercase tracking-[0.16em] text-fg-subtle">
            {t("ประวัติแชท")}
          </p>
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {conversations.length === 0 ? (
              <p className="px-3 py-2 text-label text-fg-subtle">{t("ยังไม่มีประวัติแชท")}</p>
            ) : (
              <ul className="space-y-0.5">{historyList}</ul>
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
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-caption text-fg-muted transition hover:bg-white/[0.06] hover:text-fg ${
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

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-ink-950">
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
          <aside className="animate-fade-in absolute inset-y-0 left-0 flex w-72 flex-col border-r border-white/[0.07] bg-ink-900">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label={t("ปิดเมนู")}
              className="absolute right-3 top-4 z-10 rounded-md p-1.5 text-fg-subtle transition hover:text-fg"
            >
              <Icon name="fa-xmark" />
            </button>
            {asideBody}
          </aside>
        </div>
      )}

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("เปิดเมนู")}
            className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition hover:bg-white/[0.08] hover:text-fg lg:hidden"
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

        {/* Messages — เนื้อความอยู่ในกรอบเดียวกับกล่องพิมพ์: กันแถบเลื่อนกินพื้นที่ข้างเดียว (both-edges) */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-clip px-3 py-6 [scrollbar-gutter:stable_both-edges] sm:px-6"
        >
          {messages.length === 0 && (
            <div className="mx-auto mt-16 max-w-md text-center">
              <Logo size={46} className="mx-auto mb-4" />
              <p className="text-body-sm text-fg-muted">
                {models.length === 0
                  ? t("ยังไม่มีโมเดลที่เปิดให้ใช้")
                  : t("เริ่มบทสนทนากับ OctopusAI ได้เลย")}
              </p>
              {models.length === 0 && (
                <p className="mt-1.5 text-caption text-fg-subtle">
                  {t("แอดมินต้องเปิดโมเดลให้ผู้ใช้เห็นก่อน จึงจะเริ่มแชทได้")}
                </p>
              )}
            </div>
          )}
          {messages.map((m, mi) => {
            const streaming = m.id === "streaming";
            const isLastUser = m.role === "user" && mi === lastUserIndex;
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
                  {m.content && <MessageBody text={m.content} live={streaming} />}
                  {streaming && loading && m.content === "" && notes.length === 0 && steps.length === 0 && (
                    <span className="inline-flex items-center gap-2 text-fg-subtle">
                      <Icon name="fa-circle-notch" className="animate-spin" />
                      {t("กำลังคิด...")}
                    </span>
                  )}
                  {streaming && <ThinkingPanel running notes={notes} steps={steps} />}
                  {!streaming && m.role === "assistant" && ((m.steps?.length ?? 0) > 0 || (m.notes?.length ?? 0) > 0) && (
                    <ThinkingPanel running={false} notes={m.notes ?? []} steps={m.steps ?? []} />
                  )}
                </div>
                {/* ปุ่มอยู่ใต้ฟอง นอกข้อความ — เล็กและโผล่เฉพาะตอนชี้ */}
                {m.content && (
                  <div className="msg-actions mt-1 flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => copyMessage(m)}
                      title={copiedId === m.id ? t("คัดลอกแล้ว") : t("คัดลอกข้อความ")}
                      aria-label={t("คัดลอกข้อความ")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-micro text-fg-subtle transition hover:bg-white/[0.07] hover:text-fg"
                    >
                      <Icon
                        name={copiedId === m.id ? "fa-check" : "fa-copy"}
                        className={copiedId === m.id ? "text-leaf" : ""}
                      />
                    </button>
                    {isLastUser && !loading && (
                      <button
                        type="button"
                        onClick={() => setEditing({ index: mi, value: m.content, attachments: m.attachments })}
                        title={t("แก้ข้อความนี้แล้วส่งใหม่")}
                        aria-label={t("แก้ข้อความนี้แล้วส่งใหม่")}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-micro text-fg-subtle transition hover:bg-white/[0.07] hover:text-fg"
                      >
                        <Icon name="fa-pen" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {/* Composer — การ์ดลอยไม่ติดขอบ มีไฟล์แนบ ปุ่มแนบไฟล์ ตัวเลือกโมเดล และปุ่มส่งอยู่ในกรอบเดียว */}
        <div className="relative shrink-0 px-3 pb-4 pt-2 sm:px-6">
          {/* ข้อความที่เลื่อนมาจากด้านบนจะได้จางลงก่อนชนการ์ด ไม่ใช่ตัดเป็นเส้นแข็ง */}
          <div
            className="pointer-events-none absolute inset-x-0 -top-12 h-12 bg-gradient-to-b from-transparent to-ink-950"
            aria-hidden
          />
          {notice && (
            <p className="mx-auto mb-2 max-w-4xl rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-caption text-amber-300">
              <Icon name="fa-triangle-exclamation" className="mr-1.5" />
              {notice}
            </p>
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
                      className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-md bg-black/60 text-micro text-fg hover:bg-black/80"
                      aria-label={t("ลบไฟล์")}
                    >
                      <Icon name="fa-xmark" />
                    </button>
                  </div>
                ))}
                <span className="text-micro text-fg-subtle">
                  {t("{n}/{max} ไฟล์", { n: attachments.length, max: maxAttachments })}
                </span>
              </div>
            )}
            <label className="sr-only" htmlFor="agent-input">
              {t("พิมพ์ข้อความ")}
            </label>
            <textarea
              id="agent-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              disabled={models.length === 0}
              placeholder={
                models.length === 0 ? t("ยังไม่มีโมเดลที่เปิดให้ใช้") : t("ถามได้เลย")
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-muted transition hover:bg-white/[0.08] hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="fa-plus" />
              </button>

              <ModelPicker models={models} value={model} onChange={setModel} />

              <AgentToolsBar
                workspaceName={workspace?.name ?? null}
                canPick={folderApi}
                autoWrite={autoWrite}
                onPick={chooseWorkspace}
                onDisconnect={dropWorkspace}
                onAutoWriteChange={toggleAutoWrite}
              />

              <button
                type="button"
                onClick={loading ? stopRun : () => send()}
                disabled={!loading && (models.length === 0 || (!input.trim() && attachments.length === 0))}
                aria-label={loading ? t("หยุด") : t("ส่งข้อความ")}
                title={loading ? t("หยุด") : t("ส่ง")}
                className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-fg transition hover:bg-brand-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-fg-subtle"
              >
                {loading ? (
                  <Icon name="fa-stop" />
                ) : (
                  <Icon name="fa-paper-plane" />
                )}
              </button>
            </div>
          </div>

          <p className="mx-auto mt-2 max-w-4xl text-center text-micro text-fg-subtle">
            {t("OctopusAI อาจทําผิดพลาดได้ โปรดตรวจสอบข้อมูลสําคัญอีกครั้ง")}
          </p>
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
              <Icon name="fa-folder-open" className="text-aqua" />
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
                className="rounded-md p-1.5 text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg"
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
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aqua/10 text-aqua">
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

      {/* แก้คำถามล่าสุดแล้วส่งใหม่ — ประวัติหลังข้อความนี้ถูกลบทั้งบนจอและในฐานข้อมูล */}
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={t("แก้ข้อความนี้")}
        description={t("คำตอบหลังจากข้อความนี้จะถูกลบออกจากประวัติแล้วถามใหม่")}
        icon="fa-pen"
        size="md"
        footer={
          <>
            <button type="button" className="btn-quiet" onClick={() => setEditing(null)}>
              {t("ยกเลิก")}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!editing?.value.trim()}
              onClick={applyEdit}
            >
              {t("ส่งใหม่")}
            </button>
          </>
        }
      >
        <textarea
          value={editing?.value ?? ""}
          onChange={(e) =>
            setEditing((prev) => (prev ? { ...prev, value: e.target.value } : prev))
          }
          rows={5}
          aria-label={t("แก้ข้อความ")}
          className="input resize-y leading-relaxed"
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
