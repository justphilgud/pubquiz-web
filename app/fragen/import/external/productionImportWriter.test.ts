import assert from "node:assert/strict";
import test from "node:test";

import {
  OneTimeExternalImportAuthorization,
  type ExternalImportGuardResult,
  type ExternalImportPlan,
} from "./productionImportGuard";
import { runProductionExternalImport } from "./productionImportWriter";

const item = (id: string) => ({
  candidateId: id,
  externalReference: `source-${id}`,
  contentFingerprint: id.padEnd(64, "a").slice(0, 64),
  original: {
    language: "en", category: "General", difficulty: "easy", type: "multiple",
    question: `Original ${id}`, correctAnswer: "Right",
    incorrectAnswers: ["A", "B", "C"], providerPayload: {},
  },
  prepared: {
    question: `Frage ${id}`, correctAnswer: "Richtig", distractors: ["A", "B", "C"],
    explanation: null, difficulty: 25, category: "Allgemeinwissen",
  },
  verification: { status: "VERIFIED", sources: [{ title: "Source", url: "https://example.org" }] },
  reviewStatus: "READY_FOR_REVIEW" as const,
  license: { name: "CC", url: "https://example.org/license" },
  media: [],
});

function plan(): ExternalImportPlan {
  const items = [item("1"), item("2"), item("3")];
  return {
    version: 1,
    batchId: "test-batch",
    sourceType: "Test",
    frozenAt: "2026-09-28T10:00:00.000Z",
    operatorUserId: 1,
    importApproval: {
      records: items.map((entry) => ({
        candidateId: entry.candidateId,
        sourceStatus: "APPROVED" as const,
        reviewedByUserId: 1,
        reviewedAt: "2026-09-28T09:00:00.000Z",
      })),
    },
    items,
  };
}

const guard: ExternalImportGuardResult = {
  dryRun: false,
  writeAuthorized: true,
  gates: {
    plan: true, digest: true, environment: true, host: true, database: true,
    preflight: true, backup: true, reviewer: true, authorization: true,
  },
  failures: [],
};

function createPreflight() {
  return {
    items: ["1", "2", "3"].map((candidateId) => ({
      candidateId,
      externalReference: `source-${candidateId}`,
      decision: "CREATE" as const,
      existingQuestionId: null,
      reason: "NO_PRODUCTION_MATCH",
    })),
    counts: { CREATE: 3, ALREADY_PRESENT: 0, CONFLICT: 0, REVIEW_REQUIRED: 0 },
  };
}

function input(authorization: OneTimeExternalImportAuthorization) {
  return {
    guard,
    authorization,
    plan: plan(),
    planDigest: "a".repeat(64),
    productionSha: "b".repeat(40),
    backupId: "production/acceptance/run-1-1",
    workflowRun: "2",
    preflight: createPreflight(),
  };
}

test("imports each item once and self-closes after success", async () => {
  const authorization = new OneTimeExternalImportAuthorization();
  const seen: string[] = [];
  const audit = await runProductionExternalImport({
    ...input(authorization),
    importItem: async (entry) => {
      seen.push(entry.candidateId);
      return { questionId: Number(entry.candidateId) + 100 };
    },
  });
  assert.deepEqual(seen, ["1", "2", "3"]);
  assert.deepEqual(audit.items.map((entry) => entry.status), ["IMPORTED", "IMPORTED", "IMPORTED"]);
  assert.equal(audit.writeAuthorized, false);
  await assert.rejects(
    runProductionExternalImport({ ...input(authorization), importItem: async () => ({ questionId: 1 }) }),
    /EXTERNAL_IMPORT_WRITE_NOT_AUTHORIZED/,
  );
});

test("partial failure is explicit and prevents remaining writes", async () => {
  const seen: string[] = [];
  const audit = await runProductionExternalImport({
    ...input(new OneTimeExternalImportAuthorization()),
    importItem: async (entry) => {
      seen.push(entry.candidateId);
      if (entry.candidateId === "2") throw new Error("EXTERNAL_IMPORT_TEST_FAILURE");
      return { questionId: 100 + Number(entry.candidateId) };
    },
  });
  assert.deepEqual(seen, ["1", "2"]);
  assert.equal(audit.result, "FAILED");
  assert.deepEqual(audit.items.map((entry) => entry.status), ["IMPORTED", "FAILED", "NOT_RUN"]);
  assert.equal(audit.writeAuthorized, false);
});

