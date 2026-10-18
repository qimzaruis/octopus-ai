/**
 * GET /v1/models — รายชื่อ "route" ที่คีย์นี้เรียกได้ (รูปแบบเดียวกับ OpenAI)
 *
 * ใช้ตรวจว่า API key ใช้ได้จริงและเห็นโมเดลอะไรบ้างก่อนยิง chat/completions
 */

import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { getPlanByKey } from "@/lib/data/plans";
import { listPublicRoutes } from "@/lib/data/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const principal = await authenticateApiKey(req);
  if (!principal) {
    return Response.json(
      {
        error: {
          message: "ไม่ได้ให้ API key ที่ถูกต้อง (ใส่ Authorization: Bearer sk-oct-...)",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      },
      { status: 401 },
    );
  }

  const [plan, routes] = await Promise.all([
    getPlanByKey(principal.user.plan),
    listPublicRoutes(),
  ]);

  return Response.json({
    object: "list",
    data: routes
      .filter((r) => r.requiredPlanTier == null || r.requiredPlanTier <= plan.tier)
      .map((r) => ({
        id: r.publicModel,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "octopus-ai",
        name: r.displayName,
        description: r.description,
      })),
  });
}
