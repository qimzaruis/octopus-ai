import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listPublicRoutes } from "@/lib/data/models";
import { addImageJob, listImageJobs } from "@/lib/chat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** สัดส่วนที่รองรับ — ต้องตรงกับปุ่มในหน้าสร้างรูป */
export const RATIOS = ["9:16", "3:4", "1:1", "4:3", "16:9"] as const;

type Body = { prompt?: string; model?: string; ratio?: string; refs?: string[] };

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

  // รับเฉพาะโมเดล route ที่ผู้ใช้เรียกได้จริง
  const allowed = await listPublicRoutes().catch(() => []);
  const route = allowed.find((r) => r.publicModel === model);
  if (!route) return Response.json({ error: "model_unavailable" }, { status: 400 });

  const refs = (body.refs ?? []).map((r) => String(r).slice(0, 120)).slice(0, 4);

  try {
    const job = await addImageJob({ userId: user.id, prompt: prompt.slice(0, 2000), model, ratio, refs });
    return Response.json({ job });
  } catch (err) {
    console.error("[images] สร้างงานไม่สำเร็จ:", err);
    return Response.json({ error: "db_unavailable" }, { status: 503 });
  }
}
