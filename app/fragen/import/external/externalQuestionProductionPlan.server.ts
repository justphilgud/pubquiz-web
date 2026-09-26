import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  getDatabaseConnectionInfo,
  getLogicalEnvironment,
} from "@/config/environment";
import { DATABASES } from "@/scripts/operations/guards";
import {
  evaluateExternalImportGuard,
  externalImportPlanDigest,
  type ExternalImportPlan,
  type ExternalImportPlanItem,
  type ProductionIdentity,
} from "./productionImportGuard";
import type { ExternalQuestionVerificationSource } from "./types";

function stringArray(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function sourceArray(value: Prisma.JsonValue | null): ExternalQuestionVerificationSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      !entry || typeof entry !== "object" || Array.isArray(entry) ||
      typeof entry.title !== "string" || typeof entry.url !== "string"
    ) return [];
    return [{ title: entry.title, url: entry.url }];
  });
}

function sourceType(provider: string) {
  const normalized = provider.trim().replace(/[^A-Za-z0-9._-]+/g, "-");
  if (!normalized) throw new Error("EXTERNAL_IMPORT_SOURCE_INVALID");
  return normalized;
}

export async function buildExternalQuestionProductionPlan(input: {
  batchId: number;
  operatorUserId: number;
}): Promise<ExternalImportPlan> {
  const batch = await prisma.external_question_import_batches.findUnique({
    where: { import_batch_id: input.batchId },
    include: {
      items: {
        where: { status: "APPROVED", question_id: { not: null } },
        orderBy: { import_item_id: "asc" },
      },
    },
  });
  if (!batch) throw new Error("EXTERNAL_IMPORT_BATCH_NOT_FOUND");
  if (batch.items.length === 0) throw new Error("EXTERNAL_IMPORT_PLAN_EMPTY");
  const frozenAt = batch.items.reduce(
    (latest, item) => {
      const timestamp = item.reviewed_at ?? item.imported_at;
      return timestamp > latest ? timestamp : latest;
    },
    batch.started_at,
  );
  const items = batch.items.map<ExternalImportPlanItem>((item) => {
    if (!item.prepared_question || !item.prepared_correct_answer) {
      throw new Error("EXTERNAL_IMPORT_PREPARATION_MISSING");
    }
    return {
      candidateId: String(item.import_item_id),
      externalReference: item.external_reference,
      contentFingerprint: item.content_fingerprint,
      original: {
        language: item.original_language,
        category: item.original_category,
        difficulty: item.original_difficulty,
        type: item.original_type,
        question: item.original_question,
        correctAnswer: item.original_correct_answer,
        incorrectAnswers: stringArray(item.original_incorrect_answers),
        providerPayload: item.provider_payload_json,
      },
      prepared: {
        question: item.prepared_question,
        correctAnswer: item.prepared_correct_answer,
        distractors: stringArray(item.prepared_incorrect_answers),
        explanation: item.explanation,
        difficulty: Number(item.mapped_difficulty ?? 1),
        category: item.suggested_category_name,
      },
      verification: {
        status: item.verification_status,
        sources: sourceArray(item.verification_sources),
      },
      // An APPROVED staging item has completed the human decision. The regular
      // question created later still enters IN_REVIEW and remains unpublished.
      reviewStatus: "READY_FOR_REVIEW",
      license: { name: item.license, url: item.license_url },
      media: [],
    };
  });
  return {
    version: 1,
    batchId: `${sourceType(batch.provider).toLocaleLowerCase("en")}-batch-${batch.import_batch_id}`,
    sourceType: sourceType(batch.provider),
    frozenAt: frozenAt.toISOString(),
    operatorUserId: input.operatorUserId,
    items,
  };
}

export async function loadExternalImportProductionGuardPreview(input: {
  batchId: number;
  operatorUserId: number;
}) {
  const plan = await buildExternalQuestionProductionPlan(input);
  const digest = externalImportPlanDigest(plan);
  const logicalEnvironment = getLogicalEnvironment();
  const database = getDatabaseConnectionInfo();
  const actualDatabase: ProductionIdentity = {
    host: database.host,
    database: database.database,
    schema: database.schema,
  };
  const expectedDatabase: ProductionIdentity = {
    host: DATABASES.production.host,
    database: DATABASES.production.name,
    schema: DATABASES.production.schema,
  };
  const emptyPreflight = {
    items: [],
    counts: { CREATE: 0, ALREADY_PRESENT: 0, CONFLICT: 0, REVIEW_REQUIRED: 0 },
  } as const;
  const guard = evaluateExternalImportGuard({
    mode: "dry-run",
    now: new Date(),
    plan,
    suppliedDigest: digest,
    execution: {
      logicalEnvironment,
      kind: process.env.VERCEL === "1" ? "vercel" : "local",
      vercelEnvironment: process.env.VERCEL_ENV,
      vercelProjectId: process.env.VERCEL_PROJECT_ID,
      expectedVercelProjectId: process.env.EXTERNAL_IMPORT_PRODUCTION_VERCEL_PROJECT_ID,
    },
    actualDatabase,
    expectedDatabase,
    currentProductionSha: process.env.PRODUCTION_RELEASE_SHA ?? "",
    preflight: emptyPreflight,
  });
  return {
    environment: logicalEnvironment.toUpperCase(),
    batchId: plan.batchId,
    digest,
    itemCount: plan.items.length,
    readyForReview: plan.items.filter((item) => item.reviewStatus === "READY_FOR_REVIEW").length,
    reviewRequired: plan.items.filter((item) => item.reviewStatus === "REVIEW_REQUIRED").length,
    dbIdentityConfirmed: guard.gates.database,
    productionPreflight: "NOT_RUN" as const,
    backupStatus: "NOT_PROVIDED" as const,
    writeAuthorized: false as const,
    guardFailures: guard.failures,
  };
}
