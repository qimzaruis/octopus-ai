"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { useT } from "@/lib/i18n/client";

type Format = "chat" | "messages" | "responses";
type Lang = "curl" | "node" | "python";

const FORMATS: { id: Format; label: string; path: string; note: string }[] = [
  {
    id: "chat",
    label: "OpenAI Chat Completions",
    path: "/v1/chat/completions",
    note: "เข้ากันได้กับ OpenAI SDK และแอปภายนอกเกือบทั้งหมด (Cursor, Cline, LangChain)",
  },
  {
    id: "messages",
    label: "Anthropic Messages",
    path: "/v1/messages",
    note: "ใช้กับ Claude SDK และ Claude Code ได้ทันที ส่ง x-api-key แทน Bearer ก็ได้",
  },
  {
    id: "responses",
    label: "OpenAI Responses",
    path: "/v1/responses",
    note: "รูปแบบใหม่ของบริษัท OpenAI (SDK >= 1.40 และ Agents SDK)",
  },
];

const LANGS: { id: Lang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
];

const PREAMBLE = "สวัสดี";

function snippets(host: string, model: string): Record<Format, Record<Lang, string>> {
  const url = `https://${host}`;
  return {
    chat: {
      curl: `curl ${url}/v1/chat/completions \\
  -H "Authorization: Bearer sk-oct-XXXX" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{ "role": "user", "content": "${PREAMBLE}" }],
    "stream": false
  }'`,
      node: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${url}/v1",
  apiKey: "sk-oct-XXXX",
});

const reply = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "${PREAMBLE}" }],
});

console.log(reply.choices[0].message.content);`,
      python: `from openai import OpenAI

client = OpenAI(base_url="${url}/v1", api_key="sk-oct-XXXX")

reply = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "${PREAMBLE}"}],
)

print(reply.choices[0].message.content)`,
    },
    messages: {
      curl: `curl ${url}/v1/messages \\
  -H "x-api-key: sk-oct-XXXX" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "max_tokens": 512,
    "messages": [{ "role": "user", "content": "${PREAMBLE}" }]
  }'`,
      node: `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "${url}/v1",
  apiKey: "sk-oct-XXXX",
});

const reply = await client.messages.create({
  model: "${model}",
  max_tokens: 512,
  messages: [{ role: "user", content: "${PREAMBLE}" }],
});

console.log(reply.content[0].text);`,
      python: `from anthropic import Anthropic

client = Anthropic(base_url="${url}/v1", api_key="sk-oct-XXXX")

reply = client.messages.create(
    model="${model}",
    max_tokens=512,
    messages=[{"role": "user", "content": "${PREAMBLE}"}],
)

print(reply.content[0].text)`,
    },
    responses: {
      curl: `curl ${url}/v1/responses \\
  -H "Authorization: Bearer sk-oct-XXXX" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "input": "${PREAMBLE}"
  }'`,
      node: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${url}/v1",
  apiKey: "sk-oct-XXXX",
});

const reply = await client.responses.create({
  model: "${model}",
  input: "${PREAMBLE}",
});

console.log(reply.output_text);`,
      python: `from openai import OpenAI

client = OpenAI(base_url="${url}/v1", api_key="sk-oct-XXXX")

reply = client.responses.create(model="${model}", input="${PREAMBLE}")

print(reply.output_text)`,
    },
  };
}

/**
 * ตัวอย่างโค้ดเรียก Octopus API — เลือกได้ทั้งรูปแบบ API และภาษาโปรแกรม
 *
 * defaultHost มาจาก DB (ตาราง config) จึงไม่ติดโดเมนเก่าที่ bake ไว้ตอน build
 * หลัง hydrate จะสลับไปใช้โดเมนที่ผู้ใช้เปิดอยู่จริงทันที
 */
export default function ApiUsageTabs({
  model = "octopus-free",
  defaultHost,
}: {
  model?: string;
  defaultHost: string;
}) {
  const t = useT();
  const [format, setFormat] = useState<Format>("chat");
  const [lang, setLang] = useState<Lang>("curl");
  const [host, setHost] = useState<string>(defaultHost);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // ใช้โดเมนที่ผู้ใช้เปิดอยู่จริงเสมอ — เปลี่ยนโดเมนแล้วตัวอย่างโค้ดตามทันที
    setHost(window.location.host);
  }, []);

  const code = useMemo(() => snippets(host, model)[format][lang], [host, model, format, lang]);
  const active = FORMATS.find((f) => f.id === format)!;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* เบราว์เซอร์ไม่อนุญาต clipboard — เงียบไว้ */
    }
  }

  return (
    <div>
      {/* แถบรูปแบบ API: 3 ปุ่มยาว (OpenAI Chat Completions…) บีบกันไม่ได้ —
          บนมือถือให้เป็นแถบเลื่อนแนวนอน (chip มี nowrap จากของเดิม) แล้วค่อย wrap บนจอใหญ่ */}
      <div className="scroll-x -mx-1 flex gap-1.5 px-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormat(f.id)}
            className={`touch-min shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-caption font-medium transition ${
              format === f.id
                ? "bg-white/[0.12] text-fg"
                : "text-fg-muted hover:bg-white/[0.06] hover:text-fg"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-caption leading-relaxed text-fg-muted">{t(active.note)}</p>

      <div className="mt-3 overflow-hidden rounded-lg bg-ink-950/70 ring-1 ring-white/[0.08]">
        <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.07] bg-white/[0.03] px-2 py-1.5">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id)}
              className={`touch-min rounded-md px-2.5 py-1 text-caption transition ${
                lang === l.id ? "bg-white/[0.1] text-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {l.label}
            </button>
          ))}
          {/* path ถูกตัดทิ้งบนจอเล็ก: มันคือข้อมูลที่ซ้ำกับบรรทัด curl ในโค้ดเอง
              และ truncate เหลือ "…" ไม่มีประโยชน์ */}
          <code className="ml-auto hidden max-w-[12rem] truncate font-mono text-label text-fg-subtle sm:block">
            {active.path}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-label={t("คัดลอก")}
            title={t("คัดลอก")}
            className="touch-min ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-caption text-fg-muted transition hover:bg-white/[0.08] hover:text-fg sm:ml-2"
          >
            <Icon name={copied ? "fa-check" : "fa-copy"} className={copied ? "text-leaf" : ""} />
            {copied ? t("คัดลอกแล้ว") : t("คัดลอก")}
          </button>
        </div>
        {/* 10px บนมือถืออ่านไม่ออก: ใช้ 13px ที่จอเล็ก แล้วกลับ 11px ตั้งแต่ sm
            โค้ดยังเลื่อนแนวนอนได้ (scroll-x) ไม่ต้องตัดบรรทัดที่ทําให้อ่านไม่ออก */}
        <pre className="scroll-x max-h-80 w-full min-w-0 overflow-y-auto px-3.5 py-3 text-caption leading-relaxed sm:text-label">
          <code className="whitespace-pre font-mono text-fg-muted">{code}</code>
        </pre>
      </div>

      <p className="mt-2 text-caption leading-relaxed text-fg-subtle">
        {t("ใส่คีย์ของคุณที่หน้า API Keys — ตั้ง stream: true เพื่อรับข้อความแบบทยอยมา (SSE) ได้ทุกรูปแบบ")}
      </p>
    </div>
  );
}
