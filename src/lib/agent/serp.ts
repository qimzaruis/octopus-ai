/**
 * ค้นหาเว็บผ่าน Bright Data SERP API
 *
 * เรียกจากเซิร์ฟเวอร์เท่านั้น (คีย์อยู่ใน env ไม่เคยส่งลงเบราว์เซอร์)
 * เอกสาร: POST https://api.brightdata.com/request
 *   header  Authorization: Bearer <BRIGHTDATA_API_KEY>
 *   body    { zone, url, format: "json" }
 * ผลลัพธ์ที่ได้คือ JSON ของ Google ทั้งหน้า ซึ่งเรามีสิทธิ์ใช้ 5,000–10,000 ครั้ง/เดือน
 * ถ้าโควตาหมดหรือคีย์มีปัญหา จะคืน ok:false พร้อมเหตุผลให้ UI ไปเตือนผู้ใช้ต่อ
 */

export type SerpResult = { title: string; url: string; snippet: string; rank: number };

export type SerpOutcome =
  | { ok: true; results: SerpResult[]; engine: "brightdata" }
  | {
      ok: false;
      code: "not-configured" | "unavailable" | "bad-key" | "empty";
      message: string;
    };

const REQUEST_URL = "https://api.brightdata.com/request";
/** การ scrape จริงใช้ราว 10-15 วินาที จึงเผื่อไว้พอสมควร */
const TIMEOUT_MS = 60_000;

/** ไม่บังคับว่าต้องมี — ใส่ใน .env ได้ถ้า zone ของคุณไม่ใช่ค่า default ของ Bright Data */
function zone(): string {
  return (process.env.BRIGHTDATA_SERP_ZONE ?? "serp_api1").trim();
}

function apiKey(): string {
  return (process.env.BRIGHTDATA_API_KEY ?? "").trim();
}

/**
 * ใส่แค่ q — ทดสอบแล้วว่าพารามิเตอร์อื่นทำให้ Bright Data ปฏิเสธ
 * ("query parameters have unacceptable name and/or value") หรือ Google แปลผลไม่สำเร็จ
 */
function buildGoogleUrl(query: string): string {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  return url.toString();
}

type BrightDataOrganic = {
  title?: string;
  link?: string;
  display_link?: string;
  description?: string;
  snippet?: string;
  rank?: number;
  global_rank?: number;
};

/** แยกให้ได้ว่า "ไม่มีฟิลด์ organic" (scrape ไม่สำเร็จ) กับ "organic ว่าง" (ค้นไม่เจอจริง) */
type ParsedSerp = { hasOrganic: boolean; results: SerpResult[] };

/**
 * Bright Data ส่งผลลัพธ์เป็นซอง { status_code, headers, body }
 * โดย body เป็น JSON string ของผลการ parse หน้า Google อีกชั้น
 */
type Envelope = {
  status_code?: number;
  headers?: Record<string, string>;
  body?: unknown;
};

function asEnvelope(payload: unknown): Envelope | null {
  const value = typeof payload === "string" ? safeParse(payload) : payload;
  return value && typeof value === "object" ? (value as Envelope) : null;
}

/** ถ้า scrape ล้ม Bright Data ยังตอบ HTTP 200 แต่ status_code ในซองจะเป็น 5xx */
function envelopeProblem(envelope: Envelope | null): string {
  if (!envelope) return "empty response";
  if (envelope.status_code && envelope.status_code !== 200) {
    return `${envelope.status_code} ${envelope.headers?.["x-brd-error"] ?? ""}`.trim();
  }
  return "";
}

function toResults(envelope: Envelope | null, count: number): ParsedSerp {
  const inner =
    typeof envelope?.body === "string" ? safeParse(envelope.body) : (envelope?.body as unknown);
  const organic = (inner as { organic?: BrightDataOrganic[] } | null)?.organic;
  if (!Array.isArray(organic)) return { hasOrganic: false, results: [] };
  const results = organic
    .map((row, i) => ({
      title: decodeEntities(row.title ?? "").trim(),
      url: row.link ?? row.display_link ?? "",
      snippet: decodeEntities(row.description ?? row.snippet ?? "").trim(),
      rank: Number(row.rank ?? row.global_rank ?? i + 1),
    }))
    .filter((r) => r.url)
    .slice(0, count);
  return { hasOrganic: true, results };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Google SERP มักมี HTML entity ติดมาในชื่อผลลัพธ์ */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, "");
}

