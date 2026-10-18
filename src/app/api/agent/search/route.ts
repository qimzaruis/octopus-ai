import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { brightDataSearch } from "@/lib/agent/serp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/agent/search — ให้ Web Agent ค้นเว็บ
 *
 * คีย์ Bright Data อยู่ใน env ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่เคยส่งลงเบราว์เซอร์
 * คืน { ok:false, code, message } ตอนโควตาหมด/คีย์เสีย เพื่อให้ UI ไปเตือนผู้ใช้ต่อ
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (user.banned) return Response.json({ error: "banned" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { query?: string; max_results?: number };
  const outcome = await brightDataSearch(String(body.query ?? ""), Number(body.max_results) || 8);
  return Response.json(outcome);
}
