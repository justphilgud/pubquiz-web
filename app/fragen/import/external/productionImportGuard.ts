import { createHash } from "node:crypto";

import {
  calculateQuestionSimilarity,
  normalizeQuestionForSimilarity,
} from "@/app/fragen/editor/questionSimilarity";
import {
  isVerifiedExternalImportReviewerApproval,
  type VerifiedExternalImportReviewerApproval,
} from "./reviewerApproval";
import {
  countIndependentReliableSourceHosts,
  hasStrongPrimaryOrOfficialSource,
} from "./sourceReliability";

export const EXTERNAL_IMPORT_PLAN_VERSION = 1 as const;
export const EXTERNAL_IMPORT_BACKUP_MAX_AGE_MS = 2 * 60 * 60 * 1000;
export const EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION =
  "production-auto-quality-v2" as const;

export type ExternalImportReviewStatus =
  | "READY_FOR_REVIEW"
  | "REVIEW_REQUIRED";

export type ExternalImportPlanItem = Readonly<{
  candidateId: string;
  externalReference: string;
  contentFingerprint: string;
  original: Readonly<{
    language: string;
    category: string;
    difficulty: string;
    type: string;
    question: string;
    correctAnswer: string;
    incorrectAnswers: readonly string[];
    providerPayload: unknown;
  }>;
  prepared: Readonly<{
    question: string;
    correctAnswer: string;
    distractors: readonly string[];
    explanation: string | null;
    difficulty: number;
    category: string | null;
  }>;
  verification: Readonly<{
    status: string;
    sources: readonly Readonly<{ title: string; url: string }>[];
  }>;
  autoQualityEvidence?: Readonly<{
    classification: "AUTO_APPROVED_FOR_PRODUCTION";
    policyVersion: typeof EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION;
    localizationStatus: "LOCALIZED";
    qualityStatus: "READY_FOR_REVIEW";
    issueCodes: readonly [];
    hasStrongPrimaryOrOfficialSource: boolean;
    independentReliableSourceHosts: number;
  }>;
  reviewStatus: ExternalImportReviewStatus;
  license: Readonly<{ name: string; url: string }>;
  media: readonly Readonly<{
    sourceUrl: string;
    license: string;
    mimeType: string;
    expectedBytes: number | null;
    sha256: string | null;
    target: string;
  }>[];
}>;

export type ExternalImportPlan = Readonly<{
  version: typeof EXTERNAL_IMPORT_PLAN_VERSION;
  batchId: string;
  sourceType: string;
  frozenAt: string;
  operatorUserId: number;
  importApproval:
    | Readonly<{
        approvalMode?: "HUMAN_REVIEW";
        records: readonly Readonly<{
          candidateId: string;
          sourceStatus: "APPROVED";
          reviewedByUserId: number;
          reviewedAt: string;
        }>[];
      }>
    | Readonly<{
        approvalMode: "AUTOMATED_QUALITY_GATE";
        policyVersion: typeof EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION;
        records: readonly Readonly<{
          candidateId: string;
          sourceStatus: "APPROVED";
          evaluatedAt: string;
        }>[];
      }>;
  items: readonly ExternalImportPlanItem[];
}>;

export type ExternalImportApprovalMetadata = Readonly<{
  approvalMode: "HUMAN_REVIEW" | "AUTOMATED_QUALITY_GATE";
  approvedAt: string;
  reviewedByUserId: number | null;
  policyVersion: typeof EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION | null;
}>;

export type ExistingExternalQuestion = Readonly<{
  questionId: number;
  question: string;
  correctAnswer: string | null;
  sourceType: string | null;
  externalReference: string | null;
  contentFingerprint: string | null;
}>;

export type ExternalImportPreflightDecision =
  | "CREATE"
  | "ALREADY_PRESENT"
  | "CONFLICT"
  | "REVIEW_REQUIRED";

export type ExternalImportPreflightItem = Readonly<{
  candidateId: string;
  externalReference: string;
  decision: ExternalImportPreflightDecision;
  existingQuestionId: number | null;
  reason: string;
}>;

export type ExternalImportPreflight = Readonly<{
  items: readonly ExternalImportPreflightItem[];
  counts: Readonly<Record<ExternalImportPreflightDecision, number>>;
}>;

