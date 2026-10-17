-- ============================================================================
-- Octopus AI — สร้างตารางทั้งหมด (8 ตาราง) + foreign keys + indexes
-- วิธีใช้: คัดลอกทั้งไฟล์นี้ไปวางใน Supabase Dashboard > SQL Editor > Run
-- ปลอดภัยต่อการรันซ้ำ (IF NOT EXISTS / duplicate_object ถูกกลืน)
--
-- ตรงกับ schema ปัจจุบันใน src/db/schema.ts (migration 0000 + 0001):
--   - users: role / credits(USD numeric) / plan / banned / banned_reason / avatar_url
--   - models: visible_to_users / input_price_per_m / output_price_per_m (USD)
--   - requests: cost_usd (USD numeric)
--   - credit_transactions: amount (USD numeric)
-- ============================================================================

-- ---------- ตาราง ----------

CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"role" text DEFAULT 'user' NOT NULL,
	"credits" numeric(12, 6) DEFAULT 0 NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"banned_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "models" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"model_id" text NOT NULL,
	"display_name" text NOT NULL,
	"context_window" integer DEFAULT 128000 NOT NULL,
	"supports_vision" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"visible_to_users" boolean DEFAULT true NOT NULL,
	"input_price_per_m" numeric(12, 6) DEFAULT 0 NOT NULL,
	"output_price_per_m" numeric(12, 6) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_model" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "route_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"route_id" integer NOT NULL,
	"model_ref_id" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"secret" text NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" integer,
	"provider_name" text DEFAULT '' NOT NULL,
	"model" text NOT NULL,
	"public_model" text DEFAULT '' NOT NULL,
	"agent" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"http_status" integer DEFAULT 200 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(12, 6) NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ---------- คอลัมน์ที่อาจหายไปถ้าตารางถูกสร้างจากเวอร์ชันเก่า ----------
-- (รันซ้ำได้: ถ้ามีคอลัมน์แล้ว ADD COLUMN IF NOT EXISTS จะข้ามให้)

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'free' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banned_reason" text DEFAULT '' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "visible_to_users" boolean DEFAULT true NOT NULL;
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "input_price_per_m" numeric(12, 6) DEFAULT 0 NOT NULL;
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "output_price_per_m" numeric(12, 6) DEFAULT 0 NOT NULL;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL;
ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "api_key_id" integer;

-- ---------- Foreign keys (ข้ามถ้ามีอยู่แล้ว) ----------
DO $$ BEGIN
 ALTER TABLE "models" ADD CONSTRAINT "models_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "route_targets" ADD CONSTRAINT "route_targets_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "route_targets" ADD CONSTRAINT "route_targets_model_ref_id_models_id_fk" FOREIGN KEY ("model_ref_id") REFERENCES "public"."models"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "requests" ADD CONSTRAINT "requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS "api_keys_user_idx" ON "api_keys" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "credit_tx_user_idx" ON "credit_transactions" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "models_provider_model_uq" ON "models" USING btree ("provider_id","model_id");
CREATE INDEX IF NOT EXISTS "requests_user_created_idx" ON "requests" USING btree ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "requests_created_idx" ON "requests" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "requests_api_key_idx" ON "requests" USING btree ("api_key_id");
CREATE UNIQUE INDEX IF NOT EXISTS "routes_public_model_uq" ON "routes" USING btree ("public_model");

-- ---------- ตารางที่เพิ่มภายหลัง (migration 0002) ----------

-- คีย์หลายอันต่อ provider + สถิติสําหรับหมุนคีย์อัตโนมัติ
CREATE TABLE IF NOT EXISTS "provider_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"cooldown_until" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- คลังรูปที่อัปโหลดขึ้น Supabase Storage (อัปครั้งเดียวใช้ซ้ำได้)
CREATE TABLE IF NOT EXISTS "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text NOT NULL,
	"mime_type" text DEFAULT '' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "logo_url" text;

DO $$ BEGIN
 ALTER TABLE "provider_keys" ADD CONSTRAINT "provider_keys_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "provider_keys_provider_idx" ON "provider_keys" USING btree ("provider_id");

-- ย้ายคีย์เดิมจาก providers.api_key เข้า provider_keys (ข้ามถ้ามีคีย์อยู่แล้ว)
INSERT INTO "provider_keys" ("provider_id", "label", "api_key", "is_primary", "enabled")
SELECT "id", 'main', "api_key", true, true
FROM "providers"
WHERE "api_key" <> ''
  AND NOT EXISTS (SELECT 1 FROM "provider_keys" pk WHERE pk."provider_id" = "providers"."id");

-- ---------- ตารางที่เพิ่มภายหลัง (migration 0003) ----------

-- routing: โหมดแสดงผล + ราคา + โลโก้
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "display_mode" text DEFAULT 'router' NOT NULL;
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "display_name" text DEFAULT '' NOT NULL;
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "logo_url" text;
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "input_price_per_m" numeric(12, 6) DEFAULT 0 NOT NULL;
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "output_price_per_m" numeric(12, 6) DEFAULT 0 NOT NULL;

-- แผนการใช้งาน: โควต้า USD ต่อรอบ + sub-quota รายวัน (แอดมินแก้ได้)
CREATE TABLE IF NOT EXISTS "plans" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"cycle_days" integer DEFAULT 30 NOT NULL,
	"cycle_quota_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"daily_quota_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"cycle_requests" integer DEFAULT 0 NOT NULL,
	"concurrent_models" integer DEFAULT 3 NOT NULL,
	"fallback" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "plans" ("key","label","cycle_days","cycle_quota_usd","daily_quota_usd","concurrent_models","fallback")
VALUES
  ('free','Free',7,5,1,3,false),
  ('pro','Pro',30,50,5,20,true)
ON CONFLICT ("key") DO NOTHING;

-- ตั้งชื่อที่แสดงให้ route เดิม (ถ้ายังว่าง) เพื่อให้หน้า /models มีชื่อสวย ๆ ตั้งแต่แรก
UPDATE "routes"
SET "display_name" = initcap(replace("public_model", '-', ' '))
WHERE "display_name" = '';

-- ---------- ตรวจผล ----------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;