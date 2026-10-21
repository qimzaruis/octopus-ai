import type { NextRequest } from "next/server";
import { getFileByShareToken } from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * หน้าแชร์ HTML สาธารณะ — อ่านเนื้อหาล่าสุดจาก chat_files ทุกครั้ง
 *
 * - ลิงก์เดิม (/s/<token>) อัปเดตเองเมื่อ AI แก้ไฟล์
 * - ไม่มี header/chrome ของ viewer
 * - บังคับ favicon ของ Octopus ที่ชั้นนี้ AI แก้ไฟล์ให้เป็นไอคอนอื่นก็ไม่หลุด
 * - CSP sandbox (ไม่มี allow-same-origin) แยกสคริปต์ใน HTML ออกจาก origin ของแอป
 */
function withOctopusIcon(html: string, iconUrl: string): string {
  const safeIcon = iconUrl.replace(/"/g, "&quot;");
  const tag = `<link rel="icon" href="${safeIcon}" />`;
  const cleaned = html.replace(
    /<link\b[^>]*\brel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/gi,
    "",
  );
  return /<\/head>/i.test(cleaned)
    ? cleaned.replace(/<\/head>/i, `${tag}</head>`)
    : `${tag}${cleaned}`;
}

function notFoundPage(iconUrl: string): string {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>ไม่พบลิงก์</title><link rel="icon" href="${iconUrl}" /><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f1a;color:#e8ecf4;font-family:system-ui,sans-serif;text-align:center;padding:24px}main{max-width:28rem}h1{font-size:1.15rem;margin:0 0 .5rem}p{margin:0;color:#94a3b8;font-size:.9rem;line-height:1.6}</style></head><body><main><h1>ไม่พบหรือลิงก์หมดอายุ</h1><p>ลิงก์นี้อาจถูกยกเลิกหรือหมดอายุแล้ว — ขอลิงก์ใหม่จากเจ้าของไฟล์ได้เลย</p></main></body></html>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const iconUrl = new URL("/logo.png", req.nextUrl.origin).toString();
  if (!token || token.length < 20 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return new Response(notFoundPage(iconUrl), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  let file;
  try {
    file = await getFileByShareToken(token);
  } catch (err) {
    console.error("[share] อ่านไฟล์ไม่สำเร็จ:", err);
    return new Response("Service unavailable", { status: 503 });
  }
  if (
    !file ||
    !file.shareExpiresAt ||
    new Date(file.shareExpiresAt).getTime() <= Date.now()
  ) {
    return new Response(notFoundPage(iconUrl), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const isHtml = file.kind === "html" || /^\s*<!doctype html/i.test(file.content);
  const body = isHtml ? withOctopusIcon(file.content, iconUrl) : file.content;
  return new Response(body, {
    headers: {
      "Content-Type": `${isHtml ? "text/html" : "text/plain"}; charset=utf-8`,
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy":
        "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
