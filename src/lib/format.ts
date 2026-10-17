/** Utilities สำหรับ format ตัวเลข/เวลาในหน้า UI */

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${n}`;
}

export function formatTokens(n: number): string {
  return formatCompact(n);
}

const TH_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const EN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * วันที่แบบสั้น อ่านง่าย
 *
 * ต้องรับ locale เข้ามาเพราะสองภาษาใช้ทั้งชื่อเดือนและปีต่างระบบ:
 * ไทยใช้ชื่อเดือนย่อแบบไทยและปีพุทธศักราช (ค.ศ. + 543) อังกฤษใช้ปี ค.ศ. ตรง ๆ
 * ค่าเริ่มต้นเป็นไทยเพื่อให้จุดที่ยังไม่ส่ง locale มาพฤติกรรมเดิมไม่เปลี่ยน
 */
export function formatDateTime(iso: string, locale: "th" | "en" = "th"): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (locale === "en") {
    return `${EN_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${time}`;
  }
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} · ${time}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
    d.getSeconds(),
  ).padStart(2, "0")}`;
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

/**
 * เงินในระบบเป็น USD ทั้งหมด
 * - ค่ามาก (>= $100) แสดง 2 ตําแหน่ง
 * - ค่าน้อยแสดงทศนิยมละเอียดขึ้นเพื่อไม่ให้เห็นเป็น $0.00
 */
export function formatUsd(n: number, opts: { decimals?: number; compact?: boolean } = {}): string {
  const v = Number.isFinite(n) ? n : 0;
  if (opts.compact && Math.abs(v) >= 1000) {
    return `$${formatCompact(Math.round(v))}`;
  }
  let digits = opts.decimals;
  if (digits === undefined) {
    const abs = Math.abs(v);
    if (abs === 0) digits = 2;
    else if (abs < 0.01) digits = 4;
    else if (abs < 1) digits = 3;
    else digits = 2;
  }
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** แสดงค่าเงินแบบมีเครื่องหมาย +/- (ใช้กับการเติม/หักเครดิต) */
export function formatUsdSigned(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatUsd(Math.abs(v))}`;
}

export function maskKey(secret: string): string {
  if (secret.length <= 12) return secret;
  return `${secret.slice(0, 11)}${"•".repeat(12)}`;
}
