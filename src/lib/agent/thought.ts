/**
 * ล้าง reasoning ก่อนแสดงในแชท
 *
 * reasoning ของโมเดลอาจพูดถึง system prompt, ชื่อค่าย, รหัสโมเดล หรือ route id
 * ผู้ใช้ไม่ควรเห็นข้อมูลเหล่านั้น จึงตัดเป็นประโยคและทิ้งประโยคที่กล่าวถึงสิ่งภายใน
 * ถ้าล้างแล้วไม่เหลืออะไร ให้แสดงเฉพาะกล่อง "กำลังคิด" โดยไม่มีข้อความ
 */
import { maskInternalNames, type InternalIdentities } from "@/lib/public-text";

const SENSITIVE =
  /system prompt|system message|developer message|developer instruction|hidden instruction|route id|upstream|api key|instructions?|\bprompt\b|\bsystem\b|\[ค่าย\]|\[ปลายทาง\]|คำสั่งระบบ|พรอมต์ระบบ|พรอมต์|รหัสโมเดล|ผู้ให้บริการ|คีย์/i;

export function sanitizeThought(text: string, ids: InternalIdentities): string {
  const masked = maskInternalNames(text, ids, 8000);
  return masked
    .split(/(?<=[.!?。\n])/)
    .filter((sentence) => !SENSITIVE.test(sentence))
    .join("")
    .trim();
}
