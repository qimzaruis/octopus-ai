import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";
import { categoryRank } from "@/lib/categories";

/** หมวด/แบรนด์ของโมเดล (ชื่อ + รูป) — ใช้จัดกลุ่มในเมนู */
export type AgentModelCategory = {
  id: number;
  name: string;
  logoUrl: string | null;
};

/** "โมเดล" ที่ผู้ใช้เลือกได้ = route สาธารณะของหน้า /models (เช่น octopus-free) */
export type AgentModel = {
  id: string;
  label: string;
  logoUrl: string | null;
  category?: AgentModelCategory | null;
  description?: string;
  inputPricePerM?: number;
  outputPricePerM?: number;
  contextWindow?: number;
  supportsVision?: boolean;
};

/** โลโก้ของ route — ไม่มีโลโก้ให้ใช้ตัวอักษรแรกของชื่อแทน (พื้นม่วงอ่อนตามระบบดีไซน์) */
export function ModelLogo({
  model,
  className = "",
}: {
  model?: AgentModel | null;
  className?: string;
}) {
  const logoUrl = model?.logoUrl ?? model?.category?.logoUrl ?? null;
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={28}
        height={28}
        className={`shrink-0 object-contain ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-brand-500/15 font-semibold text-brand-300 ${className}`}
    >
      {(model?.label ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}

type ModelGroup = {
  key: string;
  name: string;
  logoUrl: string | null;
  models: AgentModel[];
};

function categoryKey(model: AgentModel): string {
  return model.category ? `cat-${model.category.id}` : "none";
}

/**
 * ตัวเลือกโมเดล — ชิปที่กางเมนูขึ้นข้างบน
 *
 * ในเมนูแสดงเป็นลิสต์จัดกลุ่ม: ชื่อหมวดเล็ก ๆ อยู่ด้านบน แล้วมีโมเดลอยู่ใต้หมวด
 * ไม่มี dropdown/chevron ให้กดย่ออีก และหมวดของ OctopusAI อยู่บนสุดเสมอ
 */
export function ModelPicker({
  models,
  value,
  onChange,
  align = "left",
  drop = "up",
}: {
  models: AgentModel[];
  value: string;
  onChange: (id: string) => void;
  align?: "left" | "right";
  /** เมนูอยู่ในช่องพิมพ์ที่ชิดขอบล่าง จึงกางขึ้นบนเป็นค่าเริ่มต้น */
  drop?: "up" | "down";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const current = models.find((m) => m.id === value) ?? models[0];

  const groups = useMemo(() => {
    const byKey = new Map<string, ModelGroup>();
    for (const model of models) {
      const key = categoryKey(model);
      const existing = byKey.get(key);
      if (existing) existing.models.push(model);
      else
        byKey.set(key, {
          key,
          name: model.category?.name ?? "",
          logoUrl: model.category?.logoUrl ?? null,
          models: [model],
        });
    }
    return [...byKey.values()].sort((a, b) => {
      // ไม่มีหมวดไปท้ายสุด
      if (!a.name) return 1;
      if (!b.name) return -1;
      return categoryRank(a.name) - categoryRank(b.name) || a.name.localeCompare(b.name, "th");
    });
  }, [models]);

  // คีย์บอร์ดปิดเมนูได้ด้วย Escape (เดิม Tab ออกไปแล้วเมนูยังค้าง)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function renderModel(m: AgentModel) {
    const selected = m.id === value;
    const sub = m.description ? t(m.description) : "";
    return (
      <button
        key={m.id}
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        onClick={() => {
          onChange(m.id);
          setOpen(false);
        }}
        className={`flex min-h-[2.75rem] w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors duration-fast ${
          selected ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"
        }`}
      >
        <ModelLogo model={m} className="h-7 w-7 rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-caption font-medium text-fg">{m.label}</span>
          {sub && <span className="block truncate text-label text-fg-subtle">{sub}</span>}
        </span>
        {selected && <Icon name="fa-check" className="shrink-0 text-body-sm text-brand-300" />}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={models.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("เลือกโมเดล")}
        className="touch-min flex max-w-[13rem] items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1.5 text-caption text-fg-muted transition-colors duration-fast hover:bg-white/[0.11] hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ModelLogo model={current} className="h-4 w-4 rounded text-micro" />
        <span className="truncate font-medium text-fg">
          {current?.label ?? t("ยังไม่มีโมเดลที่เปิดให้ใช้")}
        </span>
        <Icon
          name={drop === "up" ? "fa-chevron-up" : "fa-chevron-down"}
          className={`shrink-0 text-micro transition-transform duration-fast ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          {/* ความกว้าง 19rem (304px) ชิดขอบซ้ายที่จอ 360px แล้วหลุดขอบขวา → ตัดท้าย
              ทั้งเครื่องหมาย ✓ ที่เลือกไว้ จึงผูก max-w กับ 100vw ไว้ด้วย
              max-h + scroll: รายการโมเดลยาวกว่าจอไม่ได้ โดยเฉพาะตอน drop="up"
              ที่แผงบานขึ้นจากแถบเครื่องมือซึ่งอยู่ชิดขอบล่าง */}
          <div
            role="menu"
            aria-label={t("เลือกโมเดล")}
            className={`animate-fade-in absolute z-20 max-h-[min(24rem,60dvh)] w-[19rem] max-w-[calc(100vw_-_1.5rem)] overflow-y-auto rounded-lg bg-ink-850 p-1.5 shadow-floating ring-1 ring-white/[0.07] ${
              drop === "up" ? "bottom-[calc(100%+0.5rem)]" : "top-[calc(100%+0.5rem)]"
            } ${align === "right" ? "right-0" : "left-0"}`}
          >
            <p className="px-2.5 pb-1.5 pt-1 text-micro font-semibold uppercase tracking-[0.14em] text-fg-subtle">
              {t("โมเดลที่ใช้ได้")}
            </p>

            {/* ชื่อหมวดเล็ก ๆ ด้านบนของแต่ละกลุ่ม แล้วมีโมเดลอยู่ใต้หมวด */}
            <div className="pb-1">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-1.5 px-2.5 pb-0.5 pt-2 text-micro font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                    {group.logoUrl && (
                      <Image
                        src={group.logoUrl}
                        alt=""
                        width={14}
                        height={14}
                        className="h-3.5 w-3.5 shrink-0 rounded object-contain"
                      />
                    )}
                    <span className="truncate">{group.name || t("อื่น ๆ")}</span>
                  </div>
                  <div className="ml-3 border-l border-white/[0.07] pl-1">
                    {group.models.map(renderModel)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
