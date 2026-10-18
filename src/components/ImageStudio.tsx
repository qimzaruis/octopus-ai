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

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      {/* ฝั่งตั้งค่าก่อนสร้าง */}
      <section className="card p-5 sm:p-6">
        <label className="label" htmlFor="image-prompt">
          {t("อธิบายรูปที่ต้องการ")}
        </label>
        <textarea
          id="image-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={t("เช่น แมวส้มใส่ชุดอวกาศ ลอยอยู่ในอวกาศ แสงนีออน สไตล์ภาพวาดดิจิทัล")}
          className="input resize-none leading-relaxed"
        />

        <div className="mt-5">
          <p className="label">{t("สัดส่วนรูปภาพ")}</p>
          <div className="flex flex-wrap gap-2">
            {RATIOS.map((r) => {
              const active = r.id === ratio;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRatio(r.id)}
                  aria-pressed={active}
                  title={t("สัดส่วน {r}", { r: r.id })}
                  className={`flex h-[5.25rem] w-[4.25rem] flex-col items-center justify-center gap-2 rounded-xl transition ${
                    active
                      ? "bg-brand-500/10 ring-2 ring-brand-400/70"
                      : "bg-white/[0.04] ring-1 ring-white/[0.07] hover:bg-white/[0.07]"
                  }`}
                >
                  <span
                    style={{ width: r.w, height: r.h }}
                    className={`block rounded-[3px] transition ${
                      active
                        ? "bg-gradient-to-br from-brand-400 to-aqua"
                        : "bg-white/[0.14]"
                    }`}
                  />
                  <span
                    className={`flex items-center gap-1 text-label font-medium ${
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

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
          <div className="flex items-center gap-2.5">
            <span className="text-caption text-fg-subtle">{t("โมเดล")}</span>
            <ModelPicker models={models} value={model} onChange={setModel} drop="down" />
          </div>
          <button
            type="button"
            onClick={create}
            disabled={busy || !prompt.trim() || models.length === 0}
            className="btn-primary disabled:cursor-not-allowed"
          >
            {busy ? (
              <Icon name="fa-circle-notch" className="animate-spin" />
            ) : (
              <Icon name="fa-wand-magic-sparkles" />
            )}
            {t("สร้างรูป")}
          </button>
        </div>

        <p className="mt-3 text-label leading-relaxed text-amber-glow">
          <Icon name="fa-hourglass-half" className="mr-1.5" />
          {t("ระบบกำลังต่อโมเดลสร้างรูปภาพ — งานที่ส่งจะถูกเก็บไว้ในคิวและแสดงที่นี่")}
        </p>
        {notice && (
          <p className="mt-3 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-caption text-fg-muted">
            <Icon name="fa-circle-info" className="mr-1.5" />
            {notice}
          </p>
        )}
      </section>

      {/* ฝั่งงานที่ผ่านมา */}
      <section className="card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-body-sm font-semibold text-fg">{t("งานสร้างรูปของฉัน")}</h2>
          <span className="text-label text-fg-subtle">{t("{n} งาน", { n: jobs.length })}</span>
        </div>

        {jobs.length === 0 ? (
          <p className="mt-10 text-center text-caption text-fg-subtle">
            <span className="mb-3 flex justify-center text-xl">
              <Icon name="fa-photo-film" className="text-fg-subtle" />
            </span>
            {t("ยังไม่มีงานสร้างรูป — พิมพ์คำอธิบายแล้วกดสร้างได้เลย")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="group/job flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-300">
                  <Icon name="fa-wand-magic-sparkles" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-caption text-fg">{j.prompt}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-fg-subtle">
                    <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono">{j.ratio}</span>
                    <span className="truncate">{j.model}</span>
                    <span>· {formatDateTime(j.createdAt, locale)}</span>
                    {j.refs.length > 0 && (
                      <span>
                        · {t("{n} รูปอ้างอิง", { n: j.refs.length })}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-glow/10 px-2 py-0.5 text-micro font-medium text-amber-glow">
                    <Icon name="fa-clock" className="text-micro" />
                    {t("ในคิว")}
                  </span>
                  <Menu
                    label={t("ตัวเลือกงาน")}
                    widthPx={150}
                    triggerClassName="h-7 w-7 opacity-0 group-hover/job:opacity-100 focus-visible:opacity-100"
                    items={[
                      {
                        icon: "fa-trash",
                        label: t("ลบ"),
                        tone: "danger",
                        onClick: () => setPendingDelete(j.id),
                      },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
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
