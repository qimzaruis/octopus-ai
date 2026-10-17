"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * CodeCard — การ์ดโค้ดตัวอย่าง สลับแท็บ Python/cURL และคัดลอกได้
 * ใช้ mono font + สีแบรนด์ ไม่ใช้ backdrop-blur (เลี่ยงภาระ GPU ในหน้าเดียวกันหลายจุด)
 */
export default function CodeCard() {
  const t = useT();
  const [tab, setTab] = useState<"python" | "curl">("python");
  const [copied, setCopied] = useState(false);

  const pythonCode = `from openai import OpenAI

client = OpenAI(
    base_url="https://api.octopus.ai/v1",
    api_key="YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="octopus-pro",
    messages=[{
        "role": "user",
        "content": "Let's build something great."
    }],
)

print(response.choices[0].message.content)`;

  const curlCode = `curl https://api.octopus.ai/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "octopus-pro",
    "messages": [{
      "role": "user",
      "content": "Let's build something great."
    }]
  }'`;

  async function copy() {
    await navigator.clipboard.writeText(tab === "python" ? pythonCode : curlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-xl bg-ink-900 shadow-raised">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
        <div className="flex items-center gap-1">
          {(["python", "curl"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              aria-pressed={tab === tabKey}
              className={`rounded-md px-3 py-1.5 text-caption font-medium transition-colors duration-fast ${
                tab === tabKey ? "bg-white/[0.1] text-fg" : "text-fg-subtle hover:text-fg-muted"
              }`}
            >
              {tabKey === "python" ? "Python" : "cURL"}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          aria-label={copied ? t("คัดลอกแล้ว") : t("คัดลอก")}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-caption text-fg-subtle transition-colors duration-fast hover:bg-white/[0.06] hover:text-fg"
        >
          {copied ? t("คัดลอกแล้ว") : t("คัดลอก")}
          <i
            className={`text-micro ${
              copied ? "fa-solid fa-check text-leaf" : "fa-regular fa-copy"
            }`}
          />
        </button>
      </div>

      <pre className="min-h-[336px] overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-[1.75] text-fg-muted">
        <code>
          {tab === "python" ? (
            <>
              <span className="text-pulse">from</span> openai{" "}
              <span className="text-pulse">import</span> OpenAI
              {"\n\n"}
              client = OpenAI(
              {"\n    "}
              base_url=<span className="text-aqua">&quot;https://api.octopus.ai/v1&quot;</span>,
              {"\n    "}
              api_key=<span className="text-aqua">&quot;YOUR_API_KEY&quot;</span>,
              {"\n"}
              )
              {"\n\n"}
              response = client.chat.completions.create(
              {"\n    "}
              model=<span className="text-aqua">&quot;octopus-pro&quot;</span>,
              {"\n    "}
              messages=[{"{"}
              {"\n        "}
              <span className="text-aqua">&quot;role&quot;</span>:{" "}
              <span className="text-aqua">&quot;user&quot;</span>,
              {"\n        "}
              <span className="text-aqua">&quot;content&quot;</span>:{" "}
              <span className="text-aqua">&quot;Let&apos;s build something great.&quot;</span>
              {"\n    "}
              {"}"}],
              {"\n"}
              )
              {"\n\n"}
              <span className="text-pulse">print</span>(response.choices[0].message.content)
            </>
          ) : (
            <>
              curl https://api.octopus.ai/v1/chat/completions \
              {"\n  -"}H{" "}
              <span className="text-aqua">&quot;Authorization: Bearer YOUR_API_KEY&quot;</span> \
              {"\n  -"}H <span className="text-aqua">&quot;Content-Type: application/json&quot;</span>{" "}
              \
              {"\n  -"}d {"'"}
              {"{"}
              {"\n    "}
              <span className="text-aqua">&quot;model&quot;</span>:{" "}
              <span className="text-aqua">&quot;octopus-pro&quot;</span>,
              {"\n    "}
              <span className="text-aqua">&quot;messages&quot;</span>: [{"{"}
              {"\n      "}
              <span className="text-aqua">&quot;role&quot;</span>:{" "}
              <span className="text-aqua">&quot;user&quot;</span>,
              {"\n      "}
              <span className="text-aqua">&quot;content&quot;</span>:{" "}
              <span className="text-aqua">&quot;Let&apos;s build something great.&quot;</span>
              {"\n    "}
              {"}"}]
              {"\n  "}
              {"}"}
              {"'"}
            </>
          )}
        </code>
      </pre>

      <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 text-label">
        <p>
          <span className="rounded bg-brand-500/20 px-1.5 py-0.5 font-semibold text-brand-300">
            POST
          </span>
          <span className="ml-2 font-mono text-fg-subtle">/v1/chat/completions</span>
        </p>
        <p className="text-fg-subtle">OpenAI compatible</p>
      </div>
    </div>
  );
}