/**
 * ตรวจสอบ API key ของผู้ใช้สำหรับ endpoint สาธารณะ (/v1/*)
 *
 * ใช้คีย์ที่สร้างจากหน้า /keys (sk-oct-...) ผ่าน header
 *   Authorization: Bearer sk-oct-...   (หรือ x-api-key)
 * แล้วคืนโปรไฟล์เจ้าของคีย์เพื่อเอาไปตรวจสิทธิ์แผนและโควต้าต่อ
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";
import type { SessionUser } from "@/lib/auth";

export type ApiPrincipal = {
  user: SessionUser;
  apiKeyId: number;
  keyName: string;
};

/** อ่านคีย์จาก request — คืน null เมื่อไม่มี header หรือรูปแบบไม่ถูกต้อง */
export function bearerKey(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("x-api-key");
  if (!header) return null;
  const value = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  return value || null;
}

export async function authenticateApiKey(
  req: Request,
): Promise<ApiPrincipal | null> {
  const secret = bearerKey(req);
  if (!secret) return null;


  if (isDbUnavailable()) return null;

  try {
    const db = getDb();
    const rows = await db
      .select({ key: apiKeys, user: users })
      .from(apiKeys)
      .innerJoin(users, eq(users.id, apiKeys.userId))
      .where(and(eq(apiKeys.secret, secret), eq(apiKeys.revoked, false)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    // "ใช้ล่าสุด" เป็นแค่ข้อมูลแสดงในหน้า /keys — ไม่รอเขียน DB
    // เพราะทำให้ทุก request ของ API ช้าลง ~350ms ฟรี ๆ (ถ้า process จบก่อนแล้วเขียนไม่ทัน ก็แค่ค่าไม่อัปเดต)
    void db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.key.id))
      .catch((err: unknown) => console.error("[api-auth] บันทึก lastUsedAt ไม่สำเร็จ:", err));

    return {
      apiKeyId: row.key.id,
      keyName: row.key.name,
      user: {
        id: row.user.id,
        email: row.user.email,
        name: row.user.name,
        avatarUrl: row.user.avatarUrl,
        role: row.user.role === "admin" ? "admin" : "user",
        credits: Number(row.user.credits),
        plan: row.user.plan,
        banned: row.user.banned,
        bannedReason: row.user.bannedReason,
      },
    };
  } catch (err) {
    markDbUnavailable(err);
    console.error("[api-auth] ตรวจสอบคีย์ไม่สำเร็จ:", err);
    return null;
  }
}
