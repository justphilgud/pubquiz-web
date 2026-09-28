import { readFile, writeFile } from "node:fs/promises";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../../app/generated/prisma/client";
import { createExternalQuestionRecord } from "../../app/fragen/import/external/externalQuestionWriteService";
import {
  OneTimeExternalImportAuthorization,
  evaluateExternalImportGuard,
  externalImportApprovalMetadata,
  externalImportPlanDigest,
  externalImportPreflightDigest,
  preflightExternalImport,
  validateExternalImportPlan,
  type ExistingExternalQuestion,
  type ExternalImportPlan,
  type ExternalImportPlanItem,
  type ExternalImportWriteAuthorization,
  type ProductionIdentity,
} from "../../app/fragen/import/external/productionImportGuard";
import {
  runProductionExternalImport,
  type ExternalImportWriteAudit,
} from "../../app/fragen/import/external/productionImportWriter";
import {
  runProductionWriterPhase,
  safeProductionWriterFailure,
} from "../../app/fragen/import/external/productionWriterDiagnostics";
import { fetchVerifiedExternalImportReviewerApproval } from "../../app/fragen/import/external/reviewerApproval";
import { assertDatabase, assertOperationTransport, DATABASES } from "../operations/guards";
import { loadExternalImportBackupEvidence, verifyBackupWorkflowRun } from "./backup-evidence";
import { readProductionExternalImportPreflight } from "./production-preflight";

const { Pool } = pg;
const EXPECTED_WORKFLOW = "justphilgud/pubquiz-web/.github/workflows/external-question-import.yml@refs/heads/main";

function required(value: string | undefined, code: string) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toExistingQuestion(row: {
  fragen_id: number;
  frage: string;
  antworten: readonly { antwort: string }[];
  external_import_item: {
    provider: string;
    external_reference: string;
    content_fingerprint: string;
  } | null;
}): ExistingExternalQuestion {
  return {
    questionId: row.fragen_id,
    question: row.frage,
    correctAnswer: row.antworten[0]?.antwort ?? null,
    sourceType: row.external_import_item?.provider ?? null,
    externalReference: row.external_import_item?.external_reference ?? null,
    contentFingerprint: row.external_import_item?.content_fingerprint ?? null,
  };
}

async function transactionPreflight(
  transaction: Prisma.TransactionClient,
  plan: ExternalImportPlan,
  item: ExternalImportPlanItem,
) {
  const questions = await transaction.fragen.findMany({
    where: { ist_archiviert: false },
    orderBy: { fragen_id: "asc" },
    select: {
      fragen_id: true,
      frage: true,
      antworten: {
        where: { ist_richtig: true },
        orderBy: { antwort_id: "asc" },
        take: 1,
        select: { antwort: true },
      },
      external_import_item: {
        select: {
          provider: true,
          external_reference: true,
          content_fingerprint: true,
        },
      },
    },
  });
  const orphanMappings = await transaction.external_question_import_items.findMany({
    where: { question_id: null },
    orderBy: { import_item_id: "asc" },
    select: {
      original_question: true,
      original_correct_answer: true,
      provider: true,
      external_reference: true,
      content_fingerprint: true,
    },
  });
  const existing: ExistingExternalQuestion[] = [
    ...questions.map(toExistingQuestion),
    ...orphanMappings.map((mapping) => ({
      questionId: 0,
      question: mapping.original_question,
      correctAnswer: mapping.original_correct_answer,
      sourceType: mapping.provider,
      externalReference: mapping.external_reference,
      contentFingerprint: mapping.content_fingerprint,
    })),
  ];
  const approval = plan.importApproval.records.find(
    (record) => record.candidateId === item.candidateId,
  );
  if (!approval) throw new Error("EXTERNAL_IMPORT_DURABLE_REVIEW_MISSING");
  return preflightExternalImport(
    {
      ...plan,
      items: [item],
      importApproval: { ...plan.importApproval, records: [approval] } as ExternalImportPlan["importApproval"],
    },
    existing,
  ).items[0];
}

function approvalSummary(plan: ExternalImportPlan) {
  return plan.importApproval.approvalMode === "AUTOMATED_QUALITY_GATE"
    ? {
        approvalMode: plan.importApproval.approvalMode,
        policyVersion: plan.importApproval.policyVersion,
      }
    : { approvalMode: "HUMAN_REVIEW" as const, policyVersion: null };
}

