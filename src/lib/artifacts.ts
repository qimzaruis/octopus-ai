import "server-only";
import { randomBytes } from "node:crypto";

const DEFAULT_CDN_BASE = "https://cdn.octopus-ai.isdev.dpdns.org";

/** อายุเริ่มต้นของ artifact — CDN จะลบให้หลังหมดอายุ */
export const ARTIFACT_TTL_DAYS = 7;
/** ขีดจำกัด HTML ของ CDN API */
export const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

export class CdnError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string,
  ) {
    super(message || code);
    this.name = "CdnError";
  }
}

export type CdnArtifact = {
  name: string;
  url: string;
  path?: string;
  passwordProtected?: boolean;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string | null;
};

/** ฐานของ CDN API — ตั้ง CDN_BASE_URL ได้ตอนพัฒนา/local */
export function cdnBaseUrl(): string {
  return (process.env.CDN_BASE_URL?.trim() || DEFAULT_CDN_BASE).replace(/\/+$/, "");
}

export function isCdnArtifactUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith(`${cdnBaseUrl()}/artifacts/`);
}

function apiKey(): string {
  const key = process.env.CDN_API_KEY?.trim();
  if (!key) {
    throw new CdnError("cdn_not_configured", 500, "CDN_API_KEY is not configured");
  }
  return key;
}

type ArtifactRequest = {
  method: "POST" | "PUT";
  body: string;
  headers?: Record<string, string>;
};

async function requestArtifact(path: string, init: ArtifactRequest): Promise<CdnArtifact> {
  let res: Response;
  try {
    res = await fetch(`${cdnBaseUrl()}${path}`, {
      method: init.method,
      headers: {
        "x-api-key": apiKey(),
        ...(init.headers ?? {}),
      },
      body: init.body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    if (err instanceof CdnError) throw err;
    throw new CdnError(
      "cdn_unreachable",
      502,
      err instanceof Error ? err.message : String(err),
    );
  }

  const data = (await res.json().catch(() => null)) as
    | (CdnArtifact & { error?: string; message?: string })
    | null;

  if (!res.ok || !data) {
    throw new CdnError(data?.error ?? "cdn_error", res.status, data?.message);
  }
  return data;
}

export function createArtifact(input: { name: string; html: string }): Promise<CdnArtifact> {
  return requestArtifact("/artifacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      html: input.html,
      ttlDays: ARTIFACT_TTL_DAYS,
    }),
  });
}

export function updateArtifact(input: { name: string; html: string }): Promise<CdnArtifact> {
  return requestArtifact(`/artifacts/${encodeURIComponent(input.name)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      html: input.html,
      ttlDays: ARTIFACT_TTL_DAYS,
    }),
  });
}

/**
 * ชื่อที่ CDN ยอมรับ: 1–64 ตัวอักษร เป็นตัวอักษร (รวมไทย)/ตัวเลข/`-`/`_`
 * อักขระอื่นกลายเป็น `-` เพื่อให้ผู้ใช้พิมพ์ชื่อมีเว้นวรรคหรือจุดได้
 */
export function sanitizeArtifactName(input: string): string | null {
  const cleaned = input
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!cleaned) return null;
  return Array.from(cleaned).slice(0, 64).join("");
}

/**
 * ชื่อสำรองเมื่อผู้ใช้ไม่ตั้ง — ใช้ชื่อไฟล์เป็นฐานแล้วต่อท้ายด้วยค่าสุ่ม
 * ใช้ฐานเฉพาะเมื่อเป็น ASCII: CDN เวอร์ชันปัจจุบันรับ \p{L} แต่ไม่รับ \p{M}
 * (สระ/วรรณยุกต์ไทย) ชื่อไทยจึงต้องเป็น artifact-<random> เพื่อไม่ให้อัปโหลดล้ม
 */
export function randomArtifactName(fileName?: string): string {
  const base = fileName
    ? sanitizeArtifactName(fileName.replace(/\.[a-z0-9]+$/i, ""))
    : null;
  const asciiBase = base && /^[A-Za-z0-9_-]+$/.test(base) ? base : null;
  const suffix = randomBytes(6).toString("hex");
  if (!asciiBase) return `artifact-${suffix}`;
  const budget = 64 - suffix.length - 1;
  return `${Array.from(asciiBase).slice(0, budget).join("")}-${suffix}`;
}
