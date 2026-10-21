"use client";

import { useRef, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/client";
import type { ImageJob } from "@/lib/chat/db";
import { ConfirmDialog } from "@/components/Dialog";
import { ModelPicker, type AgentModel } from "@/components/ModelPicker";
import Menu from "@/components/Menu";
import Icon from "@/components/Icon";
import { formatDateTime } from "@/lib/format";

/** สัดส่วนที่เลือกได้ พร้อมรูปทรงจริงในปุ่มและคำอธิบายว่าเหมาะกับการใช้งานแบบไหน */
const RATIOS = [
  { id: "9:16", icon: "fa-mobile-screen-button", w: 18, h: 32 },
  { id: "3:4", icon: "fa-image-portrait", w: 24, h: 32 },
  { id: "1:1", icon: "fa-square", w: 30, h: 30 },
  { id: "4:3", icon: "fa-image", w: 34, h: 26 },
  { id: "16:9", icon: "fa-display", w: 40, h: 22 },
] as const;

const MAX_REFS = 4;

type RefImage = { name: string; dataUrl: string };

/**
 * ImageStudio — หน้าสร้างรูปภาพ (แยกจากหน้าแชท)
 *
 * ขั้นนี้ยังเป็นฝั่งหน้าจอ: เลือกโมเดล สัดส่วน และแนบรูปอ้างอิงได้
 * งานที่สร้างจะถูกบันทึกเป็นคิวไว้ในฐานข้อมูล และจะถูกรันจริง
 * เมื่อต่อโมเดลสร้างรูปเข้ากับ gateway ในขั้นถัดไป
 */
export default function ImageStudio({
  models,
  initialJobs,
}: {
  models: AgentModel[];
  initialJobs: ImageJob[];
}) {
  const t = useT();
  const locale = useLocale();
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<string>("3:4");
  const [model, setModel] = useState(models[0]?.id ?? "");
  const [refs, setRefs] = useState<RefImage[]>([]);
  const [jobs, setJobs] = useState<ImageJob[]>(initialJobs);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addRefs(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: RefImage[] = [];
    for (const f of Array.from(files)) {
      if (refs.length + next.length >= MAX_REFS) {
        setNotice(t("แนบรูปอ้างอิงได้สูงสุด {n} รูป", { n: MAX_REFS }));
        break;
      }
      if (!f.type.startsWith("image/")) {
        setNotice(t("รับเฉพาะไฟล์รูปภาพ: {name}", { name: f.name }));
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        setNotice(t("ไฟล์ใหญ่เกิน 10MB: {name}", { name: f.name }));
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      next.push({ name: f.name, dataUrl });
    }
    setRefs((prev) => [...prev, ...next].slice(0, MAX_REFS));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function create() {
    const text = prompt.trim();
    if (!text || busy) return;
    if (!model) {
      setNotice(t("ยังไม่มีโมเดลที่เปิดให้ใช้"));
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/images/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, model, ratio, refs: refs.map((r) => r.name) }),
      });
      const data = (await res.json()) as { job?: ImageJob; error?: string };
      if (!res.ok || !data.job) {
        throw new Error(data.error ?? String(res.status));
      }
      setJobs((prev) => [data.job as ImageJob, ...prev]);
      setPrompt("");
      setRefs([]);
      setNotice(t("บันทึกเข้าคิวแล้ว — ระบบจะแสดงรูปทันทีที่สร้างเสร็จ"));
    } catch {
      setNotice(t("ส่งงานไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      setBusy(false);
    }
  }

  async function removeJob() {
    const id = pendingDelete;
    if (!id) return;
    setDeleting(true);
    setJobs((prev) => prev.filter((j) => j.id !== id));
    try {
      const res = await fetch(`/api/images/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setPendingDelete(null);
    } catch {
      setNotice(t("ลบงานไม่สำเร็จ"));
    } finally {
      setDeleting(false);
    }
  }

  const ideas = [
    {
      label: t("ภาพสินค้า"),
      prompt: t("ภาพสินค้าบนพื้นหลังเรียบ แสงนุ่ม มุมมองด้านหน้า"),
    },
    {
      label: t("ภาพประกอบ"),
      prompt: t("ภาพประกอบสไตล์มินิมอลสำหรับโพสต์โซเชียล"),
    },
    {
      label: t("อวตาร"),
      prompt: t("อวตารสไตล์อนิเมะ โทนสีพาสเทล"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ฝั่งตั้งค่าก่อนสร้าง — การ์ดเดี่ยวกลางหน้า อ่านง่ายกว่าแบ่งสองคอลัมน์ */}
      <section className="card mx-auto w-full max-w-4xl overflow-visible p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <Icon name="fa-wand-magic-sparkles" />
          </span>
          <div className="min-w-0">
            <h1 className="text-title font-semibold tracking-tight text-fg">
              {t("สร้างภาพด้วย AI")}
            </h1>
            <p className="mt-1 text-caption leading-relaxed text-fg-subtle">
              {t("อธิบายสิ่งที่อยากเห็น เลือกสัดส่วน และแนบภาพอ้างอิงได้")}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="label mb-0" htmlFor="image-prompt">
              {t("อธิบายรูปที่ต้องการ")}
            </label>
            <span className="text-micro tabular-nums text-fg-subtle">
              {prompt.length}/2000
            </span>
          </div>
          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder={t("เช่น แมวส้มใส่ชุดอวกาศ ลอยอยู่ในอวกาศ แสงนีออน สไตล์ภาพวาดดิจิทัล")}
            className="input min-h-36 resize-none bg-ink-950/60 leading-relaxed"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ideas.map((idea) => (
              <button
                key={idea.label}
                type="button"
                onClick={() => setPrompt(idea.prompt)}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-label text-fg-subtle transition hover:border-brand-400/40 hover:text-fg"
              >
                {idea.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="label">{t("สัดส่วนรูปภาพ")}</p>
          <div className="grid grid-cols-5 gap-2">
            {RATIOS.map((r) => {
              const active = r.id === ratio;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRatio(r.id)}
                  aria-pressed={active}
                  title={t("สัดส่วน {r}", { r: r.id })}
                  className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl p-2 transition ${
                    active
                      ? "bg-brand-500/10 ring-2 ring-brand-400/70"
                      : "bg-white/[0.04] ring-1 ring-white/[0.07] hover:bg-white/[0.07]"
                  }`}
                >
                  <span
                    style={{ width: Math.round(r.w * 0.72), height: Math.round(r.h * 0.72) }}
                    className={`block rounded-[3px] transition ${
                      active ? "bg-brand-400" : "bg-white/[0.14]"
                    }`}
                  />
                  <span
                    className={`flex items-center gap-1 text-micro font-medium ${
                      active ? "text-fg" : "text-fg-subtle"
                    }`}
                  >
                    <Icon name={r.icon} className="text-micro" />
                    {r.id}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="label">{t("รูปอ้างอิง (ไม่บังคับ)")}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addRefs(e.target.files)}
          />
          <div className="flex flex-wrap items-center gap-2">
            {refs.map((r, i) => (
              <div
                key={`${r.name}-${i}`}
                className="relative h-16 w-16 overflow-hidden rounded-lg ring-1 ring-white/[0.08]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.dataUrl} alt={r.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setRefs((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={t("ลบไฟล์")}
                  className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-md bg-black/65 text-micro text-fg hover:bg-black/85"
                >
                  <Icon name="fa-xmark" />
                </button>
              </div>
            ))}
            {refs.length < MAX_REFS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/[0.14] text-fg-subtle transition hover:border-brand-400/50 hover:text-fg"
                title={t("แนบรูปอ้างอิง")}
                aria-label={t("แนบรูปอ้างอิง")}
              >
                <Icon name="fa-plus" />
                <span className="text-micro">{t("แนบรูป")}</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-caption text-fg-subtle">{t("โมเดล")}</span>
            <ModelPicker models={models} value={model} onChange={setModel} drop="up" />
          </div>
          <button
            type="button"
            onClick={create}
            disabled={busy || !prompt.trim() || models.length === 0}
            className="btn-primary w-full !px-6 !py-3 disabled:cursor-not-allowed sm:w-auto"
          >
            {busy ? (
              <Icon name="fa-circle-notch" className="animate-spin" />
            ) : (
              <Icon name="fa-wand-magic-sparkles" />
            )}
            {t("สร้างรูป")}
          </button>
        </div>

        {models.length === 0 && (
          <p className="mt-3 text-label leading-relaxed text-fg-subtle">
            <Icon name="fa-circle-info" className="mr-1.5" />
            {t("ยังไม่มีโมเดลสร้างรูป — เพิ่มโมเดลประเภทสร้างรูปที่หน้า Providers ก่อน")}
          </p>
        )}
        <p className="mt-3 text-label leading-relaxed text-fg-subtle">
          <Icon name="fa-hourglass-half" className="mr-1.5" />
          {t("งานที่ส่งจะถูกเก็บในคิวและแสดงในผลงานล่าสุด")}
        </p>
        {notice && (
          <p className="mt-3 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-caption text-fg-muted">
            <Icon name="fa-circle-info" className="mr-1.5" />
            {notice}
          </p>
        )}
      </section>

      {/* ผลงานล่าสุด */}
      <section className="mx-auto w-full max-w-6xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-body font-semibold text-fg">{t("ผลงานล่าสุด")}</h2>
          <span className="text-label text-fg-subtle">
            {t("{n} งาน", { n: jobs.length })}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="card p-5">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.10] bg-white/[0.02] px-6 py-14 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-300">
                <Icon name="fa-photo-film" className="text-title" />
              </span>
              <p className="text-body-sm font-medium text-fg">{t("ยังไม่มีผลงาน")}</p>
              <p className="mt-1 max-w-sm text-caption leading-relaxed text-fg-subtle">
                {t("ลองอธิบายภาพแรกด้านบน แล้วผลงานจะมาแสดงที่นี่")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {jobs.map((j) => (
              <article key={j.id} className="card relative">
                <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-ink-950/70">
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-fg-subtle">
                    <Icon name="fa-wand-magic-sparkles" className="text-title text-brand-300/80" />
                    <span className="text-micro">{t("กำลังรอสร้าง")}</span>
                  </div>
                  <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-amber-glow/10 px-2 py-0.5 text-micro font-medium text-amber-glow">
                    <Icon name="fa-clock" className="text-micro" />
                    {t("ในคิว")}
                  </span>
                </div>
                <span className="absolute right-2 top-2 z-10">
                  <Menu
                    label={t("ตัวเลือกงาน")}
                    widthPx={150}
                    triggerClassName="h-8 w-8 rounded-md bg-black/35 text-fg"
                    items={[
                      {
                        icon: "fa-trash",
                        label: t("ลบ"),
                        tone: "danger",
                        onClick: () => setPendingDelete(j.id),
                      },
                    ]}
                  />
                </span>
                <div className="p-3.5">
                  <p className="line-clamp-2 text-caption leading-relaxed text-fg">{j.prompt}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-fg-subtle">
                    <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono">{j.ratio}</span>
                    <span className="truncate">{j.model}</span>
                    <span>· {formatDateTime(j.createdAt, locale)}</span>
                    {j.refs.length > 0 && (
                      <span>· {t("{n} รูปอ้างอิง", { n: j.refs.length })}</span>
                    )}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t("ลบงานนี้?")}
        message={t("รายการงานจะหายไปจากประวัติ การกระทำนี้ย้อนกลับไม่ได้")}
        confirmLabel={t("ลบ")}
        cancelLabel={t("ยกเลิก")}
        busy={deleting}
        onConfirm={removeJob}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