async function findOrCreateAuditBatch(
  transaction: Prisma.TransactionClient,
  plan: ExternalImportPlan,
  planDigest: string,
) {
  const recent = await transaction.external_question_import_batches.findMany({
    where: { provider: plan.sourceType },
    orderBy: { started_at: "desc" },
    take: 100,
    select: { import_batch_id: true, report_json: true },
  });
  const existing = recent.find((batch) => {
    const report = batch.report_json;
    return report !== null && typeof report === "object" && !Array.isArray(report) &&
      report.kind === "production-external-import" &&
      report.planDigest === planDigest && report.batchId === plan.batchId;
  });
  if (existing) return existing.import_batch_id;
  const created = await transaction.external_question_import_batches.create({
    data: {
      provider: plan.sourceType,
      requested_count: plan.items.length,
      fetched_count: plan.items.length,
      status: "PROCESSING",
      created_by_user_id: plan.operatorUserId,
      report_json: safeJson({
        kind: "production-external-import",
        batchId: plan.batchId,
        planDigest,
        ...approvalSummary(plan),
        state: "PROCESSING",
      }),
    },
    select: { import_batch_id: true },
  });
  return created.import_batch_id;
}

async function importPlanItem(input: {
  prisma: PrismaClient;
  plan: ExternalImportPlan;
  item: ExternalImportPlanItem;
  planDigest: string;
}) {
  return runProductionWriterPhase("COMMIT", {
    operation: "commit",
    candidateId: input.item.candidateId,
  }, () => input.prisma.$transaction(async (transaction) => {
    const decision = await runProductionWriterPhase("TRANSACTION_BEGIN", {
      operation: "read",
      candidateId: input.item.candidateId,
    }, () => transactionPreflight(transaction, input.plan, input.item));
    if (decision.decision === "ALREADY_PRESENT" && decision.existingQuestionId) {
      return { questionId: decision.existingQuestionId, alreadyPresent: true };
    }
    if (decision.decision !== "CREATE") {
      throw new Error(`EXTERNAL_IMPORT_TOCTOU_${decision.decision}`);
    }
    const approval = externalImportApprovalMetadata(
      input.plan,
      input.item.candidateId,
    );
    const batchId = await runProductionWriterPhase("AUDIT", {
      operation: "insert",
      candidateId: input.item.candidateId,
      relation: "external_question_import_batches",
    }, () => findOrCreateAuditBatch(transaction, input.plan, input.planDigest));
    const question = await runProductionWriterPhase("QUESTION_CREATE", {
      operation: "insert",
      candidateId: input.item.candidateId,
      relation: "fragen",
    }, () => createExternalQuestionRecord(transaction, {
      operatorUserId: input.plan.operatorUserId,
      sourceType: input.plan.sourceType,
      externalReference: input.item.externalReference,
      prepared: input.item.prepared,
      verificationSources: input.item.verification.sources,
      license: input.item.license,
    }));
    await runProductionWriterPhase("EXTERNAL_MAPPING", {
      operation: "insert",
      candidateId: input.item.candidateId,
      relation: "external_question_import_items",
    }, () => transaction.external_question_import_items.create({
      data: {
        import_batch_id: batchId,
        provider: input.plan.sourceType,
        external_reference: input.item.externalReference,
        license: input.item.license.name,
        license_url: input.item.license.url,
        original_language: input.item.original.language,
        original_category: input.item.original.category,
        original_difficulty: input.item.original.difficulty,
        original_type: input.item.original.type,
        original_question: input.item.original.question,
        original_correct_answer: input.item.original.correctAnswer,
        original_incorrect_answers: safeJson(input.item.original.incorrectAnswers),
        provider_payload_json: safeJson({
          sourcePayload: input.item.original.providerPayload,
          productionImport: {
            batchId: input.plan.batchId,
            planDigest: input.planDigest,
            candidateId: input.item.candidateId,
            approvalMode: approval.approvalMode,
            policyVersion: approval.policyVersion,
          },
        }),
        prepared_question: input.item.prepared.question,
        prepared_correct_answer: input.item.prepared.correctAnswer,
        prepared_incorrect_answers: safeJson(input.item.prepared.distractors),
        explanation: input.item.prepared.explanation,
        localization_status: "LOCALIZED",
        verification_status: "VERIFIED",
        verification_sources: safeJson(input.item.verification.sources),
        suggested_category_name: input.item.prepared.category,
        mapped_difficulty: input.item.prepared.difficulty,
        status: "APPROVED",
        issue_codes: safeJson([]),
        duplicate_candidates: safeJson([]),
        automation_changes: safeJson([]),
        content_fingerprint: input.item.contentFingerprint,
        question_id: question.fragen_id,
        verified_at: new Date(input.plan.frozenAt),
        review_started_at: new Date(approval.approvedAt),
        reviewed_at: new Date(approval.approvedAt),
        reviewed_by_user_id: approval.reviewedByUserId,
      },
    }));
    const imported = await runProductionWriterPhase("AUDIT", {
      operation: "read",
      candidateId: input.item.candidateId,
      relation: "external_question_import_items",
    }, () => transaction.external_question_import_items.count({
      where: { import_batch_id: batchId, question_id: { not: null } },
    }));
    await runProductionWriterPhase("AUDIT", {
      operation: "update",
      candidateId: input.item.candidateId,
      relation: "external_question_import_batches",
    }, () => transaction.external_question_import_batches.update({
      where: { import_batch_id: batchId },
      data: {
        status: imported === input.plan.items.length ? "COMPLETED" : "PROCESSING",
        completed_at: imported === input.plan.items.length ? new Date() : null,
        report_json: safeJson({
          kind: "production-external-import",
          batchId: input.plan.batchId,
          planDigest: input.planDigest,
          ...approvalSummary(input.plan),
          imported,
          requested: input.plan.items.length,
          state: imported === input.plan.items.length ? "COMPLETED" : "PROCESSING",
        }),
      },
    }));
    return { questionId: question.fragen_id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

async function persistAudit(input: {
  prisma: PrismaClient;
  plan: ExternalImportPlan;
  planDigest: string;
  audit: ExternalImportWriteAudit;
}) {
  await runProductionWriterPhase("AUDIT", {
    operation: "update",
    relation: "external_question_import_batches",
  }, () => input.prisma.$transaction(async (transaction) => {
    const batchId = await findOrCreateAuditBatch(transaction, input.plan, input.planDigest);
    await transaction.external_question_import_batches.update({
      where: { import_batch_id: batchId },
      data: {
        status: input.audit.result === "COMPLETED" ? "COMPLETED" : "FAILED",
        completed_at: new Date(input.audit.completedAt),
        error_message: input.audit.result === "COMPLETED" ? null : "EXTERNAL_IMPORT_BATCH_INCOMPLETE",
        report_json: safeJson({
          kind: "production-external-import",
          batchId: input.plan.batchId,
          planDigest: input.planDigest,
          ...approvalSummary(input.plan),
          audit: input.audit,
        }),
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function productionExternalImport(input: {
  planPath: string;
  preflightPath: string;
  backupEvidencePath: string;
  auditPath: string;
  environment?: Readonly<Record<string, string | undefined>>;
  now?: Date;
}) {
  const env = input.environment ?? process.env;
  const planValue = JSON.parse(await readFile(input.planPath, "utf8")) as unknown;
  validateExternalImportPlan(planValue);
  const plan = planValue as ExternalImportPlan;
  const planDigest = externalImportPlanDigest(plan);
  const suppliedDigest = required(env.EXTERNAL_IMPORT_PLAN_SHA256, "EXTERNAL_IMPORT_DIGEST_REQUIRED");
  if (planDigest !== suppliedDigest) throw new Error("EXTERNAL_IMPORT_DIGEST_MISMATCH");
  if (plan.batchId !== required(env.EXTERNAL_IMPORT_BATCH_ID, "EXTERNAL_IMPORT_BATCH_ID_REQUIRED")) {
    throw new Error("EXTERNAL_IMPORT_BATCH_MISMATCH");
  }
  const productionSha = required(env.EXTERNAL_IMPORT_PRODUCTION_SHA, "EXTERNAL_IMPORT_PRODUCTION_SHA_REQUIRED");
  if (productionSha !== required(env.PRODUCTION_RELEASE_SHA, "EXTERNAL_IMPORT_TRUSTED_RELEASE_REQUIRED")) {
    throw new Error("EXTERNAL_IMPORT_PRODUCTION_SHA_MISMATCH");
  }
  if (
    env.GITHUB_REPOSITORY !== "justphilgud/pubquiz-web" || env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_WORKFLOW_REF !== EXPECTED_WORKFLOW ||
    env.EXTERNAL_IMPORT_GITHUB_ENVIRONMENT !== "operations-content-import"
  ) throw new Error("EXTERNAL_IMPORT_EXECUTION_CONTEXT_INVALID");

  const backupRun = required(env.EXTERNAL_IMPORT_BACKUP_RUN, "EXTERNAL_IMPORT_BACKUP_RUN_REQUIRED");
  const backupAttempt = required(env.EXTERNAL_IMPORT_BACKUP_ATTEMPT, "EXTERNAL_IMPORT_BACKUP_ATTEMPT_REQUIRED");
  const backupId = required(env.EXTERNAL_IMPORT_BACKUP_ID, "EXTERNAL_IMPORT_BACKUP_ID_REQUIRED");
  const backupManifest = required(env.EXTERNAL_IMPORT_BACKUP_MANIFEST_SHA256, "EXTERNAL_IMPORT_BACKUP_MANIFEST_REQUIRED");
  const githubToken = required(env.GITHUB_TOKEN, "EXTERNAL_IMPORT_GITHUB_TOKEN_REQUIRED");
  await verifyBackupWorkflowRun({
    repository: required(env.GITHUB_REPOSITORY, "EXTERNAL_IMPORT_REPOSITORY_REQUIRED"),
    run: backupRun,
    attempt: backupAttempt,
    token: githubToken,
  });
  const backup = await loadExternalImportBackupEvidence({
    path: input.backupEvidencePath,
    run: backupRun,
    attempt: backupAttempt,
    backupId,
    manifestSha256: backupManifest,
    productionSha,
  });
  const connectionString = await runProductionWriterPhase("WRITER_SECRET", {
    operation: "verify",
  }, () => required(env.PRODUCTION_IMPORT_DATABASE_URL, "EXTERNAL_IMPORT_WRITER_REQUIRED"));
  const identity = await runProductionWriterPhase("DB_IDENTITY", {
    operation: "verify",
  }, () => {
    const value = assertDatabase(connectionString, "production");
    assertOperationTransport(new URL(connectionString));
    return value;
  });
  const actualDatabase: ProductionIdentity = {
    host: identity.host,
    database: identity.name,
    schema: identity.schema,
  };
  const expectedDatabase: ProductionIdentity = {
    host: DATABASES.production.host,
    database: DATABASES.production.name,
    schema: DATABASES.production.schema,
  };
  const preReview = JSON.parse(await readFile(input.preflightPath, "utf8")) as {
    preflightDigest?: unknown;
  };
  const current = await runProductionWriterPhase("DB_CONNECTION", {
    operation: "read",
  }, () => readProductionExternalImportPreflight({ connectionString, plan }));
  const currentPreflightDigest = externalImportPreflightDigest(current.preflight);
  if (preReview.preflightDigest !== currentPreflightDigest) {
    throw new Error("EXTERNAL_IMPORT_TOCTOU_PREFLIGHT_CHANGED");
  }
  const workflowRun = required(env.GITHUB_RUN_ID, "EXTERNAL_IMPORT_WORKFLOW_RUN_REQUIRED");
  const workflowRunAttempt = required(env.GITHUB_RUN_ATTEMPT, "EXTERNAL_IMPORT_WORKFLOW_ATTEMPT_REQUIRED");
  const reviewerApproval = await runProductionWriterPhase("AUTHORIZATION", {
    operation: "verify",
  }, () => fetchVerifiedExternalImportReviewerApproval({
    repository: required(env.GITHUB_REPOSITORY, "EXTERNAL_IMPORT_REPOSITORY_REQUIRED"),
    runId: workflowRun,
    runAttempt: workflowRunAttempt,
    planDigest,
    candidateIds: plan.items.map((item) => item.candidateId),
    backupId,
    token: githubToken,
  }));
  const authorization: ExternalImportWriteAuthorization = {
    writeAuthorized: true,
    batchId: plan.batchId,
    planDigest,
    productionSha,
    backupId,
    backupRun,
    backupAttempt,
    manifestSha256: backupManifest,
    workflowRun,
    workflowRunAttempt,
    productionIdentity: expectedDatabase,
  };
  const guard = await runProductionWriterPhase("AUTHORIZATION", {
    operation: "verify",
  }, () => evaluateExternalImportGuard({
    mode: "write",
    now: input.now ?? new Date(),
    plan,
    suppliedDigest,
    execution: {
      logicalEnvironment: "production",
      kind: "github-actions",
      repository: env.GITHUB_REPOSITORY,
      ref: env.GITHUB_REF,
      eventName: env.GITHUB_EVENT_NAME,
      workflowRef: env.GITHUB_WORKFLOW_REF,
      expectedWorkflowRef: EXPECTED_WORKFLOW,
      githubEnvironment: env.EXTERNAL_IMPORT_GITHUB_ENVIRONMENT,
      workflowRun,
      workflowRunAttempt,
    },
    actualDatabase,
    expectedDatabase,
    currentProductionSha: productionSha,
    preflight: current.preflight,
    backup,
    authorization,
    reviewerApproval,
  }));
  if (!guard.writeAuthorized) throw new Error("EXTERNAL_IMPORT_GUARD_BLOCKED");

  const pool = new Pool({ connectionString, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const session = await runProductionWriterPhase("DB_CONNECTION", {
      operation: "read",
    }, () => prisma.$queryRaw<Array<{
      role: string;
      database: string;
      superuser: boolean;
      createdb: boolean;
      createrole: boolean;
      replication: boolean;
      bypassrls: boolean;
    }>>(Prisma.sql`
      SELECT current_user::text AS role,
             current_database()::text AS database,
             r.rolsuper AS superuser,
             r.rolcreatedb AS createdb,
             r.rolcreaterole AS createrole,
             r.rolreplication AS replication,
             r.rolbypassrls AS bypassrls
      FROM pg_catalog.pg_roles r
      WHERE r.rolname = current_user
    `));
    const role = session[0];
    await runProductionWriterPhase("DB_IDENTITY", { operation: "verify" }, () => {
      if (
        role?.role !== "pubquiz_external_import_writer" ||
        role.database !== DATABASES.production.name || role.superuser || role.createdb ||
        role.createrole || role.replication || role.bypassrls
      ) throw new Error("EXTERNAL_IMPORT_WRITER_ROLE_INVALID");
    });
    const operator = await runProductionWriterPhase("AUTHORIZATION", {
      operation: "read",
      relation: "users",
    }, () => prisma.users.findFirst({
      where: {
        id: plan.operatorUserId,
        is_active: true,
        rollenzuweisungen: { some: { scope_typ: "GLOBAL", rolle: "ADMIN" } },
      },
      select: { id: true },
    }));
    if (!operator) throw new Error("EXTERNAL_IMPORT_OPERATOR_NOT_ACTIVE_ADMIN");
    const authorizationLatch = new OneTimeExternalImportAuthorization();
    const audit = await runProductionExternalImport({
      guard,
      authorization: authorizationLatch,
      plan,
      planDigest,
      productionSha,
      backupId,
      workflowRun,
      preflight: current.preflight,
      importItem: (item) => importPlanItem({ prisma, plan, item, planDigest }),
      recordAudit: (audit) => persistAudit({ prisma, plan, planDigest, audit }),
      classifyItemError: safeProductionWriterFailure,
    });
    await runProductionWriterPhase("SELF_CLOSE", { operation: "close" }, () => {
      if (authorizationLatch.writeAuthorized) {
        throw new Error("EXTERNAL_IMPORT_AUTHORIZATION_NOT_CLOSED");
      }
    });
    await runProductionWriterPhase("AUDIT", { operation: "insert" }, () =>
      writeFile(input.auditPath, `${JSON.stringify(audit)}\n`, { mode: 0o600 }));
    if (audit.result !== "COMPLETED") {
      const failure = audit.items.find((item) => item.status === "FAILED")?.reason;
      throw new Error(failure ?? "EXTERNAL_IMPORT_BATCH_FAILED");
    }
    return audit;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main() {
  const audit = await productionExternalImport({
    planPath: required(process.argv[2], "EXTERNAL_IMPORT_PLAN_PATH_REQUIRED"),
    preflightPath: required(process.argv[3], "EXTERNAL_IMPORT_PREFLIGHT_PATH_REQUIRED"),
    backupEvidencePath: required(process.argv[4], "EXTERNAL_IMPORT_BACKUP_EVIDENCE_PATH_REQUIRED"),
    auditPath: required(process.argv[5], "EXTERNAL_IMPORT_AUDIT_PATH_REQUIRED"),
  });
  process.stdout.write(`${JSON.stringify({
    batchId: audit.batchId,
    result: audit.result,
    imported: audit.items.filter((item) => item.status === "IMPORTED").length,
    alreadyPresent: audit.items.filter((item) => item.status === "ALREADY_PRESENT").length,
    writeAuthorized: audit.writeAuthorized,
  })}\n`);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/external-import/production-writer.ts")) {
  main().catch((error) => {
    const code = safeProductionWriterFailure(error);
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
