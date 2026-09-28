import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Preview UI exposes safe guard state without a Production writer", () => {
  const page = read("app/admin/question-import/page.tsx");
  assert.match(page, /Production-Import gesperrt/);
  assert.match(page, /writeAuthorized/);
  assert.match(page, /Eingefrorenen Plan exportieren/);
  assert.doesNotMatch(page, /PRODUCTION_IMPORT_DATABASE_URL/);
});

test("Production UI is explicitly read-only and exposes no import actions", () => {
  const page = read("app/admin/question-import/page.tsx");
  const start = page.indexOf('if (getLogicalEnvironment() === "production")');
  const end = page.indexOf("const totalPages");
  assert.ok(start >= 0 && end > start, "Production read-only branch missing");
  const productionBranch = page.slice(start, end);
  assert.match(productionBranch, /Externe Fragen · Production/);
  assert.match(productionBranch, /Read-only Production-Basis/);
  assert.match(productionBranch, /writeAuthorized = false/);
  assert.doesNotMatch(productionBranch, /<form|<button/);
  assert.doesNotMatch(productionBranch, /startOpenTdbPilotAction/);
});

test("Production preflight is structurally read-only", () => {
  const adapter = read("scripts/external-import/production-preflight.ts");
  assert.match(adapter, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(adapter, /ROLLBACK/);
  assert.doesNotMatch(adapter, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
});

test("Operations workflow uses the existing reader environment and has no write secret", () => {
  const workflow = read(".github/workflows/external-question-import-preflight.yml");
  assert.match(workflow, /environment: operations-backup/);
  assert.match(workflow, /PRODUCTION_BACKUP_DATABASE_URL/);
  assert.match(workflow, /productionChanged/);
  assert.match(workflow, /writeAuthorized: false/);
  assert.doesNotMatch(workflow, /PRODUCTION_IMPORT_DATABASE_URL/);
  assert.doesNotMatch(workflow, /operations-content-import/);
});

test("existing staging mutations retain the Preview-only assertion", () => {
  const service = read("app/fragen/import/external/externalQuestionImport.server.ts");
  for (const name of [
    "startOpenTdbPilot",
    "processOpenTdbPhaseTwo",
    "startExternalQuestionReview",
    "saveExternalQuestionPreparation",
    "approveExternalQuestion",
    "rejectExternalQuestion",
  ]) {
    const start = service.indexOf(`export async function ${name}`);
    assert.ok(start >= 0, `${name} missing`);
    assert.match(service.slice(start, start + 500), /assertOpenTdbPilotEnvironment\(\)/);
  }
});
