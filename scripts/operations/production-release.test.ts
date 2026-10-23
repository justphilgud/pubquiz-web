import assert from "node:assert/strict";
import test from "node:test";
import { deployedProductionCommit } from "./production-release";

test("scheduled metadata identifies the latest successful Production deployment", async () => {
  const calls: string[] = [];
  assert.equal(await deployedProductionCommit(async path => { calls.push(path); return calls.length === 1 ? [{ id: 17, sha: "a".repeat(40), environment: "production" }] : [{ state: "success" }]; }), "a".repeat(40));
  assert.deepEqual(calls, ["/deployments?environment=production&per_page=1", "/deployments/17/statuses?per_page=1"]);
});
test("missing, foreign, pending or failed deployment cannot label a backup", async () => {
  for (const deployments of [[], [{ id: 1, sha: "main", environment: "production" }], [{ id: 1, sha: "a".repeat(40), environment: "preview" }]]) {
    await assert.rejects(deployedProductionCommit(async () => deployments));
  }
  for (const state of ["pending", "failure", "inactive"]) {
    await assert.rejects(deployedProductionCommit(async path => path.startsWith("/deployments?") ? [{ id: 1, sha: "a".repeat(40), environment: "production" }] : [{ state }]));
  }
});
