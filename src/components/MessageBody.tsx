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

/** สิ่งที่ปุ่มแชร์ส่งให้เจ้าของแชทไว้ไปจับคู่กับไฟล์ในคลัง */
export type ShareRequest = { name: string; lang: string; bytes: number };

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
 * เครื่องหมายในข้อความที่โมเดลส่งมา — ตัวหนา, โค้ดในบรรทัด, ลิงก์ markdown และ URL ตรง ๆ
 *
 * ตอน stream เครื่องหมายยังไม่ปิด (เช่น ** ที่ยังไม่มีตัวปิด) จะขึ้นเป็นข้อความธรรมดาก่อน
 * แล้วกลายเป็นตัวหนาเองเมื่อโมเดลพิมพ์จบ เราไม่ใช้ dangerouslySetInnerHTML เลย
 * ทุกอย่างถูกประกอบเป็น React element จึงไม่มีทางเกิด XSS จากข้อความของโมเดล
 */
const INLINE_RE =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|https?:\/\/[^\s<>"'`]+)/g;
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

/** แยกเครื่องหมายวรรคตอนท้าย URL ออกจากตัวลิงก์ (เช่น "ดูที่ https://x.com." ) */
function splitUrlTail(url: string): [string, string] {
  const punct = url.match(/[.,;:!?]+$/);
  let core = punct ? url.slice(0, -punct[0].length) : url;
  let tail = punct ? punct[0] : "";
  while (core.endsWith(")")) {
    const open = (core.match(/\(/g) ?? []).length;
    const close = (core.match(/\)/g) ?? []).length;
    if (open >= close) break;
    core = core.slice(0, -1);
    tail = `)${tail}`;
  }
  return [core, tail];
}

function SafeLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!SAFE_HREF.test(href)) return <span>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="break-words text-brand-300 underline decoration-brand-300/40 underline-offset-2 transition hover:text-brand-200 hover:decoration-brand-300/70 [overflow-wrap:anywhere]"
    >
      {children}
    </a>
  );
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(INLINE_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={i} className="font-semibold text-fg">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code
              key={i}
              className="rounded bg-white/[0.09] px-1 py-px font-mono text-[0.9em] text-fg"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("[")) {
          const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (m) {
            return (
              <SafeLink key={i} href={m[2]}>
                {m[1]}
              </SafeLink>
            );
          }
        }
        if (part.startsWith("http://") || part.startsWith("https://")) {
          const [url, tail] = splitUrlTail(part);
          return (
            <span key={i}>
              <SafeLink href={url}>{url}</SafeLink>
              {tail}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** ---- บล็อก markdown แบบเบา: หัวข้อ, ลิสต์, quote, ตาราง, เส้นคั่น ---- */

type TableAlign = "left" | "center" | "right";

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | { kind: "table"; head: string[]; rows: string[][]; align: TableAlign[] };

const HEADING_RE = /^(#{1,4})\s+(.+)$/;
const UL_RE = /^\s*[-*+]\s+(.+)$/;
const OL_RE = /^\s*(\d+)[.)]\s+(.+)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const HR_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/;

function tableCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((cell) => cell.trim());
}

function tableAlign(sep: string): TableAlign[] {
  return tableCells(sep).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    return left && right ? "center" : right ? "right" : "left";
  });
}

function isTableStart(line: string, next: string | undefined): boolean {
  return line.includes("|") && next != null && TABLE_SEP_RE.test(next);
}

function isBlockStart(line: string, next: string | undefined): boolean {
  return (
    HEADING_RE.test(line) ||
    UL_RE.test(line) ||
    OL_RE.test(line) ||
    QUOTE_RE.test(line) ||
    HR_RE.test(line) ||
    isTableStart(line, next)
  );
}

/**
 * แปลงข้อความดิบเป็นบล็อก — ตั้งใจรองรับเฉพาะสิ่งที่โมเดลเขียนจริงบ่อย
 * ไม่ทำ markdown เต็มสเปก (ไม่มี HTML, ไม่มี nested list หลายชั้น)
 */
export function parseBlocks(source: string): Block[] {
  const lines = source.split("\n");
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (HR_RE.test(line)) {
      out.push({ kind: "hr" });
      i += 1;
      continue;
    }
    const heading = line.match(HEADING_RE);
    if (heading) {
      out.push({ kind: "h", level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }
    if (isTableStart(line, next)) {
      const head = tableCells(line);
      const align = tableAlign(next!);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(tableCells(lines[i]));
        i += 1;
      }
      out.push({ kind: "table", head, rows, align });
      continue;
    }
    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(UL_RE);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      out.push({ kind: "ul", items });
      continue;
    }
    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(OL_RE);
        if (!m) break;
        items.push(m[2]);
        i += 1;
      }
      out.push({ kind: "ol", items });
      continue;
    }
    if (QUOTE_RE.test(line)) {
      const parts: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(QUOTE_RE);
        if (!m) break;
        parts.push(m[1]);
        i += 1;
      }
      out.push({ kind: "quote", text: parts.join("\n") });
      continue;
    }

    const paragraph = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i], lines[i + 1])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    out.push({ kind: "p", text: paragraph.join("\n") });
  }
  return out;
}

