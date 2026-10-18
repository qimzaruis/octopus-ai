import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteImageJob } from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteImageJob(user.id, id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[images] ลบงานไม่สำเร็จ:", err);
    return Response.json({ error: "db_unavailable" }, { status: 503 });
  }
}
