"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import Icon from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import { compareCategories } from "@/lib/categories";
import { formatNumber, formatTokens, formatUsd } from "@/lib/format";

/** ข้อมูลที่หน้า /models ต้องใช้ — ไม่มี id ของโมเดลปลายทางหรือชื่อค่ายติดมา */
export type ExplorerModel = {
  id: number;
  publicModel: string;
  name: string;
  description: string;
  logoUrl: string | null;
  category: { name: string; logoUrl: string | null } | null;
  inputPricePerM: number;
  outputPricePerM: number;
  contextWindow: number;
  supportsVision: boolean;
  /** 0–100, null = ยังไม่มี request วันนี้ */
  uptime: number | null;
  uptimeRequests: number;
  /** tokens รวมทุกผู้ใช้จากตาราง requests */
  tokens: number;
  requests: number;
  requiredPlanLabel: string | null;
};

type SortKey = "popular" | "name" | "price" | "uptime";
type PriceBand = "all" | "free" | "low" | "mid" | "high";

function maxPrice(model: ExplorerModel): number {
  return Math.max(model.inputPricePerM, model.outputPricePerM);
}

function inPriceBand(model: ExplorerModel, band: PriceBand): boolean {
  const price = maxPrice(model);
  switch (band) {
    case "free":
      return price === 0;
    case "low":
      return price > 0 && price <= 1;
    case "mid":
      return price > 1 && price <= 5;
    case "high":
      return price > 5;
    default:
      return true;
  }
}

function uptimeClasses(uptime: number | null): string {
  if (uptime == null) return "bg-white/[0.06] text-fg-subtle";
  if (uptime >= 99) return "bg-leaf/10 text-leaf";
  if (uptime >= 95) return "bg-amber-glow/10 text-amber-glow";
  return "bg-rose-500/10 text-rose-300";
}

