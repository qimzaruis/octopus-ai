"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";

const BARS = [42, 58, 36, 71, 52, 88, 64, 96];

const PROVIDERS = [
  { name: "OpenAI", model: "gpt-4o-mini", ok: true, lat: "0.8s" },
  { name: "Anthropic", model: "claude-3.5-sonnet", ok: true, lat: "1.2s" },
  { name: "Google", model: "gemini-1.5-pro", ok: true, lat: "1.6s" },
  { name: "Groq", model: "llama-3.1-70b", ok: false, lat: "0.4s" },
];

/**
 * LiveUsagePanel — แผงจำลองการใช้งานของหน้า signin (ส่วนตกแต่ง)
 * จงใจไม่ใช้ conic-gradient หมุนหรือ backdrop-blur: ทั้งคู่บังคับให้เบราว์เซอร์
 * repaint หนักทุกเฟรม (สาเหตุหลักของอาการกระตุก) ใช้การเปลี่ยนสี/ความสูงแทน
 */
export default function LiveUsagePanel() {
  const t = useT();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // เคารพผู้ใช้ที่ปิดอนิเมชัน — ไม่ต้องตั้ง interval เลย

    const id = setInterval(() => setTick((n) => n + 1), 1800);
    return () => clearInterval(id);
  }, []);

  const bars = BARS.map((h, i) => {
    const wobble = Math.sin((tick + i) * 0.9) * 8;
    return Math.min(100, Math.max(20, h + wobble));
  });

  return (
    <div className="w-full">
      <div className="rounded-xl bg-ink-900 p-5 shadow-floating">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.16em] text-fg-subtle">
              Live throughput
            </p>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="tnum text-2xl font-semibold text-fg">12,480</span>
              <span className="text-label text-fg-subtle">{t("tokens / นาที")}</span>
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md bg-leaf/10 px-2.5 py-1 text-micro font-medium text-leaf">
            <span className="h-1.5 w-1.5 rounded-full bg-leaf" />
            operational
          </span>
        </div>

        {/* แท่งกราฟ: เปลี่ยนความสูง+สี (ไม่ใช้ gradient/เงา) */}
        <div className="mt-5 flex h-28 items-end gap-2">
          {bars.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm transition-[height] duration-slow ease-enter ${
                i === bars.length - 1 ? "bg-brand-400" : "bg-brand-500/30"
              }`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>

        <div className="mt-5 space-y-1.5">
          {PROVIDERS.map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    p.ok ? "bg-leaf" : "bg-amber-glow"
                  }`}
                />
                <span className="text-label font-medium text-fg">{p.name}</span>
                <span className="truncate font-mono text-micro text-fg-subtle">{p.model}</span>
              </div>
              <span className="tnum shrink-0 text-micro text-fg-muted">{p.lat}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="rounded-md bg-white/[0.05] px-3 py-1.5 text-label text-fg-muted">
          <Icon name="fa-shield-halved" className="mr-1.5 text-leaf" />
          {t("คีย์เก็บฝั่ง server")}
        </span>
        <span className="rounded-md bg-white/[0.05] px-3 py-1.5 text-label text-fg-muted">
          <Icon name="fa-rotate" className="mr-1.5 text-aqua" />
          {t("fallback อัตโนมัติ")}
        </span>
      </div>
    </div>
  );
}