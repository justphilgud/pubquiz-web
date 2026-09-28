import assert from "node:assert/strict";
import test from "node:test";

import {
  EXTERNAL_IMPORT_BACKUP_MAX_AGE_MS,
  EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION,
  OneTimeExternalImportAuthorization,
  canonicalExternalImportPlan,
  evaluateExternalImportGuard,
  externalImportApprovalMetadata,
  externalImportPlanDigest,
  preflightExternalImport,
  validateExternalImportPlan,
  type ExistingExternalQuestion,
  type ExternalImportBackupEvidence,
  type ExternalImportExecutionIdentity,
  type ExternalImportPlan,
  type ExternalImportWriteAuthorization,
  type ProductionIdentity,
} from "./productionImportGuard";
import {
  VerifiedExternalImportReviewerApproval,
  externalImportApprovalComment,
} from "./reviewerApproval";

const production: ProductionIdentity = {
  host: "ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech",
  database: "neondb",
  schema: "pubquiz",
};

function plan(overrides: Partial<ExternalImportPlan> = {}): ExternalImportPlan {
  const value: ExternalImportPlan = {
    version: 1,
    batchId: "opentdb-batch-001",
    sourceType: "OpenTDB",
    frozenAt: "2026-09-26T10:00:00.000Z",
    operatorUserId: 7,
    importApproval: {
      records: [{
        candidateId: "candidate-1",
        sourceStatus: "APPROVED",
        reviewedByUserId: 7,
        reviewedAt: "2026-09-26T09:55:00.000Z",
      }],
    },
    items: [{
      candidateId: "candidate-1",
      externalReference: "opentdb-42",
      contentFingerprint: "a".repeat(64),
      original: {
        language: "en",
        category: "Science",
        difficulty: "easy",
        type: "multiple",
        question: "What is two plus two?",
        correctAnswer: "Four",
        incorrectAnswers: ["One", "Two", "Three"],
        providerPayload: { id: 42 },
      },
      prepared: {
        question: "Was ist zwei plus zwei?",
        correctAnswer: "Vier",
        distractors: ["Eins", "Zwei", "Drei"],
        explanation: "Grundrechenart",
        difficulty: 0.5,
        category: "Wissenschaft",
      },
      verification: {
        status: "VERIFIED",
        sources: [{ title: "Universität", url: "https://example.edu/math" }],
      },
      reviewStatus: "READY_FOR_REVIEW",
      license: { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
      media: [],
    }],
    ...overrides,
  };
  return value;
}

function automatedPlan(): ExternalImportPlan {
  const base = plan();
  return {
    ...base,
    importApproval: {
      approvalMode: "AUTOMATED_QUALITY_GATE",
      policyVersion: EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION,
      records: [{
        candidateId: "candidate-1",
        sourceStatus: "APPROVED",
        evaluatedAt: "2026-09-26T09:55:00.000Z",
      }],
    },
    items: [{
      ...base.items[0],
      verification: {
        status: "VERIFIED",
        sources: [
          { title: "Universität", url: "https://university.edu/math" },
          { title: "Fachlexikon", url: "https://example.org/math" },
        ],
      },
      autoQualityEvidence: {
        classification: "AUTO_APPROVED_FOR_PRODUCTION",
        policyVersion: EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION,
        localizationStatus: "LOCALIZED",
        qualityStatus: "READY_FOR_REVIEW",
        issueCodes: [],
        independentReliableSourceHosts: 2,
      },
    }],
  };
}

const now = new Date("2026-09-26T10:30:00.000Z");

function execution(overrides: Partial<ExternalImportExecutionIdentity> = {}): ExternalImportExecutionIdentity {
  return {
    logicalEnvironment: "production",
    kind: "github-actions",
    repository: "justphilgud/pubquiz-web",
    ref: "refs/heads/main",
    eventName: "workflow_dispatch",
    workflowRef: "justphilgud/pubquiz-web/.github/workflows/external-question-import.yml@refs/heads/main",
    expectedWorkflowRef: "justphilgud/pubquiz-web/.github/workflows/external-question-import.yml@refs/heads/main",
    githubEnvironment: "operations-content-import",
    workflowRun: "789012",
    workflowRunAttempt: "1",
    ...overrides,
  };
}

function backup(overrides: Partial<ExternalImportBackupEvidence> = {}): ExternalImportBackupEvidence {
  return {
    version: 1,
    backupId: "production/acceptance/run-123456-1",
    backupRun: "123456",
    backupAttempt: "1",
    snapshotAt: "2026-09-26T10:20:00.000Z",
    completedAt: "2026-09-26T10:24:00.000Z",
    productionSha: "b".repeat(40),
    manifestSha256: "c".repeat(64),
    source: production,
    completed: true,
    manifestPresent: true,
    readbackVerified: true,
    integrityVerified: true,
    ...overrides,
  };
}

function authorization(
  value: ExternalImportPlan,
  overrides: Partial<ExternalImportWriteAuthorization> = {},
): ExternalImportWriteAuthorization {
  return {
    writeAuthorized: true,
    batchId: value.batchId,
    planDigest: externalImportPlanDigest(value),
    productionSha: "b".repeat(40),
    backupId: "production/acceptance/run-123456-1",
    backupRun: "123456",
    backupAttempt: "1",
    manifestSha256: "c".repeat(64),
    workflowRun: "789012",
    workflowRunAttempt: "1",
    productionIdentity: production,
    ...overrides,
  };
}

function reviewerApproval(value: ExternalImportPlan) {
  const planDigest = externalImportPlanDigest(value);
  const candidateIds = value.items.map((item) => item.candidateId);
  const backupId = "production/acceptance/run-123456-1";
  return VerifiedExternalImportReviewerApproval.fromGithubReviewHistory({
    repository: "justphilgud/pubquiz-web",
    runId: "789012",
    runAttempt: "1",
    planDigest,
    candidateIds,
    backupId,
    response: [{
      state: "approved",
      comment: externalImportApprovalComment({ planDigest, candidateIds, backupId }),
      environments: [{ name: "operations-content-import" }],
      user: { id: 99, login: "reviewer" },
    }],
  });
}

function guardInput(value = plan()) {
  const preflight = preflightExternalImport(value, []);
  return {
    mode: "write" as const,
    now,
    plan: value,
    suppliedDigest: externalImportPlanDigest(value),
    execution: execution(),
    actualDatabase: production,
    expectedDatabase: production,
    currentProductionSha: "b".repeat(40),
    preflight,
    backup: backup(),
    authorization: authorization(value),
    reviewerApproval: reviewerApproval(value),
  };
}

test("canonical plan digest is stable and detects mutations", () => {
  const value = plan();
  assert.equal(externalImportPlanDigest(value), externalImportPlanDigest(JSON.parse(canonicalExternalImportPlan(value))));
  const changed = plan({ batchId: "opentdb-batch-002" });
  assert.notEqual(externalImportPlanDigest(value), externalImportPlanDigest(changed));
});

test("plan validation rejects missing digest inputs and duplicate answers", () => {
  const value = plan();
  const invalid = plan({
    items: [{
      ...value.items[0],
      prepared: {
        ...value.items[0].prepared,
        distractors: ["Vier", "Zwei", "Drei"],
      },
    }],
  });
  assert.throws(() => validateExternalImportPlan(invalid), /EXTERNAL_IMPORT_ANSWERS_INVALID/);
});

test("review states are preserved in the frozen plan", () => {
  const value = plan();
  const second = {
    ...value.items[0],
    candidateId: "candidate-2",
    externalReference: "opentdb-43",
    contentFingerprint: "d".repeat(64),
    reviewStatus: "REVIEW_REQUIRED" as const,
  };
  const mixed = plan({
    items: [value.items[0], second],
    importApproval: {
      records: [
        {
          candidateId: "candidate-1",
          sourceStatus: "APPROVED",
          reviewedByUserId: 7,
          reviewedAt: "2026-09-26T09:55:00.000Z",
        },
        {
          candidateId: "candidate-2",
          sourceStatus: "APPROVED",
          reviewedByUserId: 7,
          reviewedAt: "2026-09-26T09:56:00.000Z",
        },
      ],
    },
  });
  validateExternalImportPlan(mixed);
  assert.deepEqual(mixed.items.map((item) => item.reviewStatus), ["READY_FOR_REVIEW", "REVIEW_REQUIRED"]);
});

test("empty Production inventory plans CREATE", () => {
  assert.deepEqual(preflightExternalImport(plan(), []).counts, {
    CREATE: 1,
    ALREADY_PRESENT: 0,
    CONFLICT: 0,
    REVIEW_REQUIRED: 0,
  });
});

test("source mapping with identical content is ALREADY_PRESENT", () => {
  const existing: ExistingExternalQuestion[] = [{
    questionId: 91,
    question: "Was ist zwei plus zwei?",
    correctAnswer: "Vier",
    sourceType: "OpenTDB",
    externalReference: "opentdb-42",
    contentFingerprint: "a".repeat(64),
  }];
  assert.equal(preflightExternalImport(plan(), existing).items[0].decision, "ALREADY_PRESENT");
});

test("source mapping with changed content is CONFLICT", () => {
  const existing: ExistingExternalQuestion[] = [{
    questionId: 91,
    question: "Andere Frage",
    correctAnswer: "Andere Antwort",
    sourceType: "OpenTDB",
    externalReference: "opentdb-42",
    contentFingerprint: "e".repeat(64),
  }];
  assert.equal(preflightExternalImport(plan(), existing).items[0].decision, "CONFLICT");
});

test("exact untracked question with same answer is ALREADY_PRESENT", () => {
  const existing: ExistingExternalQuestion[] = [{
    questionId: 92,
    question: "Was ist zwei plus zwei?",
    correctAnswer: "Vier",
    sourceType: null,
    externalReference: null,
    contentFingerprint: null,
  }];
  assert.equal(preflightExternalImport(plan(), existing).items[0].decision, "ALREADY_PRESENT");
});

test("exact question with different answer is CONFLICT", () => {
  const existing: ExistingExternalQuestion[] = [{
    questionId: 92,
    question: "Was ist zwei plus zwei?",
    correctAnswer: "Fünf",
    sourceType: null,
    externalReference: null,
    contentFingerprint: null,
  }];
  assert.equal(preflightExternalImport(plan(), existing).items[0].decision, "CONFLICT");
});

test("semantic duplicate requires human review", () => {
  const existing: ExistingExternalQuestion[] = [{
    questionId: 93,
    question: "Was ist zwei plus zwei wirklich?",
    correctAnswer: "Vier",
    sourceType: null,
    externalReference: null,
    contentFingerprint: null,
  }];
  assert.equal(preflightExternalImport(plan(), existing).items[0].decision, "REVIEW_REQUIRED");
});

test("durably approved REVIEW_REQUIRED candidate is eligible for current preflight", () => {
  const base = plan();
  const value = plan({
    items: [{ ...base.items[0], reviewStatus: "REVIEW_REQUIRED" }],
  });
  assert.equal(preflightExternalImport(value, []).items[0].decision, "CREATE");
});

test("plan validation rejects an item without its exact durable approval record", () => {
  assert.throws(
    () => validateExternalImportPlan({ ...plan(), importApproval: { records: [] } }),
    /EXTERNAL_IMPORT_APPROVED_ITEMS_INVALID/,
  );
});

test("automated quality approval is explicit and never invents a human reviewer", () => {
  const value = automatedPlan();
  validateExternalImportPlan(value);
  assert.deepEqual(externalImportApprovalMetadata(value, "candidate-1"), {
    approvalMode: "AUTOMATED_QUALITY_GATE",
    approvedAt: "2026-09-26T09:55:00.000Z",
    reviewedByUserId: null,
    policyVersion: "production-auto-quality-v1",
  });
});

test("automated approval rejects missing evidence, one source, and false reviewer metadata", () => {
  const value = automatedPlan();
  assert.throws(() => validateExternalImportPlan({
    ...value,
    items: [{ ...value.items[0], autoQualityEvidence: undefined }],
  }), /EXTERNAL_IMPORT_AUTO_QUALITY_EVIDENCE_MISSING/);
  assert.throws(() => validateExternalImportPlan({
    ...value,
    items: [{
      ...value.items[0],
      verification: { status: "VERIFIED", sources: value.items[0].verification.sources.slice(0, 1) },
      autoQualityEvidence: {
        ...value.items[0].autoQualityEvidence!,
        independentReliableSourceHosts: 1,
      },
    }],
  }), /EXTERNAL_IMPORT_AUTO_SOURCE_POLICY_INVALID/);
  const falseReviewer = {
    ...value,
    importApproval: {
      approvalMode: "AUTOMATED_QUALITY_GATE",
      policyVersion: EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION,
      records: [{
        candidateId: "candidate-1",
        sourceStatus: "APPROVED",
        evaluatedAt: "2026-09-26T09:55:00.000Z",
        reviewedByUserId: 7,
      }],
    },
  } as unknown as ExternalImportPlan;
  assert.throws(
    () => validateExternalImportPlan(falseReviewer),
    /EXTERNAL_IMPORT_FALSE_REVIEWER_INVALID/,
  );
});

test("complete re-run contains no CREATE, UPDATE or conflict", () => {
  const value = plan();
  const existing: ExistingExternalQuestion[] = [{
    questionId: 94,
    question: value.items[0].prepared.question,
    correctAnswer: value.items[0].prepared.correctAnswer,
    sourceType: value.sourceType,
    externalReference: value.items[0].externalReference,
    contentFingerprint: value.items[0].contentFingerprint,
  }];
  const result = preflightExternalImport(value, existing);
  assert.equal(result.counts.CREATE, 0);
  assert.equal(result.counts.ALREADY_PRESENT, 1);
  assert.equal(result.counts.CONFLICT, 0);
});

test("Production with all gates green is write-capable", () => {
  const result = evaluateExternalImportGuard(guardInput());
  assert.equal(result.writeAuthorized, true);
  assert.deepEqual(result.failures, []);
});

for (const [name, changed] of [
  ["Preview", { logicalEnvironment: "preview" as const }],
  ["Development", { logicalEnvironment: "development" as const }],
  ["unknown environment", { logicalEnvironment: "unknown" as const }],
  ["wrong repository", { repository: "other/repository" }],
  ["wrong branch", { ref: "refs/heads/feature" }],
  ["wrong workflow", { workflowRef: "justphilgud/pubquiz-web/.github/workflows/other.yml@refs/heads/main" }],
  ["wrong GitHub Environment", { githubEnvironment: "operations-backup" }],
] as const) {
  test(`${name} cannot authorize a Production write`, () => {
    const input = guardInput();
    const result = evaluateExternalImportGuard({ ...input, execution: execution(changed) });
    assert.equal(result.writeAuthorized, false);
  });
}

test("wrong Production database is blocked", () => {
  const input = guardInput();
  const result = evaluateExternalImportGuard({
    ...input,
    actualDatabase: { ...production, host: "ep-preview.example.neon.tech" },
  });
  assert.equal(result.gates.database, false);
  assert.equal(result.writeAuthorized, false);
});

for (const [name, evidence] of [
  ["missing backup", undefined],
  ["failed backup", backup({ completed: false })],
  ["manifest missing", backup({ manifestPresent: false })],
  ["readback missing", backup({ readbackVerified: false })],
  ["integrity failed", backup({ integrityVerified: false })],
  ["wrong release", backup({ productionSha: "f".repeat(40) })],
  ["wrong database", backup({ source: { ...production, host: "ep-other.neon.tech" } })],
  ["stale backup", backup({ snapshotAt: new Date(now.getTime() - EXTERNAL_IMPORT_BACKUP_MAX_AGE_MS - 1).toISOString() })],
] as const) {
  test(`${name} keeps the backup gate red`, () => {
    const input = guardInput();
    const result = evaluateExternalImportGuard({ ...input, backup: evidence });
    assert.equal(result.gates.backup, false);
    assert.equal(result.writeAuthorized, false);
  });
}

test("authorization is batch-, digest-, release- and database-bound", () => {
  const value = plan();
  for (const changed of [
    { batchId: "other-batch" },
    { planDigest: "0".repeat(64) },
    { productionSha: "0".repeat(40) },
    { backupId: "production/acceptance/run-999-1" },
    { backupRun: "999" },
    { backupAttempt: "2" },
    { manifestSha256: "1".repeat(64) },
    { workflowRun: "999" },
    { workflowRunAttempt: "2" },
    { productionIdentity: { ...production, database: "other" } },
    { writeAuthorized: false },
  ]) {
    const input = guardInput(value);
    const result = evaluateExternalImportGuard({
      ...input,
      authorization: authorization(value, changed),
    });
    assert.equal(result.gates.authorization, false);
    assert.equal(result.writeAuthorized, false);
  }
});

test("missing live reviewer proof blocks a write", () => {
  const input = guardInput();
  const result = evaluateExternalImportGuard({ ...input, reviewerApproval: undefined });
  assert.equal(result.gates.reviewer, false);
  assert.equal(result.writeAuthorized, false);
});

test("a rerun attempt cannot reuse the original one-shot approval", () => {
  const input = guardInput();
  const result = evaluateExternalImportGuard({
    ...input,
    execution: execution({ workflowRunAttempt: "2" }),
  });
  assert.equal(result.gates.host, false);
  assert.equal(result.writeAuthorized, false);
});

test("wrong or missing plan digest is blocked", () => {
  const input = guardInput();
  for (const suppliedDigest of ["", "0".repeat(64)]) {
    const result = evaluateExternalImportGuard({ ...input, suppliedDigest });
    assert.equal(result.gates.digest, false);
    assert.equal(result.writeAuthorized, false);
  }
});

test("CONFLICT or REVIEW_REQUIRED blocks the entire write", () => {
  const input = guardInput();
  for (const decision of ["CONFLICT", "REVIEW_REQUIRED"] as const) {
    const result = evaluateExternalImportGuard({
      ...input,
      preflight: {
        items: [{ candidateId: "candidate-1", externalReference: "opentdb-42", decision, existingQuestionId: 1, reason: "test" }],
        counts: { CREATE: 0, ALREADY_PRESENT: 0, CONFLICT: decision === "CONFLICT" ? 1 : 0, REVIEW_REQUIRED: decision === "REVIEW_REQUIRED" ? 1 : 0 },
      },
    });
    assert.equal(result.gates.preflight, false);
    assert.equal(result.writeAuthorized, false);
  }
});

test("dry-run can read gates but can never authorize writes", () => {
  const result = evaluateExternalImportGuard({ ...guardInput(), mode: "dry-run" });
  assert.equal(result.dryRun, true);
  assert.equal(result.writeAuthorized, false);
});

test("read-only Production preflight accepts operations-backup but cannot authorize writes", () => {
  const input = guardInput();
  const workflowRef = "justphilgud/pubquiz-web/.github/workflows/external-question-import-preflight.yml@refs/heads/main";
  const result = evaluateExternalImportGuard({
    ...input,
    mode: "dry-run",
    execution: execution({
      githubEnvironment: "operations-backup",
      workflowRef,
      expectedWorkflowRef: workflowRef,
    }),
  });
  assert.equal(result.gates.host, true);
  assert.equal(result.writeAuthorized, false);
});

test("one-time authorization closes after success", async () => {
  const latch = new OneTimeExternalImportAuthorization();
  const guard = evaluateExternalImportGuard(guardInput());
  assert.equal(await latch.run(guard, async () => "done"), "done");
  assert.equal(latch.writeAuthorized, false);
  await assert.rejects(() => latch.run(guard, async () => "again"), /EXTERNAL_IMPORT_WRITE_NOT_AUTHORIZED/);
});

test("one-time authorization closes after failure", async () => {
  const latch = new OneTimeExternalImportAuthorization();
  const guard = evaluateExternalImportGuard(guardInput());
  await assert.rejects(() => latch.run(guard, async () => { throw new Error("failed"); }), /failed/);
  assert.equal(latch.writeAuthorized, false);
  await assert.rejects(() => latch.run(guard, async () => "again"), /EXTERNAL_IMPORT_WRITE_NOT_AUTHORIZED/);
});
