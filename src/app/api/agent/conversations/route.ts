import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createConversation, getChatSettings, listConversations } from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [conversations, settings] = await Promise.all([
      listConversations(user.id),
      getChatSettings(),
    ]);
    return NextResponse.json({ conversations, settings });
  } catch (err) {
    console.error("[agent] list conversations failed:", err);
    return NextResponse.json({ error: "chat_db_unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { title?: string; model?: string };
  try {
    const conversation = await createConversation({
      userId: user.id,
      title: body.title,
      model: body.model,
    });
    return NextResponse.json({ conversation });
  } catch (err) {
    console.error("[agent] create conversation failed:", err);
    return NextResponse.json({ error: "chat_db_unavailable" }, { status: 503 });
  }
}