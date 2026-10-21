-- ---------- index สำหรับ uptime 24 ชม. ต่อโมเดล (หน้า /models) ----------
-- query: where public_model = ? and created_at >= (now - 24h) group by public_model
CREATE INDEX IF NOT EXISTS "requests_public_created_idx"
  ON "requests" USING btree ("public_model", "created_at");
