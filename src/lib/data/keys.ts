import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";

export const MAX_KEYS_PER_USER = 3;

export type ApiKeyDTO = {
  id: number;
  name: string;
  keyPrefix: string;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

export type CreateKeyResult =
  | { ok: true; id: number; secret: string }
  | { ok: false; error: string };

function generateSecret(): { secret: string; prefix: string } {
  const secret = `sk-oct-${randomBytes(24).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, 12) };
}

// ---------------- รายการ key ของ user ----------------

export async function listApiKeys(userId: string): Promise<ApiKeyDTO[]> {
  if (isDbUnavailable()) return [];

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.revoked, false)))
      .orderBy(desc(apiKeys.createdAt));

    return rows.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      revoked: k.revoked,
      lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
      createdAt: k.createdAt.toISOString(),
    }));
  } catch (err) {
    markDbUnavailable(err);
    return [];
  }
}

// ---------------- สร้าง key (จำกัด 3 คีย์) ----------------

export async function createApiKey(userId: string, name: string): Promise<CreateKeyResult> {
  if (isDbUnavailable()) return { ok: false, error: "DB ใช้ไม่ได้ชั่วคราว" };

  const cleanName = name.trim() || "Untitled key";
  const { secret, prefix } = generateSecret();

  const db = getDb();
  const active = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.revoked, false)));
  if (active.length >= MAX_KEYS_PER_USER) {
    return { ok: false, error: `สร้างได้สูงสุด ${MAX_KEYS_PER_USER} คีย์ต่อบัญชี` };
  }

  const inserted = await db
    .insert(apiKeys)
    .values({ userId, name: cleanName, keyPrefix: prefix, secret })
    .returning({ id: apiKeys.id });

  return { ok: true, id: inserted[0].id, secret };
}

// ---------------- ยกเลิก key ----------------

export async function revokeApiKey(userId: string, keyId: number): Promise<boolean> {
  if (isDbUnavailable()) return false;

  const db = getDb();
  const updated = await db
    .update(apiKeys)
    .set({ revoked: true })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id });
  return updated.length > 0;
}
