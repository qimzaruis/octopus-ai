import { useEffect, useState } from "react";
import Image from "next/image";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";

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

function groupModels(models: AgentModel[]): ModelGroup[] {
  const groups: ModelGroup[] = [];
  const byKey = new Map<string, ModelGroup>();
  for (const model of models) {
    const key = model.category ? `cat-${model.category.id}` : "none";
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        name: model.category?.name ?? "",
        logoUrl: model.category?.logoUrl ?? null,
        models: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.models.push(model);
  }
  return groups;
}

/**
 * ตัวเลือกโมเดล — ชิปที่กางเมนูขึ้นข้างบน
 *
 * ใช้เมนูของตัวเองแทน <select> เพราะ native dropdown มีพื้นขาวของระบบ
 * ไม่เข้ากับธีมและคุมหน้าตาไม่ได้
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const current = models.find((m) => m.id === value) ?? models[0];
  const groups = groupModels(models);
  const hasGroups = groups.length > 1 || Boolean(groups[0]?.name);

  // คีย์บอร์ดปิดเมนูได้ด้วย Escape (เดิม Tab ออกไปแล้วเมนูยังค้าง)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /** เปิดเมนู: กางเฉพาะหมวดของโมเดลที่เลือกอยู่ หมวดอื่นพับไว้ให้รายการสั้น */
  function toggleMenu() {
    if (!open) {
      const currentGroup = groups.find((g) => g.models.some((m) => m.id === current?.id))?.key;
      setCollapsed(new Set(groups.filter((g) => g.key !== currentGroup).map((g) => g.key)));
    }
    setOpen((v) => !v);
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderModel(m: AgentModel) {
    const selected = m.id === value;
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
          {m.description && (
            <span className="block truncate text-label text-fg-subtle">{t(m.description)}</span>
          )}
        </span>
        {selected && (
          <Icon name="fa-check" className="shrink-0 text-body-sm text-brand-300" />
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleMenu}
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
            {hasGroups
              ? groups.map((group) => {
                  const isCollapsed = collapsed.has(group.key);
                  return (
                    <div key={group.key} className="mb-0.5 last:mb-0">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={!isCollapsed}
                        className="touch-min flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors duration-fast hover:bg-white/[0.04]"
                      >
                        {group.logoUrl ? (
                          <Image
                            src={group.logoUrl}
                            alt=""
                            width={18}
                            height={18}
                            className="h-[1.125rem] w-[1.125rem] shrink-0 object-contain"
                          />
                        ) : (
                          <Icon name="fa-layer-group" className="shrink-0 text-micro text-fg-subtle" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-label font-semibold text-fg-muted">
                          {group.name || t("อื่น ๆ")}
                        </span>
                        <span className="shrink-0 text-micro text-fg-subtle">
                          {group.models.length}
                        </span>
                        <Icon
                          name="fa-chevron-down"
                          className={`shrink-0 text-micro text-fg-subtle transition-transform duration-fast ${
                            isCollapsed ? "-rotate-90" : ""
                          }`}
                        />
                      </button>
                      {!isCollapsed && <div className="pb-1">{group.models.map(renderModel)}</div>}
                    </div>
                  );
                })
              : models.map(renderModel)}
          </div>
        </>
      )}
    </div>
  );
}
