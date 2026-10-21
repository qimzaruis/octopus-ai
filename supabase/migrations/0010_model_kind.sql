-- ---------- ประเภทโมเดล: chat / image ----------
-- image = เรียกผ่าน /v1/images/generations ไม่ใช่ /v1/chat/completions
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'chat' NOT NULL;
