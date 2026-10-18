/**
 * Circuit breaker กลางสำหรับ DB ที่เข้าถึงไม่ได้ (เช่น port 5432 ถูก firewall บล็อก)
 *
 * ใช้ร่วมกันทั้ง auth และ data layer เพื่อไม่ให้ทุกหน้าค้าง/ล่มเมื่อ DB ไม่พร้อม
 * ช่วง "เปิดวงจร" ตั้งสั้น ๆ เพราะระหว่างนี้หน้าเว็บจะเห็นข้อมูลว่าง
 * ถ้าตั้งนานเกินไป DB แค่กระตุกครั้งเดียวก็ทำให้ทั้งเว็บเงียบไปหนึ่งนาที
 */
const OPEN_MS = 15_000;
let dbUnavailableUntil = 0;

export function isDbUnavailable(): boolean {
  return Date.now() < dbUnavailableUntil;
}

export function markDbUnavailable(err?: unknown): void {
  dbUnavailableUntil = Date.now() + OPEN_MS;
  if (err) console.error("[db] DB ใช้ไม่ได้ชั่วคราว:", err);
  else console.warn("[db] DB ถูกข้ามชั่วคราว (circuit breaker)");
}

export function resetDbCircuit(): void {
  dbUnavailableUntil = 0;
}