import { purgeDeletedConversations } from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** จำนวนวันที่เก็บห้องที่ผู้ใช้ลบไปแล้วไว้ให้แอดมินตรวจย้อนหลัง */
const RETENTION_DAYS = 30;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * งานประจำวัน: ลบห้องที่ผู้ใช้ลบไปแล้วและเก่ากว่า RETENTION_DAYS ออกจาก Turso
 *
 * ตั้งเวลาใน vercel.json — Vercel จะส่ง header `Authorization: Bearer $CRON_SECRET` มาเอง
 * ถ้ายังไม่ได้ใส่ CRON_SECRET ใน environment ให้ตอบ 503 (ไม่ลบอะไรทั้งนั้น)
 * ดีกว่าปล่อยให้ endpoint ลบข้อมูลได้โดยไม่มีใครยืนยันตัว
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return json({ error: "cron_not_configured", hint: "ตั้ง CRON_SECRET ใน environment ก่อน" }, 503);
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const before = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  try {
    const purged = await purgeDeletedConversations(before);
    return json({ ...purged, retentionDays: RETENTION_DAYS, olderThan: before }, 200);
  } catch (err) {
    console.error("[cron] prune chat failed:", err);
    return json({ error: "chat_db_unavailable" }, 503);
  }
}
