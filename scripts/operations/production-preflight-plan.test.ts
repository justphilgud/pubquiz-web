import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { APPROVED_PREFLIGHT_PLANS, approvedPreflightPlan, hasApprovedDeltaEvidence, hasApprovedPendingDelta } from "./production-preflight-plan";
import { needsApplicationDeployment } from "./deployment-scope";

test("only exact reviewed release pairs and SQL checksums are eligible", () => {
  for (const plan of APPROVED_PREFLIGHT_PLANS) {
    assert.equal(approvedPreflightPlan(plan.baselineSha, plan.candidateSha), plan);
    assert.equal(approvedPreflightPlan("a".repeat(40), plan.candidateSha), undefined);
    assert.equal(approvedPreflightPlan(plan.baselineSha, "b".repeat(40)), undefined);
    const files = [{name: plan.delta, checksum: plan.checksum}];
    assert.equal(hasApprovedPendingDelta(plan, [plan.delta], [plan.delta], files), true);
    assert.equal(hasApprovedPendingDelta(plan, [plan.delta, "unreviewed"], [plan.delta], files), false);
    assert.equal(hasApprovedPendingDelta(plan, [plan.delta], [], files), false);
    assert.equal(hasApprovedPendingDelta(plan, [plan.delta], [plan.delta, "unreviewed"], files), false);
    assert.equal(hasApprovedPendingDelta(plan, [plan.delta], [plan.delta], [{...files[0], checksum: "0".repeat(64)}]), false);
  }
});

test("delta evidence is bound to both commits, exact SQL and actual isolated checks", () => {
  for (const plan of APPROVED_PREFLIGHT_PLANS) {
    const evidence = {status: "PASS", migration: plan.delta, baselineSha: plan.baselineSha, candidateSha: plan.candidateSha,
      checksum: plan.checksum, rowsUnchanged: true, onlyExpectedSchemaChanges: true, oldColumnProjectionCompatible: true,
      captureConfirmed: true, noBackfill: true, resetBarrierConfirmed: true, archiveSurvivesRuntimeDeletion: true};
    assert.equal(hasApprovedDeltaEvidence(plan, evidence), true);
    for (const key of ["status", "migration", "baselineSha", "candidateSha", "checksum", "rowsUnchanged", "onlyExpectedSchemaChanges", "oldColumnProjectionCompatible"]) {
      assert.equal(hasApprovedDeltaEvidence(plan, {...evidence, [key]: null}), false, key);
    }
    if (plan.kind === "meme-archive") {
      for (const key of ["captureConfirmed", "noBackfill", "resetBarrierConfirmed", "archiveSurvivesRuntimeDeletion"]) {
        assert.equal(hasApprovedDeltaEvidence(plan, {...evidence, [key]: false}), false, key);
      }
    }
    assert.equal(hasApprovedDeltaEvidence(undefined, evidence), false);
    assert.equal(hasApprovedDeltaEvidence(plan, undefined), false);
  }
});

test("PR116 operations-only update never starts migration or application deployment", () => {
  const paths = ["scripts/operations/production-preflight-plan.ts", "scripts/operations/production-preflight-plan.test.ts",
    "scripts/operations/production-preflight-archive-delta.ts", "scripts/operations/production-preflight-schema-build.ts",
    "scripts/operations/production-preflight.ts", "docs/operations/production-read-only-preflight.md",
    ".github/workflows/production-read-only-preflight.yml", ".github/workflows/production-preflight-ci.yml"];
  assert.equal(needsApplicationDeployment(paths), false);
  assert.equal(needsApplicationDeployment([...paths, "prisma/migrations/20261016120000_meme_archive/migration.sql"]), true);
  const workflow = readFileSync(".github/workflows/production-read-only-preflight.yml", "utf8");
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /environment: operations-backup/);
  assert.match(workflow, /github.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(workflow, /db:deploy|vercel.*deploy|acceptance-cli|workflow_run:/);
});