export default function ModelsExplorer({ models }: { models: ExplorerModel[] }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("popular");
  const [price, setPrice] = useState<PriceBand>("all");

  const categories = useMemo(() => {
    const byName = new Map<string, string | null>();
    for (const model of models) {
      if (model.category && !byName.has(model.category.name)) {
        byName.set(model.category.name, model.category.logoUrl);
      }
    }
    return [...byName.entries()]
      .map(([name, logoUrl]) => ({ name, logoUrl }))
      .sort((a, b) => compareCategories(a.name, b.name));
  }, [models]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = models.filter((model) => {
      if (category !== "all" && model.category?.name !== category) return false;
      if (!inPriceBand(model, price)) return false;
      if (!q) return true;
      return [model.name, model.publicModel, model.description, model.category?.name ?? ""].some(
        (value) => value.toLowerCase().includes(q),
      );
    });

    out.sort((a, b) => {
      if (sort === "popular") return b.tokens - a.tokens || a.name.localeCompare(b.name);
      if (sort === "price") return maxPrice(a) - maxPrice(b) || a.name.localeCompare(b.name);
      if (sort === "uptime") return (b.uptime ?? -1) - (a.uptime ?? -1) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [models, query, category, sort, price]);

  const activeFilters = query.trim() !== "" || category !== "all" || price !== "all";

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setPrice("all");
  }

  return (
    <div className="space-y-4">
      {/* ค้นหา + หมวด + ตัวกรอง */}
      <div className="card space-y-3 p-4">
        <div className="relative">
          <Icon
            name="fa-magnifying-glass"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-caption text-fg-subtle"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ค้นหาโมเดล, id หรือหมวด...")}
            aria-label={t("ค้นหาโมเดล")}
            className="input pl-10 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("ล้างคำค้นหา")}
              className="touch-min-icon absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg"
            >
              <Icon name="fa-xmark" className="text-micro" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
            className={`touch-min inline-flex items-center rounded-md px-2.5 py-1 text-label transition-colors ${
              category === "all"
                ? "bg-brand-500/20 text-fg ring-1 ring-brand-400/40"
                : "bg-white/[0.05] text-fg-muted hover:bg-white/[0.09] hover:text-fg"
            }`}
          >
            {t("ทั้งหมด")}
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              aria-pressed={category === c.name}
              onClick={() => setCategory(c.name)}
              className={`touch-min inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-label transition-colors ${
                category === c.name
                  ? "bg-brand-500/20 text-fg ring-1 ring-brand-400/40"
                  : "bg-white/[0.05] text-fg-muted hover:bg-white/[0.09] hover:text-fg"
              }`}
            >
              {c.logoUrl && (
                <Image
                  src={c.logoUrl}
                  alt=""
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 shrink-0 rounded object-contain"
                />
              )}
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-label text-fg-subtle">
            {t("เรียงตาม")}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="input !w-auto !py-1.5 text-caption"
              aria-label={t("เรียงตาม")}
            >
              <option value="popular">{t("ความนิยม (tokens รวม)")}</option>
              <option value="name">{t("ชื่อโมเดล")}</option>
              <option value="price">{t("ราคาต่ำ → สูง")}</option>
              <option value="uptime">{t("uptime สูงสุด")}</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-label text-fg-subtle">
            {t("ราคา")}
            <select
              value={price}
              onChange={(e) => setPrice(e.target.value as PriceBand)}
              className="input !w-auto !py-1.5 text-caption"
              aria-label={t("กรองตามราคา")}
            >
              <option value="all">{t("ทั้งหมด")}</option>
              <option value="free">{t("ฟรี")}</option>
              <option value="low">{t("≤ $1 / 1M")}</option>
              <option value="mid">{t("$1–$5 / 1M")}</option>
              <option value="high">{t("> $5 / 1M")}</option>
            </select>
          </label>

          <p className="text-label text-fg-subtle sm:ml-auto">
            {t("แสดง {n} จาก {total} โมเดล", { n: filtered.length, total: models.length })}
          </p>
          {activeFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="touch-min self-start rounded-md px-2 py-1 text-label text-brand-300 transition hover:bg-white/[0.06] sm:self-auto"
            >
              {t("ล้างตัวกรอง")}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card px-5 py-12 text-center">
          <Icon name="fa-magnifying-glass" className="text-title text-fg-subtle" />
          <p className="mt-3 text-body-sm font-medium text-fg">{t("ไม่พบโมเดลที่ตรงกับตัวกรอง")}</p>
          <p className="mt-1 text-caption text-fg-subtle">
            {t("ลองเปลี่ยนคำค้นหา หมวด หรือช่วงราคา")}
          </p>
          <button type="button" onClick={clearFilters} className="btn-ghost mt-4 !py-2">
            <Icon name="fa-rotate-left" /> {t("ล้างตัวกรอง")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((model) => {
            const hasPrice = model.inputPricePerM > 0 || model.outputPricePerM > 0;
            const uptime = model.uptime;
            const uptimePct = uptime == null ? null : Math.round(uptime * 10) / 10;

            return (
              <section key={model.id} className="card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  {model.logoUrl ? (
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={model.logoUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="h-full w-full rounded-xl object-contain"
                      />
                    </span>
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-body-sm font-bold text-brand-300">
                      {model.name.charAt(0).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/models/${encodeURIComponent(model.publicModel)}`}
                        className="truncate text-body font-semibold text-fg transition hover:text-brand-300"
                        title={t("ดูรายละเอียด {name}", { name: model.name })}
                      >
                        {model.name}
                      </Link>
                      {model.requiredPlanLabel && (
                        <span
                          title={t("ต้องใช้แผน {plan} ขึ้นไป", { plan: model.requiredPlanLabel })}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-glow/10 px-2 py-0.5 text-label font-medium text-amber-glow"
                        >
                          <Icon name="fa-lock" className="text-micro" />
                          {model.requiredPlanLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/models/${encodeURIComponent(model.publicModel)}`}
                        className="truncate font-mono text-caption text-fg-subtle transition hover:text-fg"
                      >
                        {model.publicModel}
                      </Link>
                      <CopyButton value={model.publicModel} />
                      {model.category && (
                        <span className="text-label text-fg-subtle">· {model.category.name}</span>
                      )}
                    </div>
                  </div>
                </div>

                {model.description && (
                  <p className="mt-3 line-clamp-2 text-caption leading-relaxed text-fg-subtle">
                    {t(model.description)}
                  </p>
                )}

                {/* สถิติ: uptime วันนี้ + tokens รวมทั้งระบบ */}
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <span
                    title={
                      uptimePct == null
                        ? t("ยังไม่มี request วันนี้")
                        : t("uptime วันนี้ · {n} requests", { n: formatNumber(model.uptimeRequests) })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-label ${uptimeClasses(uptime)}`}
                  >
                    <Icon name="fa-signal" className="text-micro" />
                    {uptimePct == null ? t("uptime —") : `uptime ${uptimePct.toFixed(1)}%`}
                  </span>
                  <span
                    title={t("{n} tokens รวมทุกผู้ใช้ · {r} requests", {
                      n: formatNumber(model.tokens),
                      r: formatNumber(model.requests),
                    })}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] px-2 py-1 text-label text-fg-muted"
                  >
                    <Icon name="fa-chart-simple" className="text-micro text-brand-300" />
                    <span className="tnum font-semibold text-fg">{formatTokens(model.tokens)}</span>
                    tokens
                  </span>
                  {!hasPrice && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-leaf/10 px-2 py-1 text-label text-leaf">
                      <Icon name="fa-gift" className="text-micro" />
                      {t("ฟรี")}
                    </span>
                  )}
                  {model.supportsVision && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md bg-aqua/10 px-2 py-1 text-label text-aqua"
                      title={t("รองรับรูปภาพ")}
                    >
                      <Icon name="fa-image" className="text-micro" />
                      {t("รับรูปได้")}
                    </span>
                  )}
                  {model.contextWindow > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] px-2 py-1 text-label text-fg-muted">
                      <Icon name="fa-infinity" className="text-micro" />
                      <span className="tnum font-semibold text-fg">
                        {formatNumber(model.contextWindow)}
                      </span>
                      {t("คอนเท็กซ์")}
                    </span>
                  )}
                </div>

                {hasPrice && (
                  <div className="mt-4 rounded-lg bg-white/[0.03] px-3.5 py-3">
                    <p className="text-label font-medium uppercase tracking-wider text-fg-subtle">
                      {t("ราคา / 1M tokens")}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-caption">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-fg-subtle">INPUT</dt>
                        <dd className="tnum font-semibold text-fg">
                          {formatUsd(model.inputPricePerM)}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-fg-subtle">OUTPUT</dt>
                        <dd className="tnum font-semibold text-fg">
                          {formatUsd(model.outputPricePerM)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
