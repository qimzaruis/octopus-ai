ALTER TABLE "credit_transactions" ALTER COLUMN "amount" SET DATA TYPE numeric(12, 6);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "credits" SET DATA TYPE numeric(12, 6);--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "visible_to_users" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "input_price_per_m" numeric(12, 6) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "output_price_per_m" numeric(12, 6) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "requests_api_key_idx" ON "requests" USING btree ("api_key_id");