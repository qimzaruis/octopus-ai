"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { siteUrl } from "@/lib/config";
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
 * ใช้โดเมนของเว็บที่เปิดอยู่จริง (หรือ NEXT_PUBLIC_APP_URL) เพื่อให้ก๊อปไปวางแล้วยิงได้ทันที
 */
export default function ApiUsageTabs({ model = "octopus-free" }: { model?: string }) {
  const t = useT();
  const [format, setFormat] = useState<Format>("chat");
  const [lang, setLang] = useState<Lang>("curl");
  const [host, setHost] = useState<string>(siteUrl ? siteUrl.replace(/^https?:\/\//, "") : "YOUR_APP_HOST");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!siteUrl) setHost(window.location.host);
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
      <div className="flex flex-wrap gap-1.5">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormat(f.id)}
            className={`rounded-md px-3 py-1.5 text-label font-medium transition ${
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
              className={`rounded-md px-2.5 py-1 text-label transition ${
                lang === l.id ? "bg-white/[0.1] text-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {l.label}
            </button>
          ))}
          <code className="ml-auto truncate font-mono text-micro text-fg-subtle">{active.path}</code>
          <button
            type="button"
            onClick={copy}
            title={t("คัดลอก")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-micro text-fg-muted transition hover:bg-white/[0.08] hover:text-fg"
          >
            <Icon name={copied ? "fa-check" : "fa-copy"} className={copied ? "text-leaf" : ""} />
            {copied ? t("คัดลอกแล้ว") : t("คัดลอก")}
          </button>
        </div>
        <pre className="max-h-80 overflow-auto px-3.5 py-3 text-micro leading-relaxed">
          <code className="whitespace-pre font-mono text-fg-muted">{code}</code>
        </pre>
      </div>

      <p className="mt-2 text-label leading-relaxed text-fg-subtle">
        {t("ใส่คีย์ของคุณที่หน้า API Keys — ตั้ง stream: true เพื่อรับข้อความแบบทยอยมา (SSE) ได้ทุกรูปแบบ")}
      </p>
    </div>
  );
}