export type ProductionIdentity = Readonly<{
  host: string;
  database: string;
  schema: string;
}>;

export type ExternalImportBackupEvidence = Readonly<{
  version: 1;
  backupId: string;
  backupRun: string;
  backupAttempt: string;
  snapshotAt: string;
  completedAt: string;
  productionSha: string;
  manifestSha256: string;
  source: ProductionIdentity;
  completed: boolean;
  manifestPresent: boolean;
  readbackVerified: boolean;
  integrityVerified: boolean;
}>;

export type ExternalImportWriteAuthorization = Readonly<{
  writeAuthorized: boolean;
  batchId: string;
  planDigest: string;
  productionSha: string;
  backupId: string;
  backupRun: string;
  backupAttempt: string;
  manifestSha256: string;
  workflowRun: string;
  workflowRunAttempt: string;
  productionIdentity: ProductionIdentity;
}>;

export type ExternalImportExecutionIdentity = Readonly<{
  logicalEnvironment: "development" | "preview" | "production" | "unknown";
  kind: "vercel" | "github-actions" | "local" | "unknown";
  vercelEnvironment?: string;
  vercelProjectId?: string;
  expectedVercelProjectId?: string;
  repository?: string;
  ref?: string;
  eventName?: string;
  workflowRef?: string;
  expectedWorkflowRef?: string;
  githubEnvironment?: string;
  workflowRun?: string;
  workflowRunAttempt?: string;
}>;

export type ExternalImportGuardInput = Readonly<{
  mode: "dry-run" | "write";
  now: Date;
  plan: ExternalImportPlan;
  suppliedDigest: string;
  execution: ExternalImportExecutionIdentity;
  actualDatabase: ProductionIdentity;
  expectedDatabase: ProductionIdentity;
  currentProductionSha: string;
  preflight: ExternalImportPreflight;
  backup?: ExternalImportBackupEvidence;
  authorization?: ExternalImportWriteAuthorization;
  reviewerApproval?: VerifiedExternalImportReviewerApproval;
}>;

export type ExternalImportGuardResult = Readonly<{
  dryRun: boolean;
  writeAuthorized: boolean;
  gates: Readonly<{
    plan: boolean;
    digest: boolean;
    environment: boolean;
    host: boolean;
    database: boolean;
    preflight: boolean;
    backup: boolean;
    reviewer: boolean;
    authorization: boolean;
  }>;
  failures: readonly string[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, code: string, max = 2_000): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(code);
  }
}

function assertUrl(value: unknown, code: string) {
  assertNonEmptyString(value, code);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(code);
  }
  if (url.protocol !== "https:") throw new Error(code);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  );
}

export function canonicalExternalImportPlan(plan: ExternalImportPlan) {
  return `${JSON.stringify(stableValue(plan))}\n`;
}

export function externalImportPlanDigest(plan: ExternalImportPlan) {
  validateExternalImportPlan(plan);
  return createHash("sha256")
    .update(canonicalExternalImportPlan(plan), "utf8")
    .digest("hex");
}

export function externalImportPreflightDigest(preflight: ExternalImportPreflight) {
  return createHash("sha256")
    .update(`${JSON.stringify(stableValue(preflight))}\n`, "utf8")
    .digest("hex");
}

export function validateExternalImportPlan(value: unknown): asserts value is ExternalImportPlan {
  if (!isRecord(value) || value.version !== EXTERNAL_IMPORT_PLAN_VERSION) {
    throw new Error("EXTERNAL_IMPORT_PLAN_VERSION_INVALID");
  }
  assertNonEmptyString(value.batchId, "EXTERNAL_IMPORT_BATCH_ID_INVALID", 128);
  if (!/^[a-z0-9][a-z0-9._-]+$/.test(value.batchId)) {
    throw new Error("EXTERNAL_IMPORT_BATCH_ID_INVALID");
  }
  assertNonEmptyString(value.sourceType, "EXTERNAL_IMPORT_SOURCE_INVALID", 80);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]+$/.test(value.sourceType)) {
    throw new Error("EXTERNAL_IMPORT_SOURCE_INVALID");
  }
  assertNonEmptyString(value.frozenAt, "EXTERNAL_IMPORT_FROZEN_AT_INVALID", 64);
  if (!Number.isFinite(Date.parse(value.frozenAt))) {
    throw new Error("EXTERNAL_IMPORT_FROZEN_AT_INVALID");
  }
  if (typeof value.operatorUserId !== "number" || !Number.isInteger(value.operatorUserId) || value.operatorUserId < 1) {
    throw new Error("EXTERNAL_IMPORT_OPERATOR_INVALID");
  }
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 1_000) {
    throw new Error("EXTERNAL_IMPORT_ITEMS_INVALID");
  }
  if (!isRecord(value.importApproval) || !Array.isArray(value.importApproval.records)) {
    throw new Error("EXTERNAL_IMPORT_APPROVAL_INVALID");
  }
  const approvalMode = value.importApproval.approvalMode ?? "HUMAN_REVIEW";
  if (approvalMode !== "HUMAN_REVIEW" && approvalMode !== "AUTOMATED_QUALITY_GATE") {
    throw new Error("EXTERNAL_IMPORT_APPROVAL_MODE_INVALID");
  }
  if (
    approvalMode === "AUTOMATED_QUALITY_GATE" &&
    value.importApproval.policyVersion !== EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION
  ) {
    throw new Error("EXTERNAL_IMPORT_AUTO_POLICY_INVALID");
  }
  const candidateIds = new Set<string>();
  const references = new Set<string>();
  for (const item of value.items) {
    if (!isRecord(item)) throw new Error("EXTERNAL_IMPORT_ITEM_INVALID");
    assertNonEmptyString(item.candidateId, "EXTERNAL_IMPORT_CANDIDATE_ID_INVALID", 128);
    assertNonEmptyString(item.externalReference, "EXTERNAL_IMPORT_REFERENCE_INVALID", 128);
    if (candidateIds.has(item.candidateId) || references.has(item.externalReference)) {
      throw new Error("EXTERNAL_IMPORT_ITEM_DUPLICATE");
    }
    candidateIds.add(item.candidateId);
    references.add(item.externalReference);
    if (typeof item.contentFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(item.contentFingerprint)) {
      throw new Error("EXTERNAL_IMPORT_FINGERPRINT_INVALID");
    }
    if (!isRecord(item.original) || !isRecord(item.prepared) || !isRecord(item.verification)) {
      throw new Error("EXTERNAL_IMPORT_ITEM_INVALID");
    }
    for (const [field, fieldValue] of Object.entries({
      originalLanguage: item.original.language,
      originalCategory: item.original.category,
      originalDifficulty: item.original.difficulty,
      originalType: item.original.type,
      originalQuestion: item.original.question,
      originalCorrectAnswer: item.original.correctAnswer,
      preparedQuestion: item.prepared.question,
      preparedCorrectAnswer: item.prepared.correctAnswer,
    })) {
      assertNonEmptyString(fieldValue, `EXTERNAL_IMPORT_${field.toUpperCase()}_INVALID`);
    }
    if (!Array.isArray(item.original.incorrectAnswers)) {
      throw new Error("EXTERNAL_IMPORT_ORIGINAL_ANSWERS_INVALID");
    }
    if (!Array.isArray(item.prepared.distractors) || item.prepared.distractors.length !== 3) {
      throw new Error("EXTERNAL_IMPORT_ANSWERS_INVALID");
    }
    const answers = [item.prepared.correctAnswer, ...item.prepared.distractors]
      .map((answer) => String(answer).trim().toLocaleLowerCase("de"));
    if (answers.some((answer) => !answer) || new Set(answers).size !== 4) {
      throw new Error("EXTERNAL_IMPORT_ANSWERS_INVALID");
    }
    if (typeof item.prepared.difficulty !== "number" || !Number.isFinite(item.prepared.difficulty)) {
      throw new Error("EXTERNAL_IMPORT_DIFFICULTY_INVALID");
    }
    if (item.reviewStatus !== "READY_FOR_REVIEW" && item.reviewStatus !== "REVIEW_REQUIRED") {
      throw new Error("EXTERNAL_IMPORT_REVIEW_STATUS_INVALID");
    }
    if (!isRecord(item.license)) throw new Error("EXTERNAL_IMPORT_LICENSE_INVALID");
    assertNonEmptyString(item.license.name, "EXTERNAL_IMPORT_LICENSE_INVALID");
    assertUrl(item.license.url, "EXTERNAL_IMPORT_LICENSE_URL_INVALID");
    if (!Array.isArray(item.verification.sources) || !Array.isArray(item.media)) {
      throw new Error("EXTERNAL_IMPORT_PROVENANCE_INVALID");
    }
    for (const source of item.verification.sources) {
      assertNonEmptyString(source?.title, "EXTERNAL_IMPORT_SOURCE_TITLE_INVALID");
      assertUrl(source?.url, "EXTERNAL_IMPORT_SOURCE_URL_INVALID");
    }
    if (approvalMode === "AUTOMATED_QUALITY_GATE") {
      if (!isRecord(item.autoQualityEvidence)) {
        throw new Error("EXTERNAL_IMPORT_AUTO_QUALITY_EVIDENCE_MISSING");
      }
      if (
        item.autoQualityEvidence.classification !== "AUTO_APPROVED_FOR_PRODUCTION" ||
        item.autoQualityEvidence.policyVersion !== EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION ||
        item.autoQualityEvidence.localizationStatus !== "LOCALIZED" ||
        item.autoQualityEvidence.qualityStatus !== "READY_FOR_REVIEW" ||
        !Array.isArray(item.autoQualityEvidence.issueCodes) ||
        item.autoQualityEvidence.issueCodes.length !== 0 ||
        item.reviewStatus !== "READY_FOR_REVIEW" ||
        item.verification.status !== "VERIFIED" ||
        typeof item.prepared.category !== "string" || !item.prepared.category.trim()
      ) {
        throw new Error("EXTERNAL_IMPORT_AUTO_QUALITY_EVIDENCE_INVALID");
      }
      const independentHosts = countIndependentReliableSourceHosts(item.verification.sources);
      const strongPrimaryOrOfficialSource = hasStrongPrimaryOrOfficialSource(
        item.verification.sources,
      );
      if (
        (independentHosts < 2 && !strongPrimaryOrOfficialSource) ||
        item.autoQualityEvidence.hasStrongPrimaryOrOfficialSource !==
          strongPrimaryOrOfficialSource ||
        item.autoQualityEvidence.independentReliableSourceHosts !== independentHosts
      ) {
        throw new Error("EXTERNAL_IMPORT_AUTO_SOURCE_POLICY_INVALID");
      }
    } else if (item.autoQualityEvidence !== undefined) {
      throw new Error("EXTERNAL_IMPORT_AUTO_QUALITY_EVIDENCE_UNEXPECTED");
    }
    for (const medium of item.media) {
      assertUrl(medium?.sourceUrl, "EXTERNAL_IMPORT_MEDIA_SOURCE_INVALID");
      assertNonEmptyString(medium?.license, "EXTERNAL_IMPORT_MEDIA_LICENSE_INVALID");
      assertNonEmptyString(medium?.mimeType, "EXTERNAL_IMPORT_MEDIA_MIME_INVALID");
      assertNonEmptyString(medium?.target, "EXTERNAL_IMPORT_MEDIA_TARGET_INVALID");
      if (medium.expectedBytes !== null && (!Number.isInteger(medium.expectedBytes) || medium.expectedBytes < 1)) {
        throw new Error("EXTERNAL_IMPORT_MEDIA_SIZE_INVALID");
      }
      if (medium.sha256 !== null && !/^[a-f0-9]{64}$/.test(medium.sha256)) {
        throw new Error("EXTERNAL_IMPORT_MEDIA_HASH_INVALID");
      }
    }
  }
  const approvedIds = value.importApproval.records.map((record) => {
    if (!isRecord(record) || record.sourceStatus !== "APPROVED") {
      throw new Error("EXTERNAL_IMPORT_APPROVAL_INVALID");
    }
    assertNonEmptyString(record.candidateId, "EXTERNAL_IMPORT_APPROVAL_INVALID", 128);
    if (approvalMode === "AUTOMATED_QUALITY_GATE") {
      if ("reviewedByUserId" in record || "reviewedAt" in record) {
        throw new Error("EXTERNAL_IMPORT_FALSE_REVIEWER_INVALID");
      }
      assertNonEmptyString(record.evaluatedAt, "EXTERNAL_IMPORT_APPROVAL_TIME_INVALID", 64);
      if (!Number.isFinite(Date.parse(record.evaluatedAt))) {
        throw new Error("EXTERNAL_IMPORT_APPROVAL_TIME_INVALID");
      }
    } else {
      if (
        typeof record.reviewedByUserId !== "number" ||
        !Number.isInteger(record.reviewedByUserId) || record.reviewedByUserId < 1
      ) {
        throw new Error("EXTERNAL_IMPORT_APPROVER_INVALID");
      }
      assertNonEmptyString(record.reviewedAt, "EXTERNAL_IMPORT_APPROVAL_TIME_INVALID", 64);
      if (!Number.isFinite(Date.parse(record.reviewedAt))) {
        throw new Error("EXTERNAL_IMPORT_APPROVAL_TIME_INVALID");
      }
    }
    return record.candidateId;
  });
  if (
    approvedIds.length !== candidateIds.size ||
    new Set(approvedIds).size !== approvedIds.length ||
    approvedIds.some((candidateId) => !candidateIds.has(candidateId))
  ) {
    throw new Error("EXTERNAL_IMPORT_APPROVED_ITEMS_INVALID");
  }
}

