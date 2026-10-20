/**
 * ค้นเว็บให้ Web Agent — ฝั่งเบราว์เซอร์เรียก API ของเรา แล้วเซิร์ฟเวอร์ไปใช้ Bright Data SERP
 *
 * คีย์ของผู้ให้บริการอยู่บนเครื่องเซิร์ฟเวอร์ (env) ไม่เคยส่งลงมาในเบราว์เซอร์
 * ถ้าโควตาหมดหรือคีย์เสีย จะโยน SearchUnavailable ให้ UI ไปเตือนผู้ใช้ต่อ
 */

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  rank: number;
};

export type SearchErrorCode = "not-configured" | "unavailable" | "bad-key" | "empty";

export class SearchUnavailable extends Error {
  constructor(
    message: string,
    readonly code: SearchErrorCode,
  ) {
    super(message);
    this.name = "SearchUnavailable";
  }
}

export async function webSearch(
  query: string,
  count = 6,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const res = await fetch("/api/agent/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: count }),
    cache: "no-store",
    signal,
  }).catch(() => null);

  if (!res) throw new SearchUnavailable("ค้นเว็บตอนนี้ไม่สามารถใช้ได้", "unavailable");

  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    code?: SearchErrorCode;
    message?: string;
    results?: SearchResult[];
  } | null;

  if (!res.ok || !data) {
    throw new SearchUnavailable(
      data?.message ?? "ค้นเว็บตอนนี้ไม่สามารถใช้ได้",
      data?.code ?? "unavailable",
    );
  }
  if (data.ok === false) {
    throw new SearchUnavailable(data.message ?? "ค้นเว็บตอนนี้ไม่สามารถใช้ได้", data.code ?? "unavailable");
  }
  return data.results ?? [];
}
