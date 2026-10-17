"use client";

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

type Attachment = { name: string; type: string; dataUrl: string };

type Message = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

const MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4.1", label: "GPT-4.1" },
];

export default function PlaygroundChat() {
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [model, setModel] = useState(MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function fileToDataUrl(file: File): Promise<Attachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ name: file.name, type: file.type || "application/octet-stream", dataUrl: reader.result as string });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const arr: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) continue;
      arr.push(await fileToDataUrl(f));
    }
    setAttachments((prev) => [...prev, ...arr]);
  }

  async function send() {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    const userMsg: Message = { role: "user", content: text, attachments: attachments.length ? attachments : undefined };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setAttachments([]);
    setLoading(true);
    scrollToBottom();

    // placeholder assistant
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/playground/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, model }),
      });
      if (!res.ok || !res.body) {
        throw new Error(await res.text());
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
        scrollToBottom();
      }
    } catch (err: any) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `เกิดข้อผิดพลาด: ${err?.message || err}` };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) send();
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-xl bg-ink-900 shadow-raised">
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <i className="fa-solid fa-comments text-brand-300" />
          <span className="text-body-sm font-semibold text-fg">Playground</span>
        </div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-md bg-white/[0.06] px-2.5 py-1.5 text-caption text-fg-muted outline-none hover:bg-white/[0.09]"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-md text-center text-body-sm text-fg-muted">
            <i className="fa-solid fa-sparkles mb-3 text-2xl text-brand-300" />
            <p>เริ่มบทสนทนาได้เลย — รองรับการแนบไฟล์และรูปภาพ</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-body-sm ${
                m.role === "user"
                  ? "bg-brand-500/20 text-fg"
                  : "bg-white/[0.06] text-fg-muted"
              }`}
            >
              {m.attachments && m.attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {m.attachments.map((a, j) => (
                    <div key={j} className="overflow-hidden rounded-md border border-white/[0.07]">
                      {a.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.dataUrl} alt={a.name} className="max-h-40 max-w-full object-cover" />
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 text-caption">
                          <i className="fa-solid fa-file" />
                          <span className="truncate">{a.name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-white/[0.06] px-4 py-3 text-body-sm text-fg-muted">
              <i className="fa-solid fa-circle-notch animate-spin mr-2" />
              กำลังคิด...
            </div>
          </div>
        )}
      </div>

      {/* attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-white/[0.07] px-4 py-2">
          {attachments.map((a, i) => (
            <div key={i} className="relative overflow-hidden rounded-md border border-white/[0.07] bg-white/[0.04]">
              {a.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.dataUrl} alt={a.name} className="h-16 w-16 object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center text-micro text-fg-muted">
                  <i className="fa-solid fa-file" />
                </div>
              )}
              <button
                type="button"
                onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-md bg-black/60 text-micro text-fg hover:bg-black/80"
                aria-label="ลบไฟล์"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* input */}
      <div className="border-t border-white/[0.07] p-3">
        <div className="flex items-end gap-2">
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-fg-muted transition hover:bg-white/[0.11] hover:text-fg"
            aria-label="แนบไฟล์"
          >
            <i className="fa-solid fa-paperclip" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="พิมพ์ข้อความ... (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg bg-ink-950/60 px-3.5 py-2.5 text-body-sm text-fg ring-1 ring-inset ring-white/10 transition focus:outline-none focus:ring-2 focus:ring-brand-400/70"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || (!input.trim() && attachments.length === 0)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-fg transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="ส่ง"
          >
            <i className="fa-solid fa-paper-plane" />
          </button>
        </div>
      </div>
    </div>
  );
}