import { randomBytes } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getFile, setFileShare } from "@/lib/chat/db";
import { getSiteUrl } from "@/lib/site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHARE_DAYS = 30;

/**
 * แชร์ไฟล์ HTML เป็นลิงก์ถาวรบนโดเมนเราเอง — /s/<token>
 *
 * ต่างจาก service ภายนอกที่อัปโหลด snapshot ครั้งเดียว: route /s/ อ่านเนื้อหา
 * จาก chat_files ทุกครั้งที่เปิด ลิงก์เดิมจึงแสดงเวอร์ชันล่าสุดหลัง AI แก้ไฟล์
 * และเราควบคุม header (ไม่มี) กับ favicon (Octopus) ได้เอง
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let file;
  try {
    file = await getFile(user.id, id);
  } catch (err) {
    console.error("[agent] share preload failed:", err);
    return Response.json({ error: "chat_db_unavailable" }, { status: 503 });
  }
  if (!file) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const origin = await getSiteUrl();
  const stillValid =
    Boolean(file.shareToken) &&
    Boolean(file.shareExpiresAt) &&
    new Date(file.shareExpiresAt!).getTime() > Date.now();

  // token เดิมยังใช้ได้ → คืนลิงก์เดิม (เนื้อหาข้างในอัปเดตตามไฟล์เสมอ)
  if (stillValid) {
    return Response.json({
      shareUrl: new URL(`/s/${file.shareToken}`, origin).toString(),
      shareToken: file.shareToken,
      expiresAt: file.shareExpiresAt,
    });
  }

  const shareToken = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SHARE_DAYS * 86_400_000).toISOString();
  const shareUrl = new URL(`/s/${shareToken}`, origin).toString();

  try {
    await setFileShare(user.id, file.id, { shareUrl, shareToken, shareExpiresAt: expiresAt });
  } catch (err) {
    // สร้างลิงก์ได้แล้วแต่บันทึกไม่ติด — ยังใช้งานได้จนกว่าจะรีสตาร์ท/แชร์ใหม่
    console.error("[agent] save share token failed:", err);
  }

  return Response.json({ shareUrl, shareToken, expiresAt });
}
