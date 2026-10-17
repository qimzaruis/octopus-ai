CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text NOT NULL,
	"mime_type" text DEFAULT '' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_keys" (
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
--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "provider_keys" ADD CONSTRAINT "provider_keys_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provider_keys_provider_idx" ON "provider_keys" USING btree ("provider_id");--> statement-breakpoint
INSERT INTO "provider_keys" ("provider_id", "label", "api_key", "is_primary", "enabled")
SELECT "id", 'main', "api_key", true, true
FROM "providers"
WHERE "api_key" <> ''
  AND NOT EXISTS (SELECT 1 FROM "provider_keys" pk WHERE pk."provider_id" = "providers"."id");