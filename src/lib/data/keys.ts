import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { isDemoMode } from "@/lib/config";
import { isDbUnavailable, markDbUnavailable } from "@/lib/db-circuit";
import { demoSource } from "@/lib/demo/store";

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
  if (isDemoMode || isDbUnavailable()) {
    const store = demoSource();
    return store.apiKeys
      .filter((k) => k.userId === userId && !k.revoked)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        revoked: k.revoked,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        createdAt: k.createdAt.toISOString(),
      }));
  }

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
}

// ---------------- สร้าง key (จำกัด 3 คีย์) ----------------

export async function createApiKey(userId: string, name: string): Promise<CreateKeyResult> {
  const cleanName = name.trim() || "Untitled key";
  const { secret, prefix } = generateSecret();

  if (isDemoMode || isDbUnavailable()) {
    const store = demoSource();
    const active = store.apiKeys.filter((k) => k.userId === userId && !k.revoked);
    if (active.length >= MAX_KEYS_PER_USER) {
      return { ok: false, error: `สร้างได้สูงสุด ${MAX_KEYS_PER_USER} คีย์ต่อบัญชี` };
    }
    const id = Math.max(0, ...store.apiKeys.map((k) => k.id)) + 1;
    store.apiKeys.push({
      id,
      userId,
      name: cleanName,
      keyPrefix: prefix,
      secret,
      revoked: false,
      lastUsedAt: null,
      createdAt: new Date(),
    });
    return { ok: true, id, secret };
  }

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
  if (isDemoMode || isDbUnavailable()) {
    const store = demoSource();
    const key = store.apiKeys.find(
      (k) => k.id === keyId && k.userId === userId && !k.revoked,
    );
    if (!key) return false;
    key.revoked = true;
    return true;
  }

  const db = getDb();
  const updated = await db
    .update(apiKeys)
    .set({ revoked: true })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id });
  return updated.length > 0;
}
