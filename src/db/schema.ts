import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  numeric,
  uniqueIndex,
  index,
  primaryKey,
  date,
  bigint,
} from "drizzle-orm/pg-core";

/** Mirror ของ supabase auth.users — เก็บ role, เครดิต และสถานะการใช้งาน */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // ตรงกับ auth.users.id
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"), // 'user' | 'admin'
  /** เครดิตคงเหลือหน่วย USD (เดิมเป็น THB) */
  credits: numeric("credits", { precision: 12, scale: 6, mode: "number" })
    .notNull()
    .default(0),
  /** แผนการใช้งาน: free | pro — กําหนดโควต้าต่อเดือน */
  plan: text("plan").notNull().default("free"),
  /** แบนบัญชี (ผู้ใช้ที่ถูกแบนเข้าใช้งานไม่ได้) */
  banned: boolean("banned").notNull().default(false),
  bannedReason: text("banned_reason").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Provider ต้นทาง (OpenAI-compatible endpoint) */
export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  /**
   * @deprecated เลิกใช้แล้ว — คีย์ย้ายไปตาราง provider_keys เพื่อรองรับหลายคีย์ต่อ provider
   * ยังเก็บคอลัมน์ไว้ไม่ให้ข้อมูลเดิมหาย แต่โค้ดใหม่ต้องอ่านจาก provider_keys เท่านั้น
   */
  apiKey: text("api_key").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * API key ของ provider — รองรับหลายคีย์ต่อ provider
 * เก็บสถิติสำหรับการหมุนคีย์อัตโนมัติเมื่อเจอ error / rate limit
 */
export const providerKeys = pgTable(
  "provider_keys",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    apiKey: text("api_key").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    /** คีย์หลัก — ถูกเลือกก่อนเมื่อพร้อมใช้งานเท่ากัน */
    isPrimary: boolean("is_primary").notNull().default(false),
    /** จำนวนครั้งที่ล้มเหลวติดกัน (รีเซ็ตเมื่อสําเร็จ) */
    failureCount: integer("failure_count").notNull().default(0),
    /** ห้ามใช้คีย์นี้จนถึงเวลานี้ (backoff หลัง error) */
    cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    /**
     * ---- สถานะ "ติดลิมิต" ของโควต้าค่าย (ดูตาราง provider_key_limits) ----
     * ต่างจาก cooldownUntil ตรงนี้เป็นลิมิตระดับโควต้าที่ไม่หายเองuntil รีเซต
     * จึงพักยาวถึงเวลารีเซตของค่าย แล้วค่อยกลับมาหมุนใช้เองอัตโนมัติ
     */
    limitUntil: timestamp("limit_until", { withTimezone: true }),
    /** เหตุผลสั้น ๆ ที่ทำให้ติดลิมิต เช่น "402 insufficient_quota" */
    limitReason: text("limit_reason").notNull().default(""),
    lastLimitedAt: timestamp("last_limited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    providerIdx: index("provider_keys_provider_idx").on(t.providerId),
  }),
);

/**
 * กติกา "คีย์ติดลิมิต" ของแต่ละ provider (แอดมินตั้งที่ /admin/key-limits)
 *
 * สำคัญ: ลิมิตของโควต้าต่าง behaviour กันตามค่าย — บางค่ายตอบ 402 + code
 * `insufficient_quota` เมื่อเครดิตหมดและรีเซตเป็นเวลาประจำทุกวัน ส่วนค่ายอื่น
 * อาจใช้ 429 พร้อม header รีเซตคนละแบบ จึงตั้งเป็นข้อมูลต่อรายแทนที่จะ hardcode
 * ชื่อค่ายในโค้ด แล้ว match กับ 3 ช่องทาง (HTTP status / error code / คำในข้อความ)
 */
