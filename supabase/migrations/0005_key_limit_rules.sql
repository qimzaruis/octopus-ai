-- ---------- กติกา "คีย์ติดลิมิต" ต่อ provider + สถานะลิมิตของคีย์แต่ละตัว ----------
-- คีย์ที่โควต้าของค่ายหมด (บางค่ายตอบ 402 insufficient_quota) ต้องพักยาวถึง
-- เวลารีเซตของค่ายนั้น ไม่ใช้ backoff สั้น ๆ ที่เด้งกลับมาพังซ้ำ จึงเก็บสถานะไว้บน
-- ตัวคีย์ และเก็บ "เงื่อนไขจับ" ไว้ต่อ provider เพราะแต่ละค่ายไม่เหมือนกัน
ALTER TABLE "provider_keys" ADD COLUMN IF NOT EXISTS "limit_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_keys" ADD COLUMN IF NOT EXISTS "limit_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_keys" ADD COLUMN IF NOT EXISTS "last_limited_at" timestamp with time zone;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "provider_key_limits" (
	"provider_id" integer PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"http_statuses" integer[] DEFAULT '{}' NOT NULL,
	"error_codes" text[] DEFAULT '{}' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"reset_time" text DEFAULT '13:00' NOT NULL,
	"reset_timezone" text DEFAULT 'Asia/Bangkok' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "provider_key_limits" ADD CONSTRAINT "provider_key_limits_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- กฎตั้งตนของทุก provider: เครดิตหมดโควตา → HTTP 402 / insufficient_quota รีเซตทุกวัน 13:00
-- (แอดมินแก้เงื่อนไข/เวลาต่อค่ายได้ที่ /admin/key-limits)
INSERT INTO "provider_key_limits"
  ("provider_id", "enabled", "http_statuses", "error_codes", "keywords", "reset_time", "reset_timezone")
SELECT p."id", true, '{402}', '{insufficient_quota}',
       '{"quota exceeded","enable overusage","upgrade your plan"}', '13:00', 'Asia/Bangkok'
FROM "providers" p
ON CONFLICT ("provider_id") DO NOTHING;
