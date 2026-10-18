-- ---------- สุขภาพโมเดลวันนี้ (uptime) เก็บเป็นคอลัมน์ในตาราง models ----------
-- logRequest เป็นตัวบวกตัวเลขทุกรอบที่ผ่าน gateway ทำให้หน้ารายละเอียดโมเดลอ่านแถวเดียว
-- ไม่ต้อง query ย้อนหลังในตาราง requests อีก (ค่าเริ่ม 100% = ยังไม่ถูกเรียกวันนี้)
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "uptime_day" date;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "uptime" numeric(5, 2) DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "uptime_requests" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "uptime_ok" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "uptime_latency_ms" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "uptime_tokens" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint

-- ตารางสรุปที่เคยทดลองก่อนย้ายมาเก็บในตาราง models (ไม่มีที่ไหนใช้แล้ว)
DROP TABLE IF EXISTS "route_daily_stats";
