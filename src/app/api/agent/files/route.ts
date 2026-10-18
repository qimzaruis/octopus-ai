import { getSessionUser } from "@/lib/auth";
import { listFiles } from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** รายชื่อไฟล์ที่ AI สร้างให้ผู้ใช้ (ไม่ส่งเนื้อไฟล์มาด้วยกันทีละมาก ๆ) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const files = await listFiles(user.id);
    return new Response(
      JSON.stringify({
        files: files.map(({ content: _content, ...rest }) => rest),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[agent] list files failed:", err);
    return new Response(JSON.stringify({ error: "chat_db_unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
