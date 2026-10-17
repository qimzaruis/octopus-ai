-- ---------- routing: โหมดแสดงผล + ราคา + โลโก้ ----------
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "display_mode" text DEFAULT 'router' NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "display_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "logo_url" text;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "input_price_per_m" numeric(12, 6) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "output_price_per_m" numeric(12, 6) DEFAULT 0 NOT NULL;--> statement-breakpoint

-- ---------- แผนการใช้งาน (โควต้า USD ต่อรอบ + sub-quota รายวัน) ----------
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