export function externalImportApprovalMetadata(
  plan: ExternalImportPlan,
  candidateId: string,
): ExternalImportApprovalMetadata {
  const record = plan.importApproval.records.find(
    (entry) => entry.candidateId === candidateId,
  );
  if (!record) throw new Error("EXTERNAL_IMPORT_DURABLE_REVIEW_MISSING");
  if (plan.importApproval.approvalMode === "AUTOMATED_QUALITY_GATE") {
    if (!("evaluatedAt" in record)) {
      throw new Error("EXTERNAL_IMPORT_APPROVAL_INVALID");
    }
    return {
      approvalMode: "AUTOMATED_QUALITY_GATE",
      approvedAt: record.evaluatedAt,
      reviewedByUserId: null,
      policyVersion: plan.importApproval.policyVersion,
    };
  }
  if (!("reviewedAt" in record) || !("reviewedByUserId" in record)) {
    throw new Error("EXTERNAL_IMPORT_APPROVAL_INVALID");
  }
  return {
    approvalMode: "HUMAN_REVIEW",
    approvedAt: record.reviewedAt,
    reviewedByUserId: record.reviewedByUserId,
    policyVersion: null,
  };
}

function normalizedAnswer(value: string | null) {
  return value?.trim().toLocaleLowerCase("de") ?? null;
}

