import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approvedProductionEditorialSource, assertProductionEditorialContext, assertProductionEditorialSource, EDITORIAL_PRODUCTION_WORKFLOW } from "./editorialProductionPolicy";
import { runEditorialDatabaseImport } from "./editorialImportDatabase";

test("production allowlist freezes all 79 source payloads and excludes holds and duplicate", () => {
  const source = approvedProductionEditorialSource();
  assert.equal(source.candidates.length, 79);
  assert.equal(source.candidates.filter(row => row.templateId === "anagramm").length, 45);
  assert.equal(source.candidates.filter(row => row.templateId === "schaetzfrage").length, 34);
  assert.ok(source.candidates.every(row => !row.metadata.editorialExcludeReason && !row.metadata.editorialHoldReason));
  assertProductionEditorialSource(source);
  for (const changed of [{ ...source, candidates: source.candidates.slice(1) },
    { ...source, candidates: [...source.candidates].reverse() },
    { ...source, candidates: source.candidates.map((row, index) => index ? row : { ...row, question: "changed" }) }]) {
    assert.throws(() => assertProductionEditorialSource(changed), /SOURCE_MISMATCH/);
  }
});
test("Production context rejects every non-authorized execution surface", () => {
  const valid = { GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "justphilgud/pubquiz-web", GITHUB_REF: "refs/heads/main",
    GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_WORKFLOW_REF: EDITORIAL_PRODUCTION_WORKFLOW,
    EDITORIAL_GITHUB_ENVIRONMENT: "operations-backup", EDITORIAL_PRODUCTION_SHA: "a".repeat(40), PRODUCTION_RELEASE_SHA: "a".repeat(40) };
  assertProductionEditorialContext(valid);
  for (const key of Object.keys(valid)) assert.throws(() => assertProductionEditorialContext({ ...valid, [key]: "invalid" }), /CONTEXT_INVALID/);
});
test("Production writes reject before any connection; Preview wrapper stays restricted", async () => {
  await assert.rejects(runEditorialDatabaseImport({ connectionString: "postgresql://unused@127.0.0.1/editorial_import_ci",
    source: approvedProductionEditorialSource(), productionPreflight: true, mode: "import", operatorUserId: 1 }), /WRITE_NOT_AUTHORIZED/);
  assert.match(readFileSync("app/fragen/import/editorialActions.ts", "utf8"), /getLogicalEnvironment\(\) !== "preview"/);
  const workflow = readFileSync(".github/workflows/external-question-import-preflight.yml", "utf8");
  assert.match(workflow, /refs\/heads\/main.*inputs.editorial_pr95/);
  assert.ok(!workflow.includes("PRODUCTION_IMPORT_DATABASE_URL"));
  assert.ok(!workflow.includes("db:deploy"));
});
