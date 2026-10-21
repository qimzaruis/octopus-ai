-- ---------- config: ค่าตั้งค่าของเว็บแบบ key/value ----------
-- site_url = โดเมนจริง ใช้สร้าง redirectTo ของ OAuth, ลิงก์แชร์, system prompt, metadata
-- เปลี่ยนโดเมนภายหลังได้ด้วย:
--   UPDATE "config" SET value = 'https://โดเมนใหม่', updated_at = now() WHERE key = 'site_url';
CREATE TABLE IF NOT EXISTS "config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "config" ("key", "value")
VALUES ('site_url', 'https://octopus-ai.isdev.dpdns.org')
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