export function preflightExternalImport(
  plan: ExternalImportPlan,
  existing: readonly ExistingExternalQuestion[],
  activeCategoryNames: readonly string[],
): ExternalImportPreflight {
  validateExternalImportPlan(plan);
  const approvedIds = new Set(
    plan.importApproval.records.map((record) => record.candidateId),
  );
  const activeCategories = new Set(
    activeCategoryNames.map((category) => category.trim().toLocaleLowerCase("de")),
  );
  const items = plan.items.map<ExternalImportPreflightItem>((candidate) => {
    const mapping = existing.find((entry) =>
      entry.sourceType === plan.sourceType &&
      entry.externalReference === candidate.externalReference,
    );
    if (mapping) {
      const sameContent = mapping.contentFingerprint === candidate.contentFingerprint &&
        normalizeQuestionForSimilarity(mapping.question) ===
          normalizeQuestionForSimilarity(candidate.prepared.question) &&
        normalizedAnswer(mapping.correctAnswer) ===
          normalizedAnswer(candidate.prepared.correctAnswer);
      return {
        candidateId: candidate.candidateId,
        externalReference: candidate.externalReference,
        decision: sameContent ? "ALREADY_PRESENT" : "CONFLICT",
        existingQuestionId: mapping.questionId,
        reason: sameContent ? "SOURCE_MAPPING_IDENTICAL" : "SOURCE_MAPPING_CONFLICT",
      };
    }
    const fingerprint = existing.find((entry) =>
      entry.contentFingerprint === candidate.contentFingerprint,
    );
    if (fingerprint) {
      return {
        candidateId: candidate.candidateId,
        externalReference: candidate.externalReference,
        decision: normalizedAnswer(fingerprint.correctAnswer) === normalizedAnswer(candidate.prepared.correctAnswer)
          ? "ALREADY_PRESENT"
          : "CONFLICT",
        existingQuestionId: fingerprint.questionId,
        reason: "CONTENT_FINGERPRINT_PRESENT",
      };
    }
    const exact = existing.find((entry) =>
      normalizeQuestionForSimilarity(entry.question) ===
      normalizeQuestionForSimilarity(candidate.prepared.question),
    );
    if (exact) {
      return {
        candidateId: candidate.candidateId,
        externalReference: candidate.externalReference,
        decision: normalizedAnswer(exact.correctAnswer) === normalizedAnswer(candidate.prepared.correctAnswer)
          ? "ALREADY_PRESENT"
          : "CONFLICT",
        existingQuestionId: exact.questionId,
        reason: "NORMALIZED_QUESTION_PRESENT",
      };
    }
    const semantic = existing
      .map((entry) => ({ entry, similarity: calculateQuestionSimilarity(candidate.prepared.question, entry.question) }))
      .filter(({ similarity }) => similarity >= 0.58)
      .sort((left, right) => right.similarity - left.similarity)[0];
    if (semantic) {
      return {
        candidateId: candidate.candidateId,
        externalReference: candidate.externalReference,
        decision: "REVIEW_REQUIRED",
        existingQuestionId: semantic.entry.questionId,
        reason: `SEMANTIC_SIMILARITY_${semantic.similarity.toFixed(3)}`,
      };
    }
    const category = candidate.prepared.category?.trim().toLocaleLowerCase("de");
    if (!category || !activeCategories.has(category)) {
      return {
        candidateId: candidate.candidateId,
        externalReference: candidate.externalReference,
        decision: "REVIEW_REQUIRED",
        existingQuestionId: null,
        reason: "ACTIVE_CATEGORY_MISSING",
      };
    }
    if (
      !approvedIds.has(candidate.candidateId) ||
      candidate.verification.status !== "VERIFIED" ||
      candidate.verification.sources.length === 0
    ) {
      return {
        candidateId: candidate.candidateId,
        externalReference: candidate.externalReference,
        decision: "REVIEW_REQUIRED",
        existingQuestionId: null,
        reason: !approvedIds.has(candidate.candidateId)
          ? "EXPLICIT_IMPORT_APPROVAL_MISSING"
          : "CANDIDATE_QUALITY_REVIEW_REQUIRED",
      };
    }
    return {
      candidateId: candidate.candidateId,
      externalReference: candidate.externalReference,
      decision: "CREATE",
      existingQuestionId: null,
      reason: "NO_PRODUCTION_MATCH",
    };
  });
  const counts = {
    CREATE: 0,
    ALREADY_PRESENT: 0,
    CONFLICT: 0,
    REVIEW_REQUIRED: 0,
  } satisfies Record<ExternalImportPreflightDecision, number>;
  for (const item of items) counts[item.decision] += 1;
  return { items, counts };
}

