import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteMessagesFromIndex, getConversation } from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agent/conversations/<id>/trim  body: { from: number }
 *
 * ลบข้อความตั้งแต่ลำดับที่ `from` จนถึงท้ายห้อง ใช้ตอนผู้ใช้ "แก้คำถามแล้วส่งใหม่"
 * เพื่อไม่ให้โมเดลเห็นคำถามเก่าที่แก้ทิ้งไปแล้ว
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { from?: number };
  const from = Number(body.from);
  if (!Number.isInteger(from) || from < 0) {
    return NextResponse.json({ error: "bad_index" }, { status: 400 });
  }

  try {
    const conversation = await getConversation(user.id, id);
    if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const removed = await deleteMessagesFromIndex(id, from);
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    console.error("[agent] trim conversation failed:", err);
    return NextResponse.json({ error: "chat_db_unavailable" }, { status: 503 });
  }
}
