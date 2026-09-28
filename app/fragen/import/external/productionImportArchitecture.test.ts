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

test("Production writer has a single protected server-side entry path", () => {
  const workflow = read(".github/workflows/external-question-import.yml");
  const writer = read("scripts/external-import/production-writer.ts");
  const core = read("app/fragen/import/external/productionImportWriter.ts");
  assert.match(workflow, /environment: operations-backup/);
  assert.match(workflow, /environment: operations-content-import/);
  assert.ok(
    workflow.indexOf("environment: operations-backup") <
      workflow.indexOf("environment: operations-content-import"),
  );
  assert.match(workflow, /PRODUCTION_IMPORT_DATABASE_URL/);
  assert.match(workflow, /inputs\.dry_run == false/);
  assert.match(writer, /evaluateExternalImportGuard/);
  assert.match(writer, /guard\.writeAuthorized/);
  assert.match(writer, /fetchVerifiedExternalImportReviewerApproval/);
  assert.match(writer, /EXTERNAL_IMPORT_TOCTOU_PREFLIGHT_CHANGED/);
  assert.match(core, /OneTimeExternalImportAuthorization/);
  assert.doesNotMatch(writer, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\s/i);
});

test("Preview and Production reuse the same question record service", () => {
  const preview = read("app/fragen/import/external/externalQuestionImport.server.ts");
  const writer = read("scripts/external-import/production-writer.ts");
  assert.match(preview, /createExternalQuestionRecord/);
  assert.match(writer, /createExternalQuestionRecord/);
  assert.match(writer, /TransactionIsolationLevel\.Serializable/);
  assert.match(writer, /external_question_import_items\.create/);
  const service = read("app/fragen/import/external/externalQuestionWriteService.ts");
  assert.match(service, /freigegeben: false/);
  assert.match(service, /review_status: "IN_REVIEW"/);
  assert.doesNotMatch(service, /approved_at|approved_by_user_id|freigegeben: true/);
});

test("future validated backups emit immutable content-import evidence", () => {
  const workflow = read(".github/workflows/ap94-acceptance.yml");
  assert.match(workflow, /external-import-backup-evidence\.json/);
  assert.match(workflow, /name: external-import-backup-evidence/);
  assert.match(workflow, /readbackVerified: true/);
  assert.match(workflow, /integrityVerified: true/);
});
