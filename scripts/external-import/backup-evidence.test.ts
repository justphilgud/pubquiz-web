import assert from "node:assert/strict";
import test from "node:test";

import { parseExternalImportBackupEvidence, verifyBackupWorkflowRun } from "./backup-evidence";

const expected = {
  run: "123",
  attempt: "1",
  backupId: "production/acceptance/run-123-1",
  manifestSha256: "a".repeat(64),
  productionSha: "b".repeat(40),
};
const evidence = {
  version: 1,
  backupId: expected.backupId,
  backupRun: expected.run,
  backupAttempt: expected.attempt,
  snapshotAt: "2026-09-28T10:00:00.000Z",
  completedAt: "2026-09-28T10:10:00.000Z",
  productionSha: expected.productionSha,
  manifestSha256: expected.manifestSha256,
  source: {
    host: "ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech",
    database: "neondb",
    schema: "pubquiz",
  },
  completed: true,
  manifestPresent: true,
  readbackVerified: true,
  integrityVerified: true,
};

test("backup evidence is bound to exact run, manifest, release and Production DB", () => {
  assert.equal(parseExternalImportBackupEvidence(evidence, expected).backupId, expected.backupId);
  assert.throws(
    () => parseExternalImportBackupEvidence(evidence, { ...expected, run: "124" }),
    /EXTERNAL_IMPORT_BACKUP_EVIDENCE_MISMATCH/,
  );
  assert.throws(
    () => parseExternalImportBackupEvidence({ ...evidence, readbackVerified: false }, expected),
    /EXTERNAL_IMPORT_BACKUP_EVIDENCE_MISMATCH/,
  );
});

test("backup workflow run must be the successful AP9.4 workflow on main", async () => {
  const result = await verifyBackupWorkflowRun({
    repository: "justphilgud/pubquiz-web",
    run: "123",
    attempt: "1",
    token: "token",
    request: async () => new Response(JSON.stringify({
      id: 123,
      run_attempt: 1,
      path: ".github/workflows/ap94-acceptance.yml",
      head_branch: "main",
      status: "completed",
      conclusion: "success",
      event: "workflow_dispatch",
    }), { status: 200 }),
  });
  assert.equal(result.verified, true);
});

test("wrong workflow or failed run cannot serve as backup evidence", async () => {
  await assert.rejects(
    verifyBackupWorkflowRun({
      repository: "justphilgud/pubquiz-web",
      run: "123",
      attempt: "1",
      token: "token",
      request: async () => new Response(JSON.stringify({
        id: 123,
        run_attempt: 1,
        path: ".github/workflows/other.yml",
        head_branch: "main",
        status: "completed",
        conclusion: "success",
        event: "workflow_dispatch",
      }), { status: 200 }),
    }),
    /EXTERNAL_IMPORT_BACKUP_RUN_MISMATCH/,
  );
});
