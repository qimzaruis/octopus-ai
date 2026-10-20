-- ---------- หมวด/แบรนด์ของโมเดล (ชื่อ + โลโก้รวมเป็นรายการเดียว) ----------
CREATE TABLE IF NOT EXISTS "route_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "category_id" integer;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "routes" ADD CONSTRAINT "routes_category_id_route_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."route_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- ย้ายโลโก้เดิมของ route ที่ตรงกับรูปในคลังให้กลายเป็นหมวดอัตโนมัติ
INSERT INTO "route_categories" ("name", "logo_url")
SELECT DISTINCT a."name", a."public_url"
FROM "routes" r
JOIN "assets" a ON a."public_url" = r."logo_url"
WHERE NOT EXISTS (
  SELECT 1 FROM "route_categories" c WHERE c."name" = a."name"
);--> statement-breakpoint

UPDATE "routes" r
SET "category_id" = c."id"
FROM "route_categories" c
WHERE r."category_id" IS NULL
  AND r."logo_url" IS NOT NULL
  AND c."logo_url" = r."logo_url";
