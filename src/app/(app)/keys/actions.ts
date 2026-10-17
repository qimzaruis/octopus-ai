"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { createApiKey, revokeApiKey } from "@/lib/data/keys";

export type CreateKeyState = {
  ok?: boolean;
  secret?: string;
  error?: string;
};

export async function createKeyAction(
  name: string,
): Promise<CreateKeyState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อน" };

  if (!name.trim()) return { ok: false, error: "กรุณาตั้งชื่อคีย์ เช่น Development" };

  const result = await createApiKey(user.id, name);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/keys");
  return { ok: true, secret: result.secret };
}

export async function revokeKeyAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const keyId = Number(formData.get("keyId"));
  if (keyId) await revokeApiKey(user.id, keyId);
  revalidatePath("/keys");
}
