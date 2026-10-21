/**
 * POST /v1/images/generations — API สร้างรูปที่เข้ากันได้กับ OpenAI
 *
 * ใช้ route ที่มีโมเดลปลายทางชนิด image เท่านั้น (ตั้งค่าที่หน้า Providers)
 * คีย์ของผู้ให้บริการอยู่ในเซิร์ฟเวอร์ ผู้ใช้เห็นเฉพาะข้อมูลรูปที่ได้
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { detectAgent } from "@/lib/agent-detect";
import { getPlanByKey } from "@/lib/data/plans";
import { getQuotaState, listPublicRoutes } from "@/lib/data/models";
import {
  failedTarget,
  GatewayError,
  invokeImageGeneration,
  logRequest,
  userSafeMessage,
} from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  model?: string;
  prompt?: string;
  n?: number;
  size?: string;
  response_format?: "url" | "b64_json";
};

function openaiError(message: string, type: string, status: number, code?: string) {
  return Response.json(
    { error: { message, type, param: null, code: code ?? null } },
    { status },
  );
}

export async function POST(req: NextRequest) {
  const [principal, parsed] = await Promise.all([
    authenticateApiKey(req),
    req.json().catch(() => null),
  ]);
  if (!principal) {
    return openaiError(
      "ไม่ได้ให้ API key ที่ถูกต้อง (ใส่ Authorization: Bearer sk-oct-...)",
      "invalid_request_error",
      401,
      "invalid_api_key",
    );
  }
  if (principal.user.banned) {
    return openaiError("บัญชีนี้ถูกระงับการใช้งาน", "permission_denied_error", 403);
  }

  const body = parsed as Body | null;
  const model = (body?.model ?? "").trim();
  const prompt = (body?.prompt ?? "").trim();
  if (!model) return openaiError("ขาดฟิลด์ model", "invalid_request_error", 400);
  if (!prompt) return openaiError("ขาดฟิลด์ prompt", "invalid_request_error", 400);

  const [plan, routes] = await Promise.all([
    getPlanByKey(principal.user.plan),
    listPublicRoutes(),
  ]);
  const route = routes.find((r) => r.publicModel === model);
  if (!route) {
    return openaiError(
      `ไม่พบโมเดล "${model}"`,
      "invalid_request_error",
      404,
      "model_not_found",
    );
  }
  if (route.kind !== "image") {
    return openaiError(
      "โมเดลนี้ไม่ใช่โมเดลสร้างรูป — ตั้งประเภทโมเดลเป็น image ที่หน้า Providers",
      "invalid_request_error",
      400,
      "not_an_image_model",
    );
  }
  if (route.requiredPlanTier != null && route.requiredPlanTier > plan.tier) {
    return openaiError(
      `โมเดลนี้ต้องใช้แผน ${route.requiredPlanLabel} ขึ้นไป`,
      "insufficient_quota",
      403,
      "plan_required",
    );
  }

  const quota = await getQuotaState(principal.user.id, principal.user.plan);
  if (quota.cycleExhausted || quota.dailyExhausted) {
    return openaiError(
      "ใช้โควต้าครบแล้วสำหรับรอบนี้ — รอรีเซตหรืออัปเกรดแผน",
      "insufficient_quota",
      429,
      "quota_exceeded",
    );
  }

  const n = body?.n === undefined ? 1 : Number(body.n);
  if (!Number.isInteger(n) || n < 1 || n > 4) {
    return openaiError("n ต้องเป็นจำนวนเต็ม 1–4", "invalid_request_error", 400);
  }
  const size = typeof body?.size === "string" ? body.size.trim().slice(0, 40) : undefined;
  const responseFormat =
    body?.response_format === "b64_json"
      ? "b64_json"
      : body?.response_format === "url"
        ? "url"
        : undefined;

  const startedAt = Date.now();
  try {
    const result = await invokeImageGeneration({
      publicModel: model,
      prompt: prompt.slice(0, 4000),
      n,
      size,
      responseFormat,
      signal: req.signal,
    });

    const raw = result.json as { created?: unknown; data?: unknown };
    const data = Array.isArray(raw.data)
      ? raw.data.map((item) => {
          const row = item as Record<string, unknown>;
          const clean: Record<string, unknown> = {};
          if (typeof row.url === "string") clean.url = row.url;
          if (typeof row.b64_json === "string") clean.b64_json = row.b64_json;
          if (typeof row.revised_prompt === "string") clean.revised_prompt = row.revised_prompt;
          return clean;
        })
      : [];
    if (data.length === 0) {
      throw new GatewayError("upstream_error", "ค่ายต้นทางไม่ได้ส่งรูปกลับมา", 502);
    }

    void logRequest({
      userId: principal.user.id,
      apiKeyId: principal.apiKeyId,
      target: result.target,
      publicModel: model,
      agent: detectAgent(req.headers),
      status: "success",
      httpStatus: result.httpStatus,
      usage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: Date.now() - startedAt,
    });

    return Response.json({
      created:
        typeof raw.created === "number" ? raw.created : Math.floor(Date.now() / 1000),
      data,
    });
  } catch (err) {
    const gw = err instanceof GatewayError ? err : null;
    void logRequest({
      userId: principal.user.id,
      apiKeyId: principal.apiKeyId,
      target: failedTarget(model),
      publicModel: model,
      agent: detectAgent(req.headers),
      status: gw?.code === "keys_limited" ? "rate_limited" : "error",
      httpStatus: gw?.status ?? 502,
      usage: { inputTokens: 0, outputTokens: 0 },
      latencyMs: Date.now() - startedAt,
      error: gw?.message ?? (err as Error)?.message ?? "unknown",
    });
    return openaiError(
      userSafeMessage(err),
      gw?.code === "keys_limited" ? "rate_limit_error" : "upstream_error",
      gw?.status ?? 502,
      gw?.code,
    );
  }
}
