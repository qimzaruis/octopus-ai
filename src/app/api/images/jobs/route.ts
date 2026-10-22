import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPlanByKey } from "@/lib/data/plans";
import { listPublicRoutes } from "@/lib/data/models";
import { addImageJob, listImageJobs, setImageJobResult, type ImageJob } from "@/lib/chat/db";
import {
  GatewayError,
  invokeImageGeneration,
  userSafeMessage,
} from "@/lib/gateway";
import { CdnError, uploadImage } from "@/lib/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** สัดส่วนที่รองรับ — ต้องตรงกับปุ่มในหน้าสร้างรูป */
export const RATIOS = ["9:16", "3:4", "1:1", "4:3", "16:9"] as const;

const IMAGE_SIZES: Record<string, string> = {
  "1:1": "1024x1024",
  "3:4": "1024x1536",
  "4:3": "1536x1024",
  "9:16": "1024x1792",
  "16:9": "1792x1024",
};

type Body = { prompt?: string; model?: string; ratio?: string; refs?: string[] };

type UpstreamImage = { b64_json?: string; url?: string; revised_prompt?: string };

async function imageBytes(item: UpstreamImage): Promise<Uint8Array> {
  if (typeof item.b64_json === "string" && item.b64_json.length > 0) {
    return new Uint8Array(Buffer.from(item.b64_json, "base64"));
  }
  if (typeof item.url === "string" && /^https?:\/\//i.test(item.url)) {
    const res = await fetch(item.url, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new GatewayError("upstream_error", "ดาวน์โหลดรูปจากต้นทางไม่สำเร็จ", 502);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new GatewayError("upstream_error", "ค่ายต้นทางไม่ได้ส่งรูปกลับมา", 502);
}

function imageErrorMessage(err: unknown): string {
  if (err instanceof CdnError) {
    if (err.code === "image_too_large") return "รูปใหญ่เกิน 5MB จึงอัปโหลดขึ้น CDN ไม่ได้";
    if (err.code === "unsupported_image_type") return "รูปแบบรูปที่ได้ไม่รองรับ";
    return "อัปโหลดรูปขึ้น CDN ไม่สำเร็จ";
  }
  return userSafeMessage(err);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json({ jobs: await listImageJobs(user.id) });
  } catch (err) {
    console.error("[images] โหลดคิวไม่สำเร็จ:", err);
    return Response.json({ error: "db_unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const prompt = (body.prompt ?? "").trim();
  const ratio = (body.ratio ?? "1:1").trim();
  const model = (body.model ?? "").trim();

  if (!prompt) return Response.json({ error: "empty_prompt" }, { status: 400 });
  if (!(RATIOS as readonly string[]).includes(ratio)) {
    return Response.json({ error: "bad_ratio" }, { status: 400 });
  }

  const [allowed, plan] = await Promise.all([
    listPublicRoutes().catch(() => []),
    getPlanByKey(user.plan),
  ]);
  const route = allowed.find((r) => r.publicModel === model);
  if (!route) return Response.json({ error: "model_unavailable" }, { status: 400 });
  if (route.kind !== "image") {
    return Response.json({ error: "not_an_image_model" }, { status: 400 });
  }
  if (route.requiredPlanTier != null && route.requiredPlanTier > plan.tier) {
    return Response.json({ error: "plan_required" }, { status: 403 });
  }

  const refs = (body.refs ?? []).map((r) => String(r).slice(0, 120)).slice(0, 4);
  let job: ImageJob;
  try {
    job = await addImageJob({
      userId: user.id,
      prompt: prompt.slice(0, 2000),
      model,
      ratio,
      refs,
    });
  } catch (err) {
    console.error("[images] สร้างงานไม่สำเร็จ:", err);
    return Response.json({ error: "db_unavailable" }, { status: 503 });
  }

  try {
    const startedAt = Date.now();
    const result = await invokeImageGeneration({
      publicModel: model,
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: IMAGE_SIZES[ratio],
      signal: req.signal,
    });
    const raw = result.json as { data?: UpstreamImage[] };
    const first = Array.isArray(raw.data) ? raw.data[0] : undefined;
    if (!first) {
      throw new GatewayError("upstream_error", "ค่ายต้นทางไม่ได้ส่งรูปกลับมา", 502);
    }

    const bytes = await imageBytes(first);
    const uploaded = await uploadImage({ bytes });
    await setImageJobResult({
      userId: user.id,
      id: job.id,
      status: "done",
      imageUrl: uploaded.url,
    });

    console.log(
      `[images] ${model} สร้างเสร็จใน ${Date.now() - startedAt}ms → ${uploaded.url}`,
    );
    return Response.json({
      job: { ...job, status: "done", imageUrl: uploaded.url },
    });
  } catch (err) {
    const message = imageErrorMessage(err);
    console.error("[images] สร้างรูปไม่สำเร็จ:", err);
    await setImageJobResult({
      userId: user.id,
      id: job.id,
      status: "failed",
      error: message,
    });
    return Response.json(
      { job: { ...job, status: "failed", error: message }, error: message },
      { status: 502 },
    );
  }
}
