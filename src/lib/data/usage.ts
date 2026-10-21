import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { cached } from "@/lib/catalog-cache";
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";
import { withDbRetry } from "@/lib/db-retry";
import { internalIdentities, maskInternals } from "@/lib/public-text";

/** Timezone ที่ใช้ bucket ข้อมูลกราฟ */
const APP_TZ = "Asia/Bangkok";
const TZ_OFFSET_MS = 7 * 3600_000;

export type RangeKey = "hourly" | "7d" | "30d";

export type UsageBucket = {
  label: string;
  fullLabel: string;
  requests: number;
  tokens: number;
  /** ค่าใช้จ่ายของ bucket นี้ หน่วย USD */
  cost: number;
};

export type ModelRank = {
  /** ชื่อ route ที่ผู้ใช้เรียกจริง (ไม่เปิดเผยโมเดล/ค่ายปลายทาง) */
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  errors: number;
  costUsd: number;
};

export type Overview = {
  requests: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  avgLatencyMs: number;
  errors: number;
  successRate: number;
  costUsd: number;
};

/**
 * ประวัติ request ที่ผู้ใช้เปิดดูได้ (หน้า /requests, /dashboard)
 *
 * ไม่มีคอลัมน์ `model` ของตาราง requests เพราะคอลัมน์นั้นเก็บ id ปลายทางจริงที่
 * บอกรหัสของค่ายต้นทาง — ส่งให้ client เมื่อไรรวมถึง payload ของ RSC คือหลุดทันที
 * ผู้ใช้จึงเห็นเฉพาะ `publicModel` (route ที่ตัวเองเรียก) เท่านั้น
 */
export type RequestDTO = {
  id: number;
  publicModel: string;
  agent: string;
  status: string;
  httpStatus: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  error: string | null;
  createdAt: string; // ISO
};

/** สรุปรายโมเดลสาธารณะ (route) ที่ผู้ใช้เรียกได้ */
export type PublicModelSummary = {
  publicModel: string;
  description: string;
  enabled: boolean;
  targets: number;
  requests: number;
  tokens: number;
  costUsd: number;
};

/** userId = "all" สำหรับ admin view */
export type Scope = string | "all";

// ---------------------------------------------------------------------------
// สถิติทุกฟังก์ชันอ่านจากตาราง requests ด้วย SQL ผ่าน Drizzle เท่านั้น
// DB อ่านไม่ได้ → คืนค่าว่าง/ศูนย์ ไม่มีตัวเลขสมมติส่งให้หน้าเว็บ
// ---------------------------------------------------------------------------