function identityEquals(left: ProductionIdentity, right: ProductionIdentity) {
  return left.host.toLowerCase().replace(/-pooler(?=\.)/, "") ===
    right.host.toLowerCase().replace(/-pooler(?=\.)/, "") &&
    left.database === right.database && left.schema === right.schema;
}

function executionIsProduction(
  execution: ExternalImportExecutionIdentity,
  mode: ExternalImportGuardInput["mode"],
) {
  if (execution.logicalEnvironment !== "production") return false;
  if (execution.kind === "vercel") {
    return execution.vercelEnvironment === "production" &&
      Boolean(execution.expectedVercelProjectId) &&
      execution.vercelProjectId === execution.expectedVercelProjectId;
  }
  if (execution.kind === "github-actions") {
    return execution.repository === "justphilgud/pubquiz-web" &&
      execution.ref === "refs/heads/main" &&
      execution.eventName === "workflow_dispatch" &&
      execution.githubEnvironment === (
        mode === "dry-run" ? "operations-backup" : "operations-content-import"
      ) &&
      Boolean(execution.expectedWorkflowRef) &&
      execution.workflowRef === execution.expectedWorkflowRef &&
      (mode === "dry-run" || (
        typeof execution.workflowRun === "string" && /^[1-9][0-9]{0,19}$/.test(execution.workflowRun) &&
        execution.workflowRunAttempt === "1"
      ));
  }
  return false;
}

