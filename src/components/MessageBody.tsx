"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useT } from "@/lib/i18n/client";

type Segment = {
  kind: "text" | "code";
  text: string;
  lang: string;
  name?: string;
};

/** ภาษาที่เปิดดูเป็นหน้าเว็บ/ภาพในแท็บใหม่ได้จากข้อความในแชท */
const VIEWABLE = new Set(["html", "htm", "svg", "xml", "xhtml"]);

/**
 * แยกข้อความของเอเจนต์เป็นส่วนธรรมดากับส่วนโค้ด (fenced ``` ... ```)
 *
 * รองรับกรณีโค้ดยังไม่ปิด fence ตอน stream มาถึงครึ่งตัว — มิฉะนั้นขณะที่โมเดล
 * พิมพ์อยู่ ข้อความจะกระโดดเป็นโค้ดทั้งก้อน
 */
export function splitSegments(content: string): Segment[] {
  const out: Segment[] = [];
  const re = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) {
    if (match[0].length === 0) break;
    if (match.index > cursor) {
      out.push({ kind: "text", text: content.slice(cursor, match.index), lang: "" });
    }
    const info = match[1].trim();
    const parts = info.split(/\s+/).filter(Boolean);
    const lang = (parts[0] ?? "").toLowerCase();
    const rest = parts.slice(1).join(" ").trim();
    const named = rest.match(/[\w./-]+\.[A-Za-z0-9]{1,6}/);
    out.push({
      kind: "code",
      text: match[2].replace(/\n$/, ""),
      lang,
      name: named ? named[0] : rest || undefined,
    });
    cursor = match.index + match[0].length;
    if (!match[0].endsWith("```")) break; // fence ยังไม่ปิด (กำลัง stream)
  }
  if (cursor < content.length) {
    out.push({ kind: "text", text: content.slice(cursor), lang: "" });
  }
  return out;
}

/**
 * เครื่องหมายในข้อความที่โมเดลส่งมา (**ตัวหนา**, `โค้ด`) — ไม่ใช่ markdown ทั้งชุด
 * เอาแค่สองแบบนี้ที่เห็นใช้จริงในแชท ส่วนอื่นปล่อยเป็นข้อความธรรมดา
 *
 * ตอน stream เครื่องหมายยังไม่ปิด (เช่น ** ที่ยังไม่มีตัวปิด) จะขึ้นเป็นข้อความธรรมดาก่อน
 * แล้วกลายเป็นตัวหนาเองเมื่อโมเดลพิมพ์จบ
 */
const INLINE_RE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

function InlineText({ text }: { text: string }) {
  const parts = text.split(INLINE_RE);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded bg-white/[0.09] px-1 py-px font-mono text-[0.9em] text-fg">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function CodeBlock({ segment, live }: { segment: Segment; live: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const code = segment.text;
  const file = segment.name ?? "";
  const viewable = VIEWABLE.has(segment.lang) || /\.(html?|svg|xml)$/i.test(file);

  // ตอนโมเดลพิมพ์โค้ดอยู่ ให้กล่องเลื่อนตามลงเรื่อย ๆ ไม่ค้างอยู่ด้านบน
  useEffect(() => {
    if (live && preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [code, live]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* เบราว์เซอร์ไม่อนุญาต clipboard (ไม่ใช่ https) — เงียบไว้ */
    }
  }

  /**
   * เปิดเป็นแท็บใหม่จาก blob ในเครื่องผู้ใช้ — ไม่ต้องอัปโหลด ไม่ต้องกดแชร์ก่อน
   *
   * ใช้ <a target="_blank"> ไม่ใช่ window.open(url, "_blank", "noopener")
   * เพราะ noopener ทำให้ getReturn เป็น null เสมอ ถ้าเช็คแล้วพาค้างอยู่
   * หน้าที่อยู่จะเด้งไป blob ตามไปด้วย (ผู้ใช้ไม่เอาแบบนั้น)
   */
  function openInNewTab() {
    const mime =
      segment.lang === "svg" || /\.svg$/i.test(file)
        ? "image/svg+xml"
        : segment.lang === "json"
          ? "application/json"
          : "text/html";
    const blob = new Blob([code], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // แท็บใหม่ถือ reference อยู่แล้ว จึงคืนหน่วยความจำทีหลังได้ปลอดภัย
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="my-2.5 overflow-hidden rounded-lg bg-ink-950/70 ring-1 ring-white/[0.08]">
      <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-micro uppercase tracking-wider text-fg-subtle">
          {file || segment.lang || "code"}
        </span>
        {viewable && (
          <button
            type="button"
            onClick={openInNewTab}
            title={t("เปิดดูในแท็บใหม่")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-micro text-fg-muted transition hover:bg-white/[0.08] hover:text-fg"
          >
            <Icon name="fa-arrow-up-right-from-square" />
            {t("เปิดดู")}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          title={t("คัดลอกโค้ด")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-micro text-fg-muted transition hover:bg-white/[0.08] hover:text-fg"
        >
          <Icon name={copied ? "fa-check" : "fa-copy"} className={copied ? "text-leaf" : ""} />
          {copied ? t("คัดลอกแล้ว") : t("คัดลอก")}
        </button>
      </div>
      {/* scroll ในกล่องโค้ดเท่านั้น ไม่ทำให้ทั้งแชทเลื่อนตาม */}
      <pre ref={preRef} className="max-h-[22rem] overflow-auto px-3.5 py-3 text-micro leading-relaxed">
        <code className="font-mono whitespace-pre text-fg-muted">{code}</code>
      </pre>
    </div>
  );
}

/**
 * ร่างข้อความในฟองแชท — ข้อความธรรมดา + กล่องโค้ดที่มีปุ่มคัดลอก/เปิดดู
 *
 * `live` = กำลัง stream อยู่ ให้กล่องโค้ดเลื่อนตามข้อความล่าสุดเอง
 */
export default function MessageBody({ text, live = false }: { text: string; live?: boolean }) {
  const segments = splitSegments(text);
  return (
    <div className="text-body-sm leading-relaxed">
      {segments.map((segment, i) =>
        segment.kind === "code" ? (
          <CodeBlock key={`code-${i}`} segment={segment} live={live} />
        ) : (
          <div key={`text-${i}`} className="whitespace-pre-wrap">
            <InlineText text={segment.text} />
          </div>
        ),
      )}
    </div>
  );
}
