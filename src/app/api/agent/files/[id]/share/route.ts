import { randomBytes } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getFile, setFileShare, type ChatFile } from "@/lib/chat/db";
import { getSiteUrl } from "@/lib/site-config";
import {
  ARTIFACT_TTL_DAYS,
  CdnError,
  MAX_ARTIFACT_BYTES,
  createArtifact,
  isCdnArtifactUrl,
  randomArtifactName,
  sanitizeArtifactName,
  updateArtifact,
} from "@/lib/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ไฟล์ที่ไม่ใช่ HTML ยังใช้ /s/<token> แบบเดิม (อ่านเนื้อหาล่าสุดจาก DB) */
const LEGACY_SHARE_DAYS = 7;

type ShareBody = { name?: unknown };

function looksLikeHtml(content: string): boolean {
  return /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(content);
}

async function readName(req: Request): Promise<{ name?: string; error?: string }> {
  const parsed = (await req.json().catch(() => null)) as ShareBody | null;
  const body: ShareBody = parsed && typeof parsed === "object" ? parsed : {};
  const raw = typeof body.name === "string" ? body.name.trim() : "";
  if (!raw) return {};
  const name = sanitizeArtifactName(raw);
  if (!name) return { error: "invalid_name" };
  return { name };
}

function expiresAtOrFallback(value: string | null | undefined): string {
  return value ?? new Date(Date.now() + ARTIFACT_TTL_DAYS * 86_400_000).toISOString();
}

async function saveShare(
  userId: string,
  fileId: string,
  share: { shareUrl: string; shareToken: string; shareExpiresAt: string },
): Promise<void> {
  try {
    await setFileShare(userId, fileId, share);
  } catch (err) {
    // ลิงก์สร้างเสร็จแล้วแต่บันทึกไม่ติด — ยังใช้งานได้จนกว่าจะกดแชร์ใหม่
    console.error("[agent] save share failed:", err);
  }
}

function errorResponse(err: unknown): Response {
  if (err instanceof CdnError) {
    console.error("[agent] CDN artifact error:", err.status, err.code, err.message);
    if (err.code === "name_taken") {
      return Response.json({ error: "name_taken" }, { status: 409 });
    }
    if (err.code === "html_too_large") {
      return Response.json({ error: "html_too_large" }, { status: 413 });
    }
    if (err.code === "invalid_name") {
      return Response.json({ error: "invalid_name" }, { status: 400 });
    }
    return Response.json({ error: "cdn_unavailable" }, { status: 502 });
  }
  console.error("[agent] share failed:", err);
  return Response.json({ error: "share_failed" }, { status: 502 });
}

/**
 * แชร์ HTML artifact ขึ้น CDN — ชื่อเลือกเองได้ ถ้าเว้นว่างระบบสุ่มให้
 * อายุ 7 วัน (CDN ลบให้หลังหมดอายุ) และการกดแชร์ซ้ำจะ PUT อัปเดตเนื้อหา/TTL
 */
async function shareOnCdn(
  userId: string,
  file: ChatFile,
  requestedName?: string,
): Promise<Response> {
  const bytes = Buffer.byteLength(file.content, "utf8");
  if (bytes > MAX_ARTIFACT_BYTES) {
    return Response.json({ error: "html_too_large" }, { status: 413 });
  }

  const existingCdn = Boolean(file.shareToken) && isCdnArtifactUrl(file.shareUrl);
  const existingValid =
    existingCdn &&
    Boolean(file.shareExpiresAt) &&
    new Date(file.shareExpiresAt!).getTime() > Date.now();
  const sameName = Boolean(requestedName) && requestedName === file.shareToken;

  // ลิงก์ CDN เดิมยังไม่หมดอายุ → อัปเดต HTML และต่ออายุ 7 วันจากตอนนี้
  if (existingValid && (!requestedName || sameName)) {
    try {
      const updated = await updateArtifact({ name: file.shareToken!, html: file.content });
      const expiresAt = expiresAtOrFallback(updated.expiresAt);
      await saveShare(userId, file.id, {
        shareUrl: updated.url,
        shareToken: updated.name,
        shareExpiresAt: expiresAt,
      });
      return Response.json({
        shareUrl: updated.url,
        shareToken: updated.name,
        expiresAt,
      });
    } catch (err) {
      // 404 = หมดอายุ/ถูกลบไปแล้ว, 401 = มีรหัสจากที่อื่น → สร้าง artifact ใหม่
      if (!(err instanceof CdnError) || (err.status !== 404 && err.status !== 401)) {
        return errorResponse(err);
      }
    }
  }

  let name =
    requestedName ??
    (existingCdn && file.shareToken ? file.shareToken : randomArtifactName(file.name));

  try {
    let artifact;
    try {
      artifact = await createArtifact({ name, html: file.content });
    } catch (err) {
      // ชื่อสุ่ม/ชื่อเดิมชนกัน → ลองสุ่มใหม่ (ชื่อที่ผู้ใช้เลือกเองให้รายงาน 409 กลับไป)
      if (err instanceof CdnError && err.code === "name_taken" && !requestedName) {
        artifact = await createArtifact({
          name: randomArtifactName(file.name),
          html: file.content,
        });
      } else {
        throw err;
      }
    }

    const expiresAt = expiresAtOrFallback(artifact.expiresAt);
    await saveShare(userId, file.id, {
      shareUrl: artifact.url,
      shareToken: artifact.name,
      shareExpiresAt: expiresAt,
    });
    return Response.json({
      shareUrl: artifact.url,
      shareToken: artifact.name,
      expiresAt,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** ไฟล์ที่ไม่ใช่ HTML — คงลิงก์ /s/<token> บนโดเมนเราเหมือนเดิม */
async function shareLegacy(userId: string, file: ChatFile): Promise<Response> {
  const origin = await getSiteUrl();
  const stillValid =
    Boolean(file.shareToken) &&
    Boolean(file.shareUrl?.startsWith(`${origin}/s/`)) &&
    Boolean(file.shareExpiresAt) &&
    new Date(file.shareExpiresAt!).getTime() > Date.now();

  if (stillValid) {
    return Response.json({
      shareUrl: file.shareUrl,
      shareToken: file.shareToken,
      expiresAt: file.shareExpiresAt,
    });
  }

  const shareToken = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + LEGACY_SHARE_DAYS * 86_400_000).toISOString();
  const shareUrl = new URL(`/s/${shareToken}`, origin).toString();
  await saveShare(userId, file.id, { shareUrl, shareToken, shareExpiresAt: expiresAt });

  return Response.json({ shareUrl, shareToken, expiresAt });
}

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

  const { name, error } = await readName(req);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }

  const isHtml = file.kind === "html" || looksLikeHtml(file.content);
  if (!isHtml) {
    return shareLegacy(user.id, file);
  }

  return shareOnCdn(user.id, file, name);
}