export const providerKeyLimits = pgTable("provider_key_limits", {
  providerId: integer("provider_id")
    .primaryKey()
    .references(() => providers.id, { onDelete: "cascade" }),
  /** ปิด = ไม่ใช้กฎนี้กับ provider นี้เลย (คีย์ล้มเหลวจะกลับไปใช้ backoff ปกติ) */
  enabled: boolean("enabled").notNull().default(false),
  /** HTTP status ที่ถือว่า "คีย์นี้ติดลิมิต" เช่น [402, 429] */
  httpStatuses: integer("http_statuses").array().notNull(),
  /** ค่า error.code / error.type ใน body ที่ถือว่าตรง (เทียบแบบไม่สนตัวพิมพ์) */
  errorCodes: text("error_codes").array().notNull(),
  /** คำที่ถ้าพบใน body ถือว่าติดลิมิต (เทียบแบบไม่สนตัวพิมพ์) */
  keywords: text("keywords").array().notNull(),
  /** เวลา "HH:MM" ที่โควต้าของค่ายนี้รีเซต */
  resetTime: text("reset_time").notNull().default("13:00"),
  resetTimezone: text("reset_timezone").notNull().default("Asia/Bangkok"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** คลังรูปที่อัปโหลดขึ้น Supabase Storage — อัปครั้งเดียวแล้วเลือกใช้ซ้ำได้ */
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  /** ชื่อที่แสดงในคลัง เช่น "OpenAI" */
  name: text("name").notNull().default(""),
  /** path ใน bucket (ใช้ลบไฟล์) */
  storagePath: text("storage_path").notNull(),
  /** URL สาธารณะสำหรับ render */
  publicUrl: text("public_url").notNull(),
  mimeType: text("mime_type").notNull().default(""),
  sizeBytes: integer("size_bytes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** โมเดลของแต่ละ provider */
export const models = pgTable(
  "models",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(),
    displayName: text("display_name").notNull(),
    /** chat = แชท/ข้อความ, image = สร้างรูปผ่าน /images/generations */
    kind: text("kind").notNull().default("chat"),
    contextWindow: integer("context_window").notNull().default(128000),
    supportsVision: boolean("supports_vision").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    /** แสดงโมเดลนี้ให้ผู้ใช้ทั่วไปเห็นในหน้า /models หรือไม่ (admin คุมได้) */
    visibleToUsers: boolean("visible_to_users").notNull().default(true),
    /** ราคา USD ต่อ 1M input tokens */
    inputPricePerM: numeric("input_price_per_m", { precision: 12, scale: 6, mode: "number" })
      .notNull()
      .default(0),
    /** ราคา USD ต่อ 1M output tokens */
    outputPricePerM: numeric("output_price_per_m", { precision: 12, scale: 6, mode: "number" })
      .notNull()
      .default(0),
    /** โลโก้ที่แสดงแทนชื่อผู้ให้บริการ (URL จากคลังรูป Supabase Storage) */
    logoUrl: text("logo_url"),
    /**
     * ---- สถิติวันนี้ (เก็บในคอลัมน์ ไม่ต้อง scan ตาราง requests) ----
     * logRequest เป็นตัวบวกตัวเลขทุกรอบที่ผ่าน gateway ทั้งจาก /v1 และ Web Agent
     * uptimeDay ต่างจากวันนี้ (เวลากรุงเทพฯ) = ตัวเลขค้างจากเมื่อวาน จะเริ่มนับใหม่เอง
     */
    uptimeDay: date("uptime_day"),
    /** uptime วันนี้ 0–100 (%) */
    uptime: numeric("uptime", { precision: 5, scale: 2, mode: "number" }).notNull().default(100),
    uptimeRequests: integer("uptime_requests").notNull().default(0),
    /** ในจำนวนข้างบนนี้มีกี่รอบที่สำเร็จ */
    uptimeOk: integer("uptime_ok").notNull().default(0),
    /** ผลรวม latency (ms) — เอาไปเฉลี่ยกับ uptimeRequests ตอนอ่าน */
    uptimeLatencyMs: integer("uptime_latency_ms").notNull().default(0),
    uptimeTokens: bigint("uptime_tokens", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    providerModelUq: uniqueIndex("models_provider_model_uq").on(t.providerId, t.modelId),
  }),
);

/**
 * หมวด/แบรนด์ของโมเดล — ชื่อและรูปอยู่ด้วยกันเพราะเป็น "เจ้าของโมเดล" ตัวเดียวกัน
 * ใช้จัดกลุ่มในตัวเลือกโมเดลและหน้า /models (แอดมินสร้าง/แก้ได้ที่ /admin/models)
 */
export const routeCategories = pgTable("route_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** โลโก้ของหมวด (URL จากคลังรูป) — route ในหมวดนี้ใช้รูปเดียวกัน */
  logoUrl: text("logo_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Route: ชื่อโมเดลสาธารณะที่ลูกข่ายเรียก เช่น octopus-pro */
export const routes = pgTable(
  "routes",
  {
    id: serial("id").primaryKey(),
    publicModel: text("public_model").notNull(),
    /** หมวด/แบรนด์ของโมเดล (null = ยังไม่จัดหมวด) */
    categoryId: integer("category_id").references(() => routeCategories.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull().default(""),
    /**
     * วิธีแสดงผลต่อผู้ใช้ในหน้า /models
     * - router : แสดงเป็นรายการเดียว (ชื่อ route เป็นหลัก) ไม่กางโมเดลปลายทาง
     * - model  : แสดงเป็นกลุ่ม แล้วกางรายชื่อโมเดลปลายทาง (fallback) ใต้ลงไป
     */
    displayMode: text("display_mode").notNull().default("router"),
    /** ชื่อที่ผู้ใช้เห็น (ว่าง = ใช้ publicModel) */
    displayName: text("display_name").notNull().default(""),
    /** โลโก้ของ route (เลือกจากคลังรูป — ใช้เมื่อ displayMode = router) */
    logoUrl: text("logo_url"),
    /** ราคาที่แสดงต่อผู้ใช้ USD / 1M tokens (0 = ไม่ระบุ) */
    inputPricePerM: numeric("input_price_per_m", { precision: 12, scale: 6, mode: "number" })
      .notNull()
      .default(0),
    outputPricePerM: numeric("output_price_per_m", { precision: 12, scale: 6, mode: "number" })
      .notNull()
      .default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    publicModelUq: uniqueIndex("routes_public_model_uq").on(t.publicModel),
  }),
);

/**
 * แผนการใช้งาน + โควต้า (แอดมินแก้ได้จากหน้า /admin/plans)
 *
 * โควต้าเป็น USD: ต่อรอบ (cycle) เป็นเพดานหลัก และมี sub-quota รายวันได้
 * ถ้าโควต้ารอบเต็ม ระบบบล็อกทันทีโดยไม่รีเซตรายวัน (ตามที่ออกแบบไว้)
 */
export const plans = pgTable("plans", {
  key: text("key").primaryKey(), // free | pro | ...
  label: text("label").notNull().default(""),
  /** ความยาวรอบรีเซตเป็นวัน (1 / 7 / 30) */
  cycleDays: integer("cycle_days").notNull().default(30),
  /** โควต้า USD ต่อรอบ */
  cycleQuotaUsd: numeric("cycle_quota_usd", { precision: 12, scale: 6, mode: "number" })
    .notNull()
    .default(0),
  /** sub-quota รายวัน USD (0 = ไม่ตั้งเพดานรายวัน) */
  dailyQuotaUsd: numeric("daily_quota_usd", { precision: 12, scale: 6, mode: "number" })
    .notNull()
    .default(0),
  /** เพดานจำนวน requests ต่อรอบ (0 = ไม่จํากัด) */
  cycleRequests: integer("cycle_requests").notNull().default(0),
  concurrentModels: integer("concurrent_models").notNull().default(3),
  fallback: boolean("fallback").notNull().default(false),
  /** ลำดับขั้นของแผน (0 = ฟรี, สูงขึ้น = แผนที่สูงกว่า) ใช้เทียบสิทธิ์โมเดล */
  tier: integer("tier").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * โมเดลที่แต่ละแผนใช้งานได้ — แอดมินจัดชุดได้จากหน้า /admin/plans
 * โมเดลที่ไม่อยู่ในแผนใดเลย = ใช้ได้ทุกแผน (ไม่จำกัด)
 */
export const planModels = pgTable(
  "plan_models",
  {
    planKey: text("plan_key")
      .notNull()
      .references(() => plans.key, { onDelete: "cascade" }),
    modelRefId: integer("model_ref_id")
      .notNull()
      .references(() => models.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.planKey, t.modelRefId] }),
  }),
);

/** Target ของ route เรียงตาม priority (fallback ไล่จากบนลงล่าง) */
export const routeTargets = pgTable("route_targets", {
  id: serial("id").primaryKey(),
  routeId: integer("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  modelRefId: integer("model_ref_id")
    .notNull()
    .references(() => models.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
});

/** API key ของผู้ใช้ (จำกัด 3 คีย์ต่อคน) */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    secret: text("secret").notNull(),
    revoked: boolean("revoked").notNull().default(false),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("api_keys_user_idx").on(t.userId),
  }),
);

/** Log การเรียกใช้ AI ทุกครั้ง */
export const requests = pgTable(
  "requests",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    apiKeyId: integer("api_key_id"),
    providerName: text("provider_name").notNull().default(""),
    model: text("model").notNull(),
    publicModel: text("public_model").notNull().default(""),
    agent: text("agent").notNull().default(""),
    status: text("status").notNull(), // success | error | rate_limited
    httpStatus: integer("http_status").notNull().default(200),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    /** ค่าใช้จ่ายของ request นี้ หน่วย USD (คํานวณจากราคาโมเดล ณ เวลาที่เรียก) */
    costUsd: numeric("cost_usd", { precision: 12, scale: 6, mode: "number" })
      .notNull()
      .default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("requests_user_created_idx").on(t.userId, t.createdAt),
    createdIdx: index("requests_created_idx").on(t.createdAt),
    apiKeyIdx: index("requests_api_key_idx").on(t.apiKeyId),
  }),
);

/** ประวัติเครดิต (ระบบเติมเงิน — เตรียมไว้ก่อน) */
export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** จํานวนเงิน USD (บวก = เติม, ลบ = หัก) */
    amount: numeric("amount", { precision: 12, scale: 6, mode: "number" })
      .notNull()
      .default(0),
    type: text("type").notNull(), // topup | usage | admin_adjust | grant
    status: text("status").notNull().default("completed"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("credit_tx_user_idx").on(t.userId),
  }),
);

/**
 * ค่าตั้งค่าของเว็บแบบ key/value — แก้ใน DB แล้วมีผลโดยไม่ต้อง deploy ใหม่
 * คีย์ที่ใช้อยู่: site_url = โดเมนจริงของเว็บ (ใช้สร้าง redirectTo ของ OAuth,
 * ลิงก์แชร์ไฟล์, system prompt และ metadata)
 */
export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type ProviderKey = typeof providerKeys.$inferSelect;
export type ProviderKeyLimit = typeof providerKeyLimits.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Model = typeof models.$inferSelect;
export type RouteCategory = typeof routeCategories.$inferSelect;
export type Route = typeof routes.$inferSelect;
export type RouteTarget = typeof routeTargets.$inferSelect;
export type PlanRow = typeof plans.$inferSelect;
export type PlanModel = typeof planModels.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type RequestRow = typeof requests.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