function Blocks({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "p":
            return (
              <p key={i} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                <InlineText text={block.text} />
              </p>
            );
          case "h": {
            const className =
              block.level <= 2
                ? "text-body font-semibold text-fg"
                : block.level === 3
                  ? "text-body-sm font-semibold text-fg"
                  : "text-caption font-semibold text-fg";
            return (
              <p
                key={i}
                role="heading"
                aria-level={Math.min(6, block.level + 1)}
                className={className}
              >
                <InlineText text={block.text} />
              </p>
            );
          }
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-fg-subtle">
                {block.items.map((item, j) => (
                  <li key={j} className="break-words pl-0.5 [overflow-wrap:anywhere]">
                    <InlineText text={item} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-fg-subtle">
                {block.items.map((item, j) => (
                  <li key={j} className="break-words pl-0.5 [overflow-wrap:anywhere]">
                    <InlineText text={item} />
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="whitespace-pre-wrap border-l-2 border-white/[0.14] pl-3 text-fg-muted"
              >
                <InlineText text={block.text} />
              </blockquote>
            );
          case "hr":
            return <hr key={i} className="border-white/[0.08]" />;
          case "table":
            return (
              <div
                key={i}
                className="overflow-x-auto rounded-lg bg-white/[0.02] ring-1 ring-white/[0.07]"
              >
                <table className="w-full border-collapse text-caption">
                  <thead>
                    <tr>
                      {block.head.map((cell, j) => (
                        <th
                          key={j}
                          scope="col"
                          className={`border-b border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 font-semibold text-fg ${
                            block.align[j] === "center"
                              ? "text-center"
                              : block.align[j] === "right"
                                ? "text-right"
                                : "text-left"
                          }`}
                        >
                          <InlineText text={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={`border-b border-white/[0.05] px-2.5 py-1.5 align-top text-fg-muted ${
                              block.align[ci] === "center"
                                ? "text-center"
                                : block.align[ci] === "right"
                                  ? "text-right"
                                  : "text-left"
                            }`}
                          >
                            <InlineText text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function CodeBlock({
  segment,
  live,
  onShare,
}: {
  segment: Segment;
  live: boolean;
  /** ขอลิงก์แชร์ของไฟล์นี้ (ไม่มีในคลังไฟล์ → ปุ่มจะไม่ทำงาน) */
  onShare?: (block: ShareRequest) => Promise<string | null>;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);
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

  /** สร้าง/ใช้ลิงก์แชร์ของไฟล์นี้แล้วคัดลอกให้ทันที — ผู้ใช้ไม่ต้องไปหาในคลังไฟล์ */
  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      const url = await onShare?.({ name: file, lang: segment.lang, bytes: code.length });
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* clipboard ต้อง https — ยังแสดงสถานะว่าแชร์แล้วให้ผู้ใช้คัดลอกเองจากคลังไฟล์ได้ */
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } finally {
      setSharing(false);
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
            aria-label={t("เปิดดูในแท็บใหม่")}
            className="touch-min inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-caption text-fg-muted transition hover:bg-white/[0.08] hover:text-fg"
          >
            <Icon name="fa-arrow-up-right-from-square" />
            {t("เปิดดู")}
          </button>
        )}
        {viewable && onShare && (
          <button
            type="button"
            onClick={share}
            disabled={sharing}
            title={t("คัดลอกลิงก์แชร์ไฟล์นี้")}
            aria-label={t("คัดลอกลิงก์แชร์ไฟล์นี้")}
            className="touch-min inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-caption text-fg-muted transition hover:bg-white/[0.08] hover:text-fg disabled:opacity-50"
          >
            <Icon
              name={shared ? "fa-check" : sharing ? "fa-circle-notch" : "fa-share-nodes"}
              className={shared ? "text-leaf" : sharing ? "animate-spin" : ""}
            />
            {shared ? t("คัดลอกลิงก์แล้ว") : t("แชร์")}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          title={t("คัดลอกโค้ด")}
          aria-label={t("คัดลอกโค้ด")}
          className="touch-min inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-caption text-fg-muted transition hover:bg-white/[0.08] hover:text-fg"
        >
          <Icon name={copied ? "fa-check" : "fa-copy"} className={copied ? "text-leaf" : ""} />
          {copied ? t("คัดลอกแล้ว") : t("คัดลอก")}
        </button>
      </div>
      {/* scroll ในกล่องโค้ดเท่านั้น ไม่ทำให้ทั้งแชทเลื่อนตาม
          13px บนมือถือ / 11px บนจอใหญ่: mono 10px แยก <> {} ออกจากกันไม่ออกตอนจอใกล้ตา */}
      <pre
        ref={preRef}
        className="max-h-[22rem] overflow-auto px-3.5 py-3 text-caption leading-relaxed sm:px-4 sm:text-label"
      >
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
export default function MessageBody({
  text,
  live = false,
  onShare,
}: {
  text: string;
  live?: boolean;
  onShare?: (block: ShareRequest) => Promise<string | null>;
}) {
  const segments = splitSegments(text);
  return (
    <div className="space-y-2.5 text-body-sm leading-relaxed">
      {segments.map((segment, i) =>
        segment.kind === "code" ? (
          <CodeBlock key={`code-${i}`} segment={segment} live={live} onShare={onShare} />
        ) : (
          <Blocks key={`text-${i}`} text={segment.text} />
        ),
      )}
    </div>
  );
}
