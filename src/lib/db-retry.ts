/**
 * Retry สั้น ๆ สำหรับ query ที่ล้มเพราะ connection หลุด/สระว่ายน้ำเต็ม
 *
 * Supabase pooler (session mode) ตอบ EMAXCONNSESSION / connection timeout เป็นครั้งคราว
 * ซึ่งรอบถัดไปมักสำเร็จ — เดิมเราปล่อยให้ครั้งเดียวล้มแล้วเปิดวงจร 15 วินาที
 * ทำให้หน้าเว็บขึ้น "ไม่มีข้อมูล" ทั้งที่ DB ยังใช้งานได้
 */
const TRANSIENT =
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|EMAXCONNSESSION|too many clients|remaining connection slots|Connection terminated|connection .*closed|server closed the connection|timeout|57P01|57P03|08003|08006|53300/i;

export function isTransientDbError(err: unknown): boolean {
  const text =
    err instanceof Error ? `${err.name}: ${err.message}` : typeof err === "string" ? err : JSON.stringify(err);
  return TRANSIENT.test(text);
}

export async function withDbRetry<T>(
  run: () => Promise<T>,
  attempts = 2,
  delayMs = 200,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await run();
    } catch (err) {
      last = err;
      if (i === attempts - 1 || !isTransientDbError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw last;
}