async function rawRows(query: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
  const db = getDb();
  const res = (await withDbRetry(() => db.execute(query))) as unknown;
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  return (res as { rows: Record<string, unknown>[] }).rows ?? [];
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

async function getUsageReal(scope: Scope, range: RangeKey): Promise<UsageBucket[]> {
  const userFilter = scope === "all" ? sql`` : sql` and user_id = ${scope}`;

  if (range === "hourly") {
    const rows = await rawRows(sql`
      with params as (
        select date_trunc('hour', (now() at time zone ${APP_TZ})) as now_hour
      )
      select
        extract(hour from (created_at at time zone ${APP_TZ}))::int as h,
        count(*)::int as requests,
        coalesce(sum(input_tokens + output_tokens), 0)::int as tokens,
        coalesce(sum(cost_usd), 0)::float8 as cost
      from requests, params
      where date_trunc('hour', (created_at at time zone ${APP_TZ})) <= params.now_hour
        and (created_at at time zone ${APP_TZ})::date = (params.now_hour)::date${userFilter}
      group by 1
    `);
    const nowHourBkk = new Date(Date.now() + TZ_OFFSET_MS).getUTCHours();
    const map = new Map<number, { requests: number; tokens: number; cost: number }>();
    for (const r of rows)
      map.set(num(r.h), { requests: num(r.requests), tokens: num(r.tokens), cost: num(r.cost) });
    const buckets: UsageBucket[] = [];
    for (let h = 0; h <= nowHourBkk; h++) {
      const v = map.get(h) ?? { requests: 0, tokens: 0, cost: 0 };
      const hh = String(h).padStart(2, "0");
      buckets.push({ label: `${hh}:00`, fullLabel: `วันนี้ ${hh}:00 น.`, ...v });
    }
    return buckets;
  }

  const days = range === "7d" ? 6 : 29;
  const joinFilter = scope === "all" ? sql`` : sql` and r.user_id = ${scope}`;
  const rows = await rawRows(sql`
    with days as (
      select generate_series(
        ((now() at time zone ${APP_TZ})::date - ${days}::int),
        (now() at time zone ${APP_TZ})::date,
        interval '1 day'
      )::date as d
    )
    select
      to_char(days.d, 'DD/MM') as label,
      coalesce(count(r.id), 0)::int as requests,
      coalesce(sum(r.input_tokens + r.output_tokens), 0)::int as tokens,
      coalesce(sum(r.cost_usd), 0)::float8 as cost
    from days
    left join requests r
      on (r.created_at at time zone ${APP_TZ})::date = days.d${joinFilter}
    group by days.d, label
    order by days.d
  `);

  return rows.map((r) => ({
    label: String(r.label),
    fullLabel: `${String(r.label)}`,
    requests: num(r.requests),
    tokens: num(r.tokens),
    cost: num(r.cost),
  }));
}

export async function getUsage(scope: Scope, range: RangeKey): Promise<UsageBucket[]> {
  if (isDbUnavailable()) return [];
  try {
    return await getUsageReal(scope, range);
  } catch (err) {
    markDbUnavailable(err);
    return [];
  }
}

// ---------------------------------------------------------------------------

async function getModelRankingReal(scope: Scope, limit: number): Promise<ModelRank[]> {
  // นับเฉพาะแถวที่มี public_model — คอลัมน์ model เก็บ id ของปลายทางจริง
  // ซึ่งบอกรหัสของค่ายต้นทาง จึงห้ามเอามาแสดงหน้าผู้ใช้เด็ดขาด
  const where = scope === "all" ? sql`public_model <> ''` : sql`public_model <> '' and user_id = ${scope}`;
  const rows = await rawRows(sql`
    select
      public_model as model,
      count(*)::int as requests,
      coalesce(sum(input_tokens), 0)::int as input_tokens,
      coalesce(sum(output_tokens), 0)::int as output_tokens,
      coalesce(avg(latency_ms), 0)::int as avg_latency,
      coalesce(sum(cost_usd), 0)::float8 as cost,
      coalesce(sum(case when status != 'success' then 1 else 0 end), 0)::int as errors
    from requests
    where ${where}
    group by public_model
    order by coalesce(sum(input_tokens + output_tokens), 0) desc
    limit ${limit}
  `);
  return rows.map((r) => ({
    model: String(r.model),
    requests: num(r.requests),
    inputTokens: num(r.input_tokens),
    outputTokens: num(r.output_tokens),
    totalTokens: num(r.input_tokens) + num(r.output_tokens),
    avgLatencyMs: num(r.avg_latency),
    errors: num(r.errors),
    costUsd: num(r.cost),
  }));
}

export async function getModelRanking(scope: Scope, limit = 8): Promise<ModelRank[]> {
  if (isDbUnavailable()) return [];
  try {
    return await getModelRankingReal(scope, limit);
  } catch (err) {
    markDbUnavailable(err);
    return [];
  }
}

// ---------------------------------------------------------------------------

async function getOverviewReal(scope: Scope): Promise<Overview> {
  const userFilter = scope === "all" ? sql`` : sql` where user_id = ${scope}`;
  const rows = await rawRows(sql`
    select
      count(*)::int as requests,
      coalesce(sum(input_tokens), 0)::int as input_tokens,
      coalesce(sum(output_tokens), 0)::int as output_tokens,
      coalesce(avg(latency_ms), 0)::int as avg_latency,
      coalesce(sum(cost_usd), 0)::float8 as cost,
      coalesce(sum(case when status != 'success' then 1 else 0 end), 0)::int as errors
    from requests
    ${userFilter}
  `);
  const r = rows[0] ?? {};
  const requests = num(r.requests);
  const errors = num(r.errors);
  const inputTokens = num(r.input_tokens);
  const outputTokens = num(r.output_tokens);
  return {
    requests,
    inputTokens,
    outputTokens,
    tokens: inputTokens + outputTokens,
    avgLatencyMs: num(r.avg_latency),
    errors,
    successRate: requests === 0 ? 100 : ((requests - errors) / requests) * 100,
    costUsd: num(r.cost),
  };
}

/** ค่า "ไม่มีข้อมูล" — เหมือนตาราง requests ว่าง ไม่ใช่ตัวเลขที่แต่งขึ้น */
const EMPTY_OVERVIEW: Overview = {
  requests: 0,
  tokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  avgLatencyMs: 0,
  errors: 0,
  successRate: 100,
  costUsd: 0,
};

export async function getOverview(scope: Scope): Promise<Overview> {
  if (isDbUnavailable()) return EMPTY_OVERVIEW;
  try {
    return await getOverviewReal(scope);
  } catch (err) {
    markDbUnavailable(err);
    return EMPTY_OVERVIEW;
  }
}

// ---------------------------------------------------------------------------
// ยอดรวมตามช่วงเวลา — ใช้ใน "สรุปการใช้งาน" (เดือนนี้ / ทั้งหมด)
// ---------------------------------------------------------------------------

export type UsagePeriod = "month" | "all";

export type UsageTotals = { requests: number; tokens: number; costUsd: number };

async function getUsageTotalsReal(scope: Scope, period: UsagePeriod): Promise<UsageTotals> {
  const monthFilter = sql`date_trunc('month', (created_at at time zone ${APP_TZ})) = date_trunc('month', (now() at time zone ${APP_TZ}))`;
  const where =
    scope === "all"
      ? period === "month"
        ? sql` where ${monthFilter}`
        : sql``
      : period === "month"
        ? sql` where user_id = ${scope} and ${monthFilter}`
        : sql` where user_id = ${scope}`;
  const rows = await rawRows(sql`
    select
      count(*)::int as requests,
      coalesce(sum(input_tokens + output_tokens), 0)::int as tokens,
      coalesce(sum(cost_usd), 0)::float8 as cost
    from requests
    ${where}
  `);
  const r = rows[0] ?? {};
  return { requests: num(r.requests), tokens: num(r.tokens), costUsd: num(r.cost) };
}

export async function getUsageTotals(
  scope: Scope,
  period: UsagePeriod,
): Promise<UsageTotals> {
  if (isDbUnavailable()) return { requests: 0, tokens: 0, costUsd: 0 };
  try {
    return await getUsageTotalsReal(scope, period);
  } catch (err) {
    markDbUnavailable(err);
    return { requests: 0, tokens: 0, costUsd: 0 };
  }
}

/**
 * ยอดใช้จ่าย (USD) ในช่วงเวลาที่กำหนด — ใช้คิดโควต้าแบบรอบ/daily
 *
 * แยกจาก getUsageTotals เพราะโควต้าต้องการ "ช่วงเวลาที่คำนวณได้" (rolling window)
 * ไม่ใช่เดือนปฏิทิน และต้องการทั้งยอดรอบและยอดวันพร้อมกันในคิวรีเดียว
 */
export async function getSpendInWindows(
  scope: Scope,
  windows: { cycleSince: Date; daySince: Date },
): Promise<{ cycleSpendUsd: number; dailySpendUsd: number }> {
  // DB สะดุด: ใช้ยอดล่าสุดที่อ่านได้ (ยังอยู่ในรอบ/วันเดียวกัน) แทนการรีเซ็ตเป็น 0
  const cached = lastGoodSpend.get(scope);
  if (isDbUnavailable() && cached) return cached;

  try {
    const userCond = scope === "all" ? sql`1=1` : sql`user_id = ${scope}`;
    const rows = await rawRows(sql`
      select
        coalesce(sum(case when created_at >= ${windows.cycleSince.toISOString()} then cost_usd else 0 end), 0)::float8 as cycle_cost,
        coalesce(sum(case when created_at >= ${windows.daySince.toISOString()} then cost_usd else 0 end), 0)::float8 as day_cost
      from requests
      where ${userCond}
    `);
    const r = rows[0] ?? {};
    const out = { cycleSpendUsd: num(r.cycle_cost), dailySpendUsd: num(r.day_cost) };
    lastGoodSpend.set(scope, out);
    return out;
  } catch (err) {
    markDbUnavailable(err);
    return cached ?? { cycleSpendUsd: 0, dailySpendUsd: 0 };
  }
}

// ---------------------------------------------------------------------------
// หน้า dashboard: ทุกตัวเลขใน query เดียว
//
// หนึ่งรอบไป Supabase pooler จากเครื่องผู้ใช้วัดได้ ~400ms และการยิงหลายคิวรีซ้อนกัน
// บน connection เดียวไม่ได้ทำให้ขนานกันจริง (postgres.js ต้องรอคิวรีก่อนจบ)
// เดิมหน้านี้เรียก 9 คิวรี = ค้าง ~8 วินาที ทั้งที่ข้อมูลทั้งหมดอยู่ในตารางเดียว
// รวมเป็น statement เดียวจึงเหลือ 1 รอบ + 1 scan ของตาราง requests
// ---------------------------------------------------------------------------

export type DashboardFacts = {
  overview: Overview;
  hourly: UsageBucket[];
  daily7: UsageBucket[];
  daily30: UsageBucket[];
  ranking: ModelRank[];
  spend: { cycleSpendUsd: number; dailySpendUsd: number };
};

/** แดชบอร์ดชุดล่าสุดต่อ scope — DB สะดุดสั้น ๆ ไม่ควรทำให้ทั้งหน้าเป็นศูนย์ */
const lastGoodFacts = new Map<string, DashboardFacts>();
const lastGoodRequests = new Map<string, { items: RequestDTO[]; total: number }>();
const lastGoodSpend = new Map<string, { cycleSpendUsd: number; dailySpendUsd: number }>();

const EMPTY_FACTS: DashboardFacts = {
  overview: { ...EMPTY_OVERVIEW },
  hourly: [],
  daily7: [],
  daily30: [],
  ranking: [],
  spend: { cycleSpendUsd: 0, dailySpendUsd: 0 },
};

function jsonArr(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** วันที่แบบ YYYY-MM-DD ของ "ตอนนี้ในกรุงเทพฯ" (ไทยไม่มี DST จึงบวก offset ตรง ๆ ได้) */
function bkkDateKey(offsetDays = 0): string {
  const d = new Date(Date.now() + TZ_OFFSET_MS - offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** สร้างแถวรายวันย้อนหลัง n วัน (รวมวันนี้) จากของจริงที่ DB ส่งมา — วันที่ไม่มีข้อมูล = 0 */
function daySeries(rows: Record<string, unknown>[], days: number): UsageBucket[] {
  const byDay = new Map(rows.map((r) => [String(r.d), r]));
  const out: UsageBucket[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const key = bkkDateKey(back);
    const [, mm, dd] = key.split("-");
    const r = byDay.get(key) ?? {};
    out.push({
      label: `${dd}/${mm}`,
      fullLabel: `${dd}/${mm}`,
      requests: num(r.requests),
      tokens: num(r.tokens),
      cost: num(r.cost),
    });
  }
  return out;
}

export async function getDashboardFacts(
  scope: Scope,
  cycleSince: Date,
  daySince: Date,
  rankLimit = 6,
): Promise<DashboardFacts> {
  const cacheKey = `${scope}:${rankLimit}`;
  const cached = lastGoodFacts.get(cacheKey);
  if (isDbUnavailable() && cached) return cached;

  const scopeFilter = scope === "all" ? sql`` : sql`where user_id = ${scope}`;

  try {
    const rows = await rawRows(sql`
      with mine as materialized (
        select created_at, input_tokens, output_tokens, cost_usd, latency_ms, status, public_model
        from requests
        ${scopeFilter}
      ),
      hr as (
        select extract(hour from (created_at at time zone ${APP_TZ}))::int as h,
               count(*)::int as requests,
               coalesce(sum(input_tokens + output_tokens), 0)::int as tokens,
               coalesce(sum(cost_usd), 0)::float8 as cost
        from mine
        where date_trunc('hour', (created_at at time zone ${APP_TZ}))
                <= date_trunc('hour', (now() at time zone ${APP_TZ}))
          and (created_at at time zone ${APP_TZ})::date = ((now() at time zone ${APP_TZ})::date)
        group by 1
      ),
      dy as (
        select ((created_at at time zone ${APP_TZ})::date)::text as d,
               count(*)::int as requests,
               coalesce(sum(input_tokens + output_tokens), 0)::int as tokens,
               coalesce(sum(cost_usd), 0)::float8 as cost
        from mine
        where (created_at at time zone ${APP_TZ})::date
                >= ((now() at time zone ${APP_TZ})::date - 29)
        group by 1
      ),
      ov as (
        select count(*)::int as requests,
               coalesce(sum(input_tokens), 0)::int as input_tokens,
               coalesce(sum(output_tokens), 0)::int as output_tokens,
               coalesce(avg(latency_ms), 0)::int as avg_latency,
               coalesce(sum(cost_usd), 0)::float8 as cost,
               coalesce(sum(case when status != 'success' then 1 else 0 end), 0)::int as errors
        from mine
      ),
      rk as (
        select public_model as model,
               count(*)::int as requests,
               coalesce(sum(input_tokens), 0)::int as input_tokens,
               coalesce(sum(output_tokens), 0)::int as output_tokens,
               coalesce(avg(latency_ms), 0)::int as avg_latency,
               coalesce(sum(cost_usd), 0)::float8 as cost,
               coalesce(sum(case when status != 'success' then 1 else 0 end), 0)::int as errors
        from mine
        where public_model <> ''
        group by 1
        order by coalesce(sum(input_tokens + output_tokens), 0) desc
        limit ${rankLimit}
      ),
      sp as (
        select coalesce(sum(case when created_at >= ${cycleSince.toISOString()}::timestamptz then cost_usd else 0 end), 0)::float8 as cycle_cost,
               coalesce(sum(case when created_at >= ${daySince.toISOString()}::timestamptz then cost_usd else 0 end), 0)::float8 as day_cost
        from mine
      )
      select
        (select jsonb_agg(o) from ov o) as overview,
        (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'requests', requests, 'tokens', tokens, 'cost', cost) order by h), '[]'::jsonb) from hr) as hourly,
        (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'requests', requests, 'tokens', tokens, 'cost', cost) order by d), '[]'::jsonb) from dy) as daily,
        (select coalesce(jsonb_agg(jsonb_build_object('model', model, 'requests', requests, 'inputTokens', input_tokens, 'outputTokens', output_tokens, 'totalTokens', input_tokens + output_tokens, 'avgLatencyMs', avg_latency, 'errors', errors, 'costUsd', cost) order by (input_tokens + output_tokens) desc), '[]'::jsonb) from rk) as ranking,
        (select jsonb_agg(s) from sp s) as spend
    `);

    const row = rows[0] ?? {};
    const ov = jsonArr(row.overview)[0] ?? {};
    const sp = jsonArr(row.spend)[0] ?? {};
    const requests = num(ov.requests);
    const errors = num(ov.errors);
    const inputTokens = num(ov.input_tokens);
    const outputTokens = num(ov.output_tokens);

    const hourMap = new Map(jsonArr(row.hourly).map((r) => [num(r.h), r]));
    const nowHourBkk = new Date(Date.now() + TZ_OFFSET_MS).getUTCHours();
    const hourly: UsageBucket[] = [];
    for (let h = 0; h <= nowHourBkk; h += 1) {
      const v = hourMap.get(h) ?? {};
      const hh = String(h).padStart(2, "0");
      hourly.push({
        label: `${hh}:00`,
        fullLabel: `วันนี้ ${hh}:00 น.`,
        requests: num(v.requests),
        tokens: num(v.tokens),
        cost: num(v.cost),
      });
    }

    const daily = jsonArr(row.daily);
    const facts: DashboardFacts = {
      overview: {
        requests,
        inputTokens,
        outputTokens,
        tokens: inputTokens + outputTokens,
        avgLatencyMs: num(ov.avg_latency),
        errors,
        successRate: requests === 0 ? 100 : ((requests - errors) / requests) * 100,
        costUsd: num(ov.cost),
      },
      hourly,
      daily7: daySeries(daily, 7),
      daily30: daySeries(daily, 30),
      ranking: jsonArr(row.ranking).map((r) => ({
        model: String(r.model ?? ""),
        requests: num(r.requests),
        inputTokens: num(r.inputTokens),
        outputTokens: num(r.outputTokens),
        totalTokens: num(r.totalTokens),
        avgLatencyMs: num(r.avgLatencyMs),
        errors: num(r.errors),
        costUsd: num(r.costUsd),
      })),
      spend: { cycleSpendUsd: num(sp.cycle_cost), dailySpendUsd: num(sp.day_cost) },
    };
    lastGoodFacts.set(cacheKey, facts);
    return facts;
  } catch (err) {
    markDbUnavailable(err);
    return cached ?? EMPTY_FACTS;
  }
}

// ---------------------------------------------------------------------------

export type RequestFilter = { page?: number; perPage?: number; q?: string; status?: string };

async function listRequestsReal(
  scope: Scope,
  filter: RequestFilter,
): Promise<{ items: RequestDTO[]; total: number }> {
  const db = getDb();
  const page = filter.page ?? 1;
  const perPage = filter.perPage ?? 20;
  const conds = [sql`1=1`];
  if (scope !== "all") conds.push(sql`user_id = ${scope}`);
  if (filter.q) {
    const like = `%${filter.q.toLowerCase()}%`;
    // ไม่ค้นหาในคอลัมน์ model — เป็น id ปลายทางจริงที่ผู้ใช้ค้นเดาเพื่อ "ถาม" ระบบว่าคืออะไรได้
    conds.push(sql`(lower(public_model) like ${like} or lower(agent) like ${like})`);
  }
  if (filter.status && filter.status !== "all") {
    conds.push(sql`status = ${filter.status}`);
  }
  const where = sql.join(conds, sql` and `);

  // count(*) over () = ได้จำนวนทั้งชุดมากับหน้าปัจจุบันใน query เดียว
  // (เดิมนับหนึ่งรอบ แล้วดึงอีกหนึ่งรอบ = จ่ายค่าเดินทางไป Supabase เกินมาหนึ่งเท่า)
  const rows = await rawRows(sql`
    select id, public_model, agent, status, http_status,
      input_tokens, output_tokens, latency_ms, cost_usd, error, created_at,
      count(*) over ()::int as total
    from requests
    where ${where}
    order by created_at desc
    limit ${perPage} offset ${(page - 1) * perPage}
  `);

  let total = num(rows[0]?.total);
  if (rows.length === 0) {
    // หน้าเปล่า (offset เลยจำนวนจริง) ยังต้องส่งจำนวนทั้งหมดให้ตัวแบ่งหน้าถูกต้อง
    const countRows = await rawRows(sql`select count(*)::int as c from requests where ${where}`);
    total = num(countRows[0]?.c);
  }

  // แถวเก่าที่เก็บก่อนมีกติกานียังมีชื่อค่ายค้างอยู่ในคอลัมน์ error — ล้างตอนอ่านด้วย
  const ids = await internalIdentities();

  return {
    items: rows.map((r) => ({
      id: num(r.id),
      publicModel: String(r.public_model ?? ""),
      agent: String(r.agent ?? ""),
      status: String(r.status),
      httpStatus: num(r.http_status),
      inputTokens: num(r.input_tokens),
      outputTokens: num(r.output_tokens),
      latencyMs: num(r.latency_ms),
      costUsd: num(r.cost_usd),
      error: r.error ? maskInternals(String(r.error), ids) : null,
      createdAt: new Date(r.created_at as string).toISOString(),
    })),
    total,
  };
}

export async function listRequests(
  scope: Scope,
  filter: RequestFilter = {},
): Promise<{ items: RequestDTO[]; total: number }> {
  const cacheKey = `${scope}:${filter.page ?? 1}:${filter.perPage ?? 20}:${filter.q ?? ""}:${filter.status ?? "all"}`;
  const cached = lastGoodRequests.get(cacheKey);
  if (isDbUnavailable() && cached) return cached;

  try {
    const out = await listRequestsReal(scope, filter);
    if (lastGoodRequests.size >= 100) lastGoodRequests.clear();
    lastGoodRequests.set(cacheKey, out);
    return out;
  } catch (err) {
    markDbUnavailable(err);
    return cached ?? { items: [], total: 0 };
  }
}

// ---------------------------------------------------------------------------
// สรุปการใช้งานรายโมเดลสาธารณะ (route) — ใช้ในหน้า /models
// ---------------------------------------------------------------------------

async function getPublicModelUsageReal(
  scope: Scope,
): Promise<Map<string, { requests: number; tokens: number; costUsd: number }>> {
  const userFilter = scope === "all" ? sql`` : sql` where user_id = ${scope}`;
  const rows = await rawRows(sql`
    select
      public_model,
      count(*)::int as requests,
      coalesce(sum(input_tokens + output_tokens), 0)::bigint as tokens,
      coalesce(sum(cost_usd), 0)::float8 as cost
    from requests
    ${userFilter}
    group by public_model
  `);
  const map = new Map<string, { requests: number; tokens: number; costUsd: number }>();
  for (const r of rows) {
    map.set(String(r.public_model ?? ""), {
      requests: num(r.requests),
      tokens: num(r.tokens),
      costUsd: num(r.cost),
    });
  }
  return map;
}

const lastGoodPublicUsage = new Map<
  string,
  Map<string, { requests: number; tokens: number; costUsd: number }>
>();

// ---------------------------------------------------------------------------
// Uptime 24 ชม.ล่าสุด — นับจาก request จริงในตาราง requests (ทุกผู้ใช้)
// ---------------------------------------------------------------------------

export type PublicModelHealth = { requests: number; ok: number };

async function getPublicModelHealthReal(): Promise<Map<string, PublicModelHealth>> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const rows = await rawRows(sql`
    select public_model,
           count(*)::int as requests,
           count(*) filter (where status = 'success')::int as ok
    from requests
    where public_model <> ''
      and created_at >= ${since}
    group by public_model
  `);
  const map = new Map<string, PublicModelHealth>();
  for (const r of rows) {
    map.set(String(r.public_model ?? ""), {
      requests: num(r.requests),
      ok: num(r.ok),
    });
  }
  return map;
}

let lastGoodPublicHealth: Map<string, PublicModelHealth> | null = null;

export async function getPublicModelHealth24h(): Promise<Map<string, PublicModelHealth>> {
  if (isDbUnavailable() && lastGoodPublicHealth) return lastGoodPublicHealth;
  try {
    const value = await cached("public-health:24h", 30_000, getPublicModelHealthReal);
    lastGoodPublicHealth = value;
    return value;
  } catch (err) {
    markDbUnavailable(err);
    return lastGoodPublicHealth ?? new Map();
  }
}

export async function getPublicModelUsage(
  scope: Scope,
): Promise<Map<string, { requests: number; tokens: number; costUsd: number }>> {
  const snapshot = lastGoodPublicUsage.get(scope);
  if (isDbUnavailable() && snapshot) return snapshot;
  try {
    // หน้า /models เปิดบ่อยแต่ยอดรวมเปลี่ยนช้า — แคชสั้น ๆ พอ
    const value = await cached(`public-usage:${scope}`, 30_000, () =>
      getPublicModelUsageReal(scope),
    );
    lastGoodPublicUsage.set(scope, value);
    return value;
  } catch (err) {
    markDbUnavailable(err);
    return snapshot ?? new Map();
  }
}

// ---------------------------------------------------------------------------
// การใช้งานราย API key — ใช้ในหน้า /keys
// ---------------------------------------------------------------------------

export type KeyUsage = { requests: number; tokens: number; costUsd: number };

async function getKeyUsageReal(scope: Scope): Promise<Map<number, KeyUsage>> {
  const userCond = scope === "all" ? sql`` : sql`user_id = ${scope} and `;
  const rows = await rawRows(sql`
    select
      api_key_id,
      count(*)::int as requests,
      coalesce(sum(input_tokens + output_tokens), 0)::int as tokens,
      coalesce(sum(cost_usd), 0)::float8 as cost
    from requests
    where ${userCond} api_key_id is not null
    group by api_key_id
  `);
  const map = new Map<number, KeyUsage>();
  for (const r of rows) {
    if (r.api_key_id == null) continue;
    map.set(num(r.api_key_id), {
      requests: num(r.requests),
      tokens: num(r.tokens),
      costUsd: num(r.cost),
    });
  }
  return map;
}

export async function getKeyUsage(scope: Scope): Promise<Map<number, KeyUsage>> {
  if (isDbUnavailable()) return new Map();
  try {
    return await getKeyUsageReal(scope);
  } catch (err) {
    markDbUnavailable(err);
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// สุขภาพของ route (ใช้แสดงในกล่องรายละเอียดโมเดล)
// ---------------------------------------------------------------------------

export type RouteHealth = {
  /** จำนวน request ของวันนี้ (เที่ยงคืนกรุงเทพฯ) */
  requests: number;
  /** สัดส่วนที่สำเร็จ (0–1) — แสดงเป็น uptime */
  successRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  /** ไม่มีข้อมูลเลย (ยังไม่เคยถูกเรียก) */
  empty: boolean;
};

/**
 * สถิติ 24 ชม.ล่าสุดของ route — นับจาก request จริงในตาราง requests
 *
 * ต่างจากคอลัมน์รายวันในตาราง models: คอลัมน์นั้นรีเซ็ตเที่ยงคืนและรวมตามโมเดลปลายทาง
 * ทำให้ route ที่ไม่ได้ถูกเรียกวันนี้ดูเหมือน "ไม่มีข้อมูล" และโมเดลที่สำเร็จครั้งเดียว
 * ขึ้น 100% โดยไม่เห็นภาพรวม. การอ่านจาก requests โดยตรงทำให้ uptime สะท้อนสิ่งที่
 * ผู้ใช้เจอจริง (fallback/error ถูกนับรวม) และบอกช่วงเวลา 24 ชม.ได้
 */
async function getRouteHealthReal(publicModel: string): Promise<RouteHealth> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const rows = await rawRows(sql`
    select count(*)::int as requests,
           count(*) filter (where status = 'success')::int as ok,
           coalesce(avg(latency_ms), 0)::int as avg_latency,
           coalesce(sum(input_tokens + output_tokens), 0)::bigint as tokens
    from requests
    where public_model = ${publicModel}
      and created_at >= ${since}
  `);
  const r = rows[0] ?? {};
  const total = num(r.requests);
  return {
    requests: total,
    successRate: total > 0 ? num(r.ok) / total : 1,
    avgLatencyMs: total > 0 ? Math.round(num(r.avg_latency)) : 0,
    totalTokens: num(r.tokens),
    empty: total === 0,
  };
}

/**
 * สถิติวันนี้ของ route — ยังไม่เคยถูกเรียก (หรืออ่าน DB ไม่ได้) คืน empty = "ยังไม่มีข้อมูล"
 *
 * แคชไว้สั้น ๆ เพราะกดเปิดกล่องรายละเอียดซ้ำไม่ควรยิง query ซ้ำทุกครั้ง
 * ตัวเลขในคอลัมน์ถูกบวกทุก request ที่จบ จึงค้างสุดแค่ช่วงสั้นเท่านั้น
 */
const HEALTH_TTL_MS = 20_000;
const healthCache = new Map<string, { at: number; value: RouteHealth }>();

/** ค่า "ไม่มีข้อมูล" — เหมือน route ที่ยังไม่เคยถูกเรียก ไม่ได้แต่งตัวเลข */
const NO_HEALTH: RouteHealth = {
  requests: 0,
  successRate: 1,
  avgLatencyMs: 0,
  totalTokens: 0,
  empty: true,
};

export async function getRouteHealth(publicModel: string): Promise<RouteHealth> {
  if (isDbUnavailable()) return NO_HEALTH;
  const hit = healthCache.get(publicModel);
  if (hit && Date.now() - hit.at < HEALTH_TTL_MS) return hit.value;
  try {
    const value = await getRouteHealthReal(publicModel);
    healthCache.set(publicModel, { at: Date.now(), value });
    return value;
  } catch (err) {
    markDbUnavailable(err);
    return NO_HEALTH;
  }
}
