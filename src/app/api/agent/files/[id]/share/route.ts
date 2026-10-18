import { getSessionUser } from "@/lib/auth";
import { getFile, setFileShare } from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * แชร์ไฟล์เป็นลิงก์สาธารณะผ่าน Display.dev (anonymous artifacts API)
 * ลิงก์มีอายุ ~30 วันตาม expiresAt ที่ API ตอบกลับ และถูกบันทึกลง chat_db
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { id } = await params;

  let file;
  try {
    file = await getFile(user.id, id);
  } catch (err) {
    console.error("[agent] share preload failed:", err);
    return new Response(JSON.stringify({ error: "chat_db_unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!file) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ยังมีลิงก์ที่อายุเหลืออยู่ — ใช้เดิม ไม่ต้องอัปโหลดซ้ำ
  if (file.shareUrl && file.shareExpiresAt && new Date(file.shareExpiresAt).getTime() > Date.now()) {
    return new Response(
      JSON.stringify({ shareUrl: file.shareUrl, expiresAt: file.shareExpiresAt }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([file.content], { type: "text/html" }),
    file.name || "artifact.html",
  );

  let upload;
  try {
    upload = await fetch("https://api.display.dev/v1/public/artifacts", {
      method: "POST",
      body: form,
    });
  } catch (err) {
    console.error("[agent] display.dev upload failed:", err);
    return new Response(JSON.stringify({ error: "upload_failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!upload.ok) {
    const detail = await upload.text().catch(() => "");
    console.error("[agent] display.dev upload error:", upload.status, detail);
    return new Response(JSON.stringify({ error: "upload_failed", status: upload.status }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = (await upload.json().catch(() => ({}))) as {
    previewUrl?: string;
    expiresAt?: string;
  };
  const shareUrl = data.previewUrl ?? "";
  const expiresAt = data.expiresAt ?? "";
  if (!shareUrl) {
    return new Response(JSON.stringify({ error: "upload_failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await setFileShare(user.id, file.id, { shareUrl, shareExpiresAt: expiresAt });
  } catch (err) {
    // ลิงก์สร้างแล้วแต่บันทึกไม่ติด — ยังส่งลิงก์ให้ผู้ใช้ได้
    console.error("[agent] save share url failed:", err);
  }

  return new Response(JSON.stringify({ shareUrl, expiresAt }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
