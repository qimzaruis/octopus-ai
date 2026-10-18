import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getFile } from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeName(name: string): string {
  return name.replace(/["\\\r\n]/g, "").replace(/[/\\]/g, "_") || "artifact.html";
}

/** เนื้อไฟล์สำหรับเปิดดูหรือดาวน์โหลด */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { id } = await params;
  try {
    const file = await getFile(user.id, id);
    if (!file) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    const download = req.nextUrl.searchParams.get("download") === "1";
    const mime =
      file.kind === "html" ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
    return new Response(file.content, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName(file.name)}"`,
      },
    });
  } catch (err) {
    console.error("[agent] get file failed:", err);
    return new Response(JSON.stringify({ error: "chat_db_unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
