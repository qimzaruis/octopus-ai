"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import * as admin from "@/lib/data/admin";
import * as plansData from "@/lib/data/plans";
import * as users from "@/lib/data/users";
import { updateChatSettings } from "@/lib/chat/db";
import { invalidateCatalog } from "@/lib/catalog-cache";
import { uploadAsset } from "@/lib/storage";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/dashboard");
  return user;
}

function revalidateAdmin() {
  // route/โมเดล/แผน ถูกแคชไว้เพื่อความเร็ว — แก้เสร็จต้องล้างให้เห็นทันที
  invalidateCatalog();
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/providers");
  revalidatePath("/admin/models");
  revalidatePath("/admin/plans");
  revalidatePath("/admin/chat");
  revalidatePath("/admin/key-limits");
  revalidatePath("/agent");
  revalidatePath("/models");
  revalidatePath("/dashboard");
  revalidatePath("/subscription");
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "");
}

export async function saveProviderAction(formData: FormData) {
  await requireAdmin();
  const idRaw = str(formData, "id");
  const result = await admin.upsertProvider({
    id: idRaw ? Number(idRaw) : undefined,
    name: str(formData, "name"),
    baseUrl: str(formData, "baseUrl"),
  });
  if (!result.ok) redirect(`/admin/providers?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

// ---------------------------------------------------------------------------
// Provider keys (หลายคีย์ต่อ provider)
// ---------------------------------------------------------------------------

export async function addProviderKeyAction(formData: FormData) {
  await requireAdmin();
  const result = await admin.addProviderKey({
    providerId: Number(str(formData, "providerId")),
    label: str(formData, "label"),
    apiKey: str(formData, "apiKey"),
  });
  if (!result.ok) redirect(`/admin/providers?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function updateProviderKeyAction(formData: FormData) {
  await requireAdmin();
  const result = await admin.updateProviderKey({
    id: Number(str(formData, "id")),
    label: str(formData, "label"),
    apiKey: str(formData, "apiKey"),
  });
  if (!result.ok) redirect(`/admin/providers?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function toggleProviderKeyAction(formData: FormData) {
  await requireAdmin();
  await admin.toggleProviderKey(Number(str(formData, "id")), str(formData, "enabled") === "true");
  revalidateAdmin();
}

export async function setPrimaryProviderKeyAction(formData: FormData) {
  await requireAdmin();
  const result = await admin.setPrimaryProviderKey(Number(str(formData, "id")));
  if (!result.ok) redirect(`/admin/providers?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function deleteProviderKeyAction(formData: FormData) {
  await requireAdmin();
  await admin.deleteProviderKey(Number(str(formData, "id")));
  revalidateAdmin();
}

// ---------------------------------------------------------------------------
// กติกา "คีย์ติดลิมิต" ต่อ provider + สถานะลิมิตของคีย์ (/admin/key-limits)
// ---------------------------------------------------------------------------

/** "402, 429" → [402, 429] — ทิ้งค่าที่อ่านเป็นเลข HTTP ไม่ใช่ */
function statusList(raw: string): number[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n >= 400 && n <= 599),
    ),
  ];
}

/** แยกข้อความด้วย , หรือขึ้นบรรทัดใหม่ → รายการคำที่ไม่ซ้ำ (เก็บพิมพ์เล็กเพราะเทียบไม่สน case) */
function wordList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,\n]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export async function saveKeyLimitAction(formData: FormData) {
  await requireAdmin();
  const result = await admin.upsertKeyLimit({
    providerId: Number(str(formData, "providerId")),
    enabled: str(formData, "enabled") === "true",
    httpStatuses: statusList(str(formData, "httpStatuses")),
    errorCodes: wordList(str(formData, "errorCodes")),
    keywords: wordList(str(formData, "keywords")),
    resetTime: str(formData, "resetTime"),
    resetTimezone: str(formData, "resetTimezone"),
  });
  if (!result.ok) redirect(`/admin/key-limits?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

/** ToggleSwitch ส่งมาแค่ providerId/enabled — เงื่อนไขที่ตั้งไว้ต้องคงเดิม */
export async function toggleKeyLimitAction(formData: FormData) {
  await requireAdmin();
  const providerId = Number(str(formData, "id"));
  const current = (await admin.listKeyLimits()).find((p) => p.providerId === providerId)?.rule;
  const result = await admin.upsertKeyLimit({
    providerId,
    enabled: str(formData, "enabled") === "true",
    httpStatuses: current?.httpStatuses ?? [],
    errorCodes: current?.errorCodes ?? [],
    keywords: current?.keywords ?? [],
    resetTime: current?.resetTime ?? "13:00",
    resetTimezone: current?.resetTimezone ?? "Asia/Bangkok",
  });
  if (!result.ok) redirect(`/admin/key-limits?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

/** ปลดลิมิตก่อนเวลารีเซต — ใช้หลังเติมเครดิต/อัปเกรดแผนแล้ว */
export async function clearKeyLimitAction(formData: FormData) {
  await requireAdmin();
  const result = await admin.clearKeyLimit(Number(str(formData, "keyId")));
  if (!result.ok) redirect(`/admin/key-limits?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

// ---------------------------------------------------------------------------
// คลังรูป + โลโก้โมเดล
// ---------------------------------------------------------------------------

export async function uploadAssetAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  const result = await uploadAsset({
    file: file instanceof File ? file : null,
    name: str(formData, "name"),
  });
  if (!result.ok) redirect(`/admin/models?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function deleteAssetAction(formData: FormData) {
  await requireAdmin();
  await admin.deleteAsset(Number(str(formData, "id")));
  revalidateAdmin();
}

export async function setModelLogoAction(formData: FormData) {
  await requireAdmin();
  const logoRaw = str(formData, "logoUrl");
  const result = await admin.setModelLogo(
    Number(str(formData, "id")),
    logoRaw.trim() === "" ? null : logoRaw.trim(),
  );
  if (!result.ok) redirect(`/admin/models?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function setModelOptionsAction(formData: FormData) {
  await requireAdmin();
  const result = await admin.setModelOptions(Number(str(formData, "id")), {
    enabled: str(formData, "enabled") === "true",
    visibleToUsers: str(formData, "visibleToUsers") === "true",
  });
  if (!result.ok) redirect(`/admin/models?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function toggleProviderAction(formData: FormData) {
  await requireAdmin();
  await admin.toggleProvider(Number(str(formData, "id")), str(formData, "enabled") === "true");
  revalidateAdmin();
}

export async function deleteProviderAction(formData: FormData) {
  await requireAdmin();
  await admin.deleteProvider(Number(str(formData, "id")));
  revalidateAdmin();
}

export async function addModelAction(formData: FormData) {
  await requireAdmin();
  const result = await admin.addModel({
    providerId: Number(str(formData, "providerId")),
    modelId: str(formData, "modelId"),
    displayName: str(formData, "displayName"),
    contextWindow: Number(str(formData, "contextWindow")) || 128000,
    supportsVision: str(formData, "supportsVision") === "on",
  });
  if (!result.ok) redirect(`/admin/providers?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function toggleModelAction(formData: FormData) {
  await requireAdmin();
  await admin.toggleModel(Number(str(formData, "id")), str(formData, "enabled") === "true");
  revalidateAdmin();
}

export async function deleteModelAction(formData: FormData) {
  await requireAdmin();
  await admin.deleteModel(Number(str(formData, "id")));
  revalidateAdmin();
}

export async function saveRouteAction(formData: FormData) {
  await requireAdmin();
  const idRaw = str(formData, "id");
  const firstTargetRaw = str(formData, "firstTargetModelRefId");
  const logoRaw = str(formData, "logoUrl");
  const result = await admin.upsertRoute({
    id: idRaw ? Number(idRaw) : undefined,
    publicModel: str(formData, "publicModel"),
    description: str(formData, "description"),
    displayName: str(formData, "displayName"),
    displayMode: str(formData, "displayMode"),
    logoUrl: logoRaw.trim() || null,
    inputPricePerM: Number(str(formData, "inputPricePerM")) || 0,
    outputPricePerM: Number(str(formData, "outputPricePerM")) || 0,
    firstTargetModelRefId: firstTargetRaw ? Number(firstTargetRaw) : null,
  });
  if (!result.ok) redirect(`/admin/models?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function toggleRouteAction(formData: FormData) {
  await requireAdmin();
  await admin.toggleRoute(Number(str(formData, "id")), str(formData, "enabled") === "true");
  revalidateAdmin();
}

export async function deleteRouteAction(formData: FormData) {
  await requireAdmin();
  await admin.deleteRoute(Number(str(formData, "id")));
  revalidateAdmin();
}

export async function addRouteTargetAction(formData: FormData) {
  await requireAdmin();
  const result = await admin.addRouteTarget({
    routeId: Number(str(formData, "routeId")),
    modelRefId: Number(str(formData, "modelRefId")),
  });
  if (!result.ok) redirect(`/admin/models?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function moveRouteTargetAction(formData: FormData) {
  await requireAdmin();
  await admin.moveRouteTarget(
    Number(str(formData, "id")),
    str(formData, "direction") === "up" ? -1 : 1,
  );
  revalidateAdmin();
}

export async function toggleRouteTargetAction(formData: FormData) {
  await requireAdmin();
  await admin.toggleRouteTarget(Number(str(formData, "id")), str(formData, "enabled") === "true");
  revalidateAdmin();
}

export async function removeRouteTargetAction(formData: FormData) {
  await requireAdmin();
  await admin.removeRouteTarget(Number(str(formData, "id")));
  revalidateAdmin();
}

// ---------------------------------------------------------------------------
// จัดการผู้ใช้
// ---------------------------------------------------------------------------

export async function banUserAction(formData: FormData) {
  await requireAdmin();
  const banned = str(formData, "banned") === "true";
  const result = await users.setUserBanned(str(formData, "userId"), banned, str(formData, "reason"));
  if (!result.ok) redirect(`/admin/users?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function setUserPlanAction(formData: FormData) {
  await requireAdmin();
  const result = await users.setUserPlan(str(formData, "userId"), str(formData, "plan"));
  if (!result.ok) redirect(`/admin/users?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

export async function adjustCreditsAction(formData: FormData) {
  await requireAdmin();
  const amount = Number(str(formData, "amount"));
  const result = await users.adjustUserCredits(
    str(formData, "userId"),
    amount,
    str(formData, "note"),
  );
  if (!result.ok) redirect(`/admin/users?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

// ---------------------------------------------------------------------------
// ควบคุมโมเดลที่แสดงให้ผู้ใช้
// ---------------------------------------------------------------------------

export async function setModelVisibilityAction(formData: FormData) {
  await requireAdmin();
  // ToggleSwitch ส่งฟิลด์ชื่อ "enabled" (ค่าใหม่ที่ต้องการสลับเป็น)
  await admin.setModelVisibility(
    Number(str(formData, "id")),
    str(formData, "enabled") === "true",
  );
  revalidateAdmin();
}

export async function setModelPricingAction(formData: FormData) {
  await requireAdmin();
  const result = await admin.setModelPricing(
    Number(str(formData, "id")),
    Number(str(formData, "inputPricePerM")),
    Number(str(formData, "outputPricePerM")),
  );
  if (!result.ok) redirect(`/admin/models?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

// ---------------------------------------------------------------------------
// การตั้งค่าของ route (โหมดแสดงผล / ชื่อ / ราคา / โลโก้)
// ---------------------------------------------------------------------------

export async function updateRouteSettingsAction(formData: FormData) {
  await requireAdmin();
  const logoRaw = str(formData, "logoUrl");
  const result = await plansData.updateRouteSettings({
    id: Number(str(formData, "id")),
    publicModel: str(formData, "publicModel"),
    displayMode: str(formData, "displayMode"),
    displayName: str(formData, "displayName"),
    logoUrl: logoRaw.trim() || null,
    inputPricePerM: Number(str(formData, "inputPricePerM")),
    outputPricePerM: Number(str(formData, "outputPricePerM")),
  });
  if (!result.ok) redirect(`/admin/models?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

// ---------------------------------------------------------------------------
// แผนการใช้งาน + โควต้า
// ---------------------------------------------------------------------------

export async function updatePlanAction(formData: FormData) {
  await requireAdmin();
  const result = await plansData.updatePlan({
    key: str(formData, "key"),
    label: str(formData, "label"),
    cycleDays: Number(str(formData, "cycleDays")),
    cycleQuotaUsd: Number(str(formData, "cycleQuotaUsd")),
    dailyQuotaUsd: Number(str(formData, "dailyQuotaUsd")),
    cycleRequests: Number(str(formData, "cycleRequests")) || 0,
    concurrentModels: Number(str(formData, "concurrentModels")) || 1,
    fallback: str(formData, "fallback") === "true",
  });
  if (!result.ok) redirect(`/admin/plans?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

/** แทนที่ชุดโมเดลที่แผนนี้ใช้งานได้ (checkbox หลายตัวส่งเป็น modelIds ซ้ำ) */
export async function setPlanModelsAction(formData: FormData) {
  await requireAdmin();
  const ids = formData
    .getAll("modelIds")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
  const result = await plansData.setPlanModels(str(formData, "key"), ids);
  if (!result.ok) redirect(`/admin/plans?error=${encodeURIComponent(result.error!)}`);
  revalidateAdmin();
}

// ---------------------------------------------------------------------------
// ตั้งค่า Web Agent (จำนวนไฟล์แนบสูงสุด) — เก็บบน Turso
// ---------------------------------------------------------------------------

export async function updateChatSettingsAction(formData: FormData) {
  await requireAdmin();
  const raw = Number(str(formData, "maxAttachments"));
  if (!Number.isFinite(raw) || raw < 1 || raw > 50) {
    redirect(`/admin/chat?error=${encodeURIComponent("จำนวนไฟล์ต้องอยู่ระหว่าง 1–50")}`);
  }
  try {
    await updateChatSettings({ maxAttachments: Math.floor(raw) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ";
    redirect(`/admin/chat?error=${encodeURIComponent(msg)}`);
  }
  revalidateAdmin();
  redirect("/admin/chat?ok=1");
}
