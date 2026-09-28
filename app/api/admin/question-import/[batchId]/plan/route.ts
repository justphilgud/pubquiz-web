import { NextResponse } from "next/server";

import { buildExternalQuestionProductionPlan } from "@/app/fragen/import/external/externalQuestionProductionPlan.server";
import {
  canonicalExternalImportPlan,
  externalImportPlanDigest,
} from "@/app/fragen/import/external/productionImportGuard";
import { requireAdmin } from "@/app/lib/permissions";
import { getCurrentUserId } from "@/app/services/questionService";

export async function GET(
  _request: Request,
  context: { params: Promise<{ batchId: string }> },
) {
  const session = await requireAdmin();
  const { batchId: rawBatchId } = await context.params;
  const batchId = Number(rawBatchId);
  if (!Number.isInteger(batchId) || batchId < 1) {
    return NextResponse.json({ error: "BATCH_ID_INVALID" }, { status: 400 });
  }
  const plan = await buildExternalQuestionProductionPlan({
    batchId,
    operatorUserId: getCurrentUserId(session),
  });
  const digest = externalImportPlanDigest(plan);
  return new NextResponse(canonicalExternalImportPlan(plan), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${plan.batchId}-${digest}.json"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-External-Import-Plan-Sha256": digest,
    },
  });
}