async function attemptSerp(
  rawQuery: string,
  rawCount: number,
  signal?: AbortSignal,
): Promise<SerpOutcome> {
  const query = rawQuery.trim();
  if (!query) return { ok: false, code: "empty", message: "ไม่มีคำค้น" };
  const key = apiKey();
  if (!key) {
    return {
      ok: false,
      code: "not-configured",
      message: "ยังไม่ได้ตั้งค่า BRIGHTDATA_API_KEY บนเซิร์ฟเวอร์",
    };
  }
  const count = Math.min(20, Math.max(1, Math.round(rawCount)));

  let res: Response;
  try {
    res = await fetch(REQUEST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        zone: zone(),
        url: buildGoogleUrl(query),
        format: "json",
        data_format: "parsed",
      }),
      signal: signal
        ? AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), signal])
        : AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    // ผู้ใช้กดหยุดจากหน้าแชท — ไม่ใช่ความล้มเหลวของ Bright Data
    if (signal?.aborted) {
      return { ok: false, code: "unavailable", message: "ยกเลิกการค้นหาแล้ว" };
    }
    // หมดเวลา/เน็ตหลุด — โควตาหมดก็มักมาในรูปแบบนี้บ้าง จึงใช้ข้อความรวม
    console.error("[serp] brightdata request failed:", err);
    return { ok: false, code: "unavailable", message: "ค้นเว็บตอนนี้ไม่สามารถใช้ได้" };
  }

  if (res.status === 401 || res.status === 403) {
    // 403 คือทาง Bright Data ใช้ตอบตอนโควตา/เครดิตหมด (ไม่ระบุแยกไว้ในเอกสาร)
    return {
      ok: false,
      code: res.status === 401 ? "bad-key" : "unavailable",
      message:
        res.status === 401
          ? "ค้นเว็บตอนนี้ไม่สามารถใช้ได้ (คีย์ Bright Data ไม่ถูกต้อง)"
          : "ค้นเว็บตอนนี้ไม่สามารถใช้ได้ (โควตาค้นหาหมดหรือยังไม่ได้เปิดใช้งาน)",
    };
  }
  if (res.status === 429) {
    return { ok: false, code: "unavailable", message: "ค้นเว็บตอนนี้ติดจำกัดความถี่ กรุณาลองใหม่สักครู่" };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[serp] brightdata ${res.status}: ${detail.slice(0, 300)}`);
    // Bright Data ตอบ 400 พร้อมคำว่า zone เมื่อชื่อ zone ในบัญชีไม่ตรงกัน
    if (/zone/i.test(detail)) {
      return {
        ok: false,
        code: "not-configured",
        message:
          "ค้นเว็บตอนนี้ไม่สามารถใช้ได้ (ยังไม่ได้ตั้งค่า BRIGHTDATA_SERP_ZONE ให้ตรงกับชื่อ zone ของบัญชี)",
      };
    }
    return { ok: false, code: "unavailable", message: "ค้นเว็บตอนนี้ไม่สามารถใช้ได้" };
  }

  const envelope = asEnvelope(await res.json().catch(() => null));
  const problem = envelopeProblem(envelope);
  if (problem) {
    console.error("[serp] brightdata scrape failed:", problem);
    return { ok: false, code: "unavailable", message: "ค้นเว็บตอนนี้ไม่สามารถใช้ได้" };
  }
  const parsed = toResults(envelope, count);
  if (!parsed.hasOrganic) {
    return { ok: false, code: "unavailable", message: "ค้นเว็บตอนนี้ไม่สามารถใช้ได้" };
  }
  if (parsed.results.length === 0) {
    return { ok: true, engine: "brightdata", results: [] };
  }
  return { ok: true, engine: "brightdata", results: parsed.results };
}

/**
 * ค้น Google ผ่าน Bright Data พร้อมลองใหม่ 1 ครั้ง
 *
 * การ scrape หน้า Google ล้มเป็นครั้งคราว (Bright Data ตอบ 200 แต่ในซองเป็น 502
 * "waiting for selector #main failed") ซึ่งลองซ้ำแล้วมักได้ผล จึง retry เฉพาะ
 * กรณี "unavailable" ส่วนคีย์ผิด/ยังไม่ได้ตั้งค่า ลองซ้ำก็เสียเวลา
 */
export async function brightDataSearch(
  rawQuery: string,
  rawCount = 8,
  signal?: AbortSignal,
): Promise<SerpOutcome> {
  const first = await attemptSerp(rawQuery, rawCount, signal);
  if (first.ok || first.code !== "unavailable" || signal?.aborted) return first;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  if (signal?.aborted) return first;
  return attemptSerp(rawQuery, rawCount, signal);
}