function validBackup(
  evidence: ExternalImportBackupEvidence | undefined,
  input: ExternalImportGuardInput,
) {
  if (!evidence) return false;
  const snapshot = Date.parse(evidence.snapshotAt);
  const completed = Date.parse(evidence.completedAt);
  return evidence.version === 1 && evidence.completed && evidence.manifestPresent && evidence.readbackVerified &&
    evidence.integrityVerified && /^[a-f0-9]{64}$/.test(evidence.manifestSha256) &&
    /^production\/(acceptance|scheduled)\/run-[0-9]+-[0-9]+$/.test(evidence.backupId) &&
    /^[1-9][0-9]{0,19}$/.test(evidence.backupRun) && /^[1-9][0-9]{0,5}$/.test(evidence.backupAttempt) &&
    evidence.backupId === `production/acceptance/run-${evidence.backupRun}-${evidence.backupAttempt}` &&
    Number.isFinite(snapshot) && Number.isFinite(completed) && completed >= snapshot &&
    snapshot <= input.now.getTime() && input.now.getTime() - snapshot <= EXTERNAL_IMPORT_BACKUP_MAX_AGE_MS &&
    evidence.productionSha === input.currentProductionSha &&
    identityEquals(evidence.source, input.expectedDatabase);
}

export function evaluateExternalImportGuard(input: ExternalImportGuardInput): ExternalImportGuardResult {
  let planValid = true;
  try {
    validateExternalImportPlan(input.plan);
  } catch {
    planValid = false;
  }
  const computedDigest = planValid ? externalImportPlanDigest(input.plan) : "";
  const environment = input.execution.logicalEnvironment === "production";
  const host = executionIsProduction(input.execution, input.mode);
  const database = identityEquals(input.actualDatabase, input.expectedDatabase);
  const preflight = input.preflight.counts.CONFLICT === 0 &&
    input.preflight.counts.REVIEW_REQUIRED === 0;
  const backup = validBackup(input.backup, input);
  const digest = /^[a-f0-9]{64}$/.test(input.suppliedDigest) &&
    computedDigest === input.suppliedDigest;
  const authorization = Boolean(input.authorization?.writeAuthorized) &&
    input.authorization?.batchId === input.plan.batchId &&
    input.authorization?.planDigest === input.suppliedDigest &&
    input.authorization?.productionSha === input.currentProductionSha &&
    input.authorization?.backupId === input.backup?.backupId &&
    input.authorization?.backupRun === input.backup?.backupRun &&
    input.authorization?.backupAttempt === input.backup?.backupAttempt &&
    input.authorization?.manifestSha256 === input.backup?.manifestSha256 &&
    input.authorization?.workflowRun === input.execution.workflowRun &&
    input.authorization?.workflowRunAttempt === input.execution.workflowRunAttempt &&
    input.authorization !== undefined &&
    identityEquals(input.authorization.productionIdentity, input.expectedDatabase);
  const reviewer = input.mode === "dry-run" || (
    isVerifiedExternalImportReviewerApproval(input.reviewerApproval) &&
    input.reviewerApproval.runId === input.execution.workflowRun &&
    input.reviewerApproval.runAttempt === input.execution.workflowRunAttempt &&
    input.reviewerApproval.environment === "operations-content-import" &&
    input.reviewerApproval.planDigest === input.suppliedDigest &&
    input.reviewerApproval.backupId === input.backup?.backupId &&
    input.reviewerApproval.candidateIds.length === input.plan.items.length &&
    input.reviewerApproval.candidateIds.every((candidateId, index) =>
      candidateId === input.plan.items[index]?.candidateId
    )
  );
  const gates = { plan: planValid, digest, environment, host, database, preflight, backup, reviewer, authorization };
  const failures = Object.entries(gates)
    .filter(([, passed]) => !passed)
    .map(([gate]) => `EXTERNAL_IMPORT_${gate.toUpperCase()}_GATE_BLOCKED`);
  const writeAuthorized = input.mode === "write" && failures.length === 0;
  return { dryRun: input.mode === "dry-run", writeAuthorized, gates, failures };
}

export class OneTimeExternalImportAuthorization {
  private available = true;

  async run<T>(guard: ExternalImportGuardResult, operation: () => Promise<T>): Promise<T> {
    if (!this.available || !guard.writeAuthorized) {
      throw new Error("EXTERNAL_IMPORT_WRITE_NOT_AUTHORIZED");
    }
    this.available = false;
    try {
      return await operation();
    } finally {
      this.available = false;
    }
  }

  get writeAuthorized() {
    return false;
  }
}