test("already-present items are not written", async () => {
  const base = input(new OneTimeExternalImportAuthorization());
  const value = {
    ...base,
    preflight: {
      items: [{
        ...base.preflight.items[0],
        decision: "ALREADY_PRESENT" as const,
        existingQuestionId: 44,
        reason: "SOURCE_MAPPING_IDENTICAL",
      }, ...base.preflight.items.slice(1)],
      counts: { CREATE: 2, ALREADY_PRESENT: 1, CONFLICT: 0, REVIEW_REQUIRED: 0 },
    },
  };
  const seen: string[] = [];
  const audit = await runProductionExternalImport({
    ...value,
    importItem: async (entry) => {
      seen.push(entry.candidateId);
      return { questionId: Number(entry.candidateId) };
    },
  });
  assert.deepEqual(seen, ["2", "3"]);
  assert.equal(audit.items[0].status, "ALREADY_PRESENT");
});

test("complete re-run writes nothing and reports every item already present", async () => {
  const base = input(new OneTimeExternalImportAuthorization());
  const preflight = {
    items: base.preflight.items.map((entry, index) => ({
      ...entry,
      decision: "ALREADY_PRESENT" as const,
      existingQuestionId: index + 50,
      reason: "SOURCE_MAPPING_IDENTICAL",
    })),
    counts: { CREATE: 0, ALREADY_PRESENT: 3, CONFLICT: 0, REVIEW_REQUIRED: 0 },
  };
  let writes = 0;
  const audit = await runProductionExternalImport({
    ...base,
    preflight,
    importItem: async () => { writes += 1; return { questionId: 1 }; },
  });
  assert.equal(writes, 0);
  assert.deepEqual(audit.items.map((entry) => entry.status), [
    "ALREADY_PRESENT", "ALREADY_PRESENT", "ALREADY_PRESENT",
  ]);
});

test("question failure after media preparation records the orphan without deleting it", async () => {
  const value = plan();
  const mediaPlan: ExternalImportPlan = {
    ...value,
    items: [{
      ...value.items[0],
      media: [{
        sourceUrl: "https://example.org/image.webp",
        license: "CC",
        mimeType: "image/webp",
        expectedBytes: 5,
        sha256: "c".repeat(64),
        target: "question",
      }],
    }, ...value.items.slice(1)],
  };
  let writes = 0;
  const base = input(new OneTimeExternalImportAuthorization());
  const audit = await runProductionExternalImport({
    ...base,
    plan: mediaPlan,
    prepareMedia: async () => [{ target: "question", reference: "media/object-1.webp" }],
    importItem: async () => {
      writes += 1;
      throw new Error("EXTERNAL_IMPORT_DATABASE_WRITE_FAILED");
    },
  });
  assert.equal(writes, 1);
  assert.equal(audit.items[0].status, "FAILED");
  assert.deepEqual(audit.items[0].orphanedMedia, ["media/object-1.webp"]);
});

test("media preparation failure creates no question", async () => {
  const value = plan();
  const mediaPlan: ExternalImportPlan = {
    ...value,
    items: [{
      ...value.items[0],
      media: [{
        sourceUrl: "https://example.org/image.webp",
        license: "CC",
        mimeType: "image/webp",
        expectedBytes: 5,
        sha256: "c".repeat(64),
        target: "question",
      }],
    }, ...value.items.slice(1)],
  };
  let writes = 0;
  const audit = await runProductionExternalImport({
    ...input(new OneTimeExternalImportAuthorization()),
    plan: mediaPlan,
    prepareMedia: async () => { throw new Error("EXTERNAL_IMPORT_MEDIA_READBACK_FAILED"); },
    importItem: async () => { writes += 1; return { questionId: 1 }; },
  });
  assert.equal(writes, 0);
  assert.equal(audit.items[0].reason, "EXTERNAL_IMPORT_MEDIA_READBACK_FAILED");
});

test("abort closes the authorization without a write", async () => {
  const controller = new AbortController();
  controller.abort();
  let writes = 0;
  const audit = await runProductionExternalImport({
    ...input(new OneTimeExternalImportAuthorization()),
    signal: controller.signal,
    importItem: async () => { writes += 1; return { questionId: 1 }; },
  });
  assert.equal(writes, 0);
  assert.equal(audit.result, "ABORTED");
  assert.equal(audit.writeAuthorized, false);
});
