import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteConversation, getConversation, updateConversation } from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const conversation = await getConversation(user.id, id);
    if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ conversation });
  } catch (err) {
    console.error("[agent] get conversation failed:", err);
    return NextResponse.json({ error: "chat_db_unavailable" }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { title?: string; model?: string };
  try {
    await updateConversation(user.id, id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[agent] update conversation failed:", err);
    return NextResponse.json({ error: "chat_db_unavailable" }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteConversation(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[agent] delete conversation failed:", err);
    return NextResponse.json({ error: "chat_db_unavailable" }, { status: 503 });
  }
}