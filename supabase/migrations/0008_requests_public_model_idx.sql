-- ---------- index สำหรับยอดรวม tokens ต่อโมเดล (หน้า /models) ----------
-- หน้า /models อ่าน sum(input_tokens + output_tokens) group by public_model
-- จากตาราง requests โดยไม่จำกัดช่วงเวลา — index นี้ทำให้ group by ไม่ต้อง scan ทั้งตาราง
CREATE INDEX IF NOT EXISTS "requests_public_model_idx" ON "requests" USING btree ("public_model");
