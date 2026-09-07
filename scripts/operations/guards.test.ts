import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { backupProduction } from "./backup";
import { DATABASES, assertDumpIntegrity, assertRestoreTarget, backupPolicy, databaseIdentity, refreshPlan, safeError } from "./guards";

const connection = (env: keyof typeof DATABASES) => `postgresql://test:SECRET@${DATABASES[env].host}/neondb?schema=pubquiz`;
const valid = { sourceEnvironment: "production", targetEnvironment: "preview", sourceUrl: connection("production"), targetUrl: connection("preview") };

test("ENV-TEST-01: only Production -> Preview is allowed", () => {
  assert.equal(refreshPlan(valid).direction, "production -> preview");
});
test("ENV-TEST-02: reversed environments fail closed", () => {
  assert.throws(() => refreshPlan({ ...valid, sourceEnvironment: "preview", targetEnvironment: "production", sourceUrl: valid.targetUrl, targetUrl: valid.sourceUrl }));
});
test("ENV-TEST-03: Production cannot be target, including pooled aliases", () => {
  for (const targetUrl of [connection("production"), connection("production").replace(".c-3", "-pooler.c-3")]) {
    assert.throws(() => refreshPlan({ ...valid, targetUrl }));
  }
});
test("ENV-TEST-04: unknown host, environment, database, schema, port and protocol fail", () => {
  for (const targetUrl of ["postgres://x:y@evil.example/neondb", connection("preview").replace("neondb", "wrong"), connection("preview").replace("pubquiz", "public"), connection("preview").replace("/neondb", ":9999/neondb"), connection("preview").replace("postgresql:", "https:")]) {
    assert.throws(() => refreshPlan({ ...valid, targetUrl }));
  }
  assert.throws(() => refreshPlan({ ...valid, targetEnvironment: "development" }));
});
test("ENV-TEST-05: only safe identity metadata, never secrets or raw errors", () => {
  assert.equal(JSON.stringify(databaseIdentity(valid.sourceUrl)).includes("SECRET"), false);
  assert.equal(safeError(new Error(valid.sourceUrl)), "OPERATIONS_FAILED_DETAILS_WITHHELD");
  try { databaseIdentity("SECRET invalid"); } catch (error) { assert.equal(safeError(error).includes("SECRET"), false); }
});
test("ENV-TEST-06: unsuccessful, empty or unreadable dumps never pass integrity", () => {
  for (const [dump, bytes, list] of [[1, 40, 0], [0, 0, 0], [0, 40, 1], [null, 40, 0], [0, 40, null]]) {
    assert.throws(() => assertDumpIntegrity(dump, bytes!, list));
  }
  assert.doesNotThrow(() => assertDumpIntegrity(0, 40, 0));
});
test("ENV-TEST-07: restore forbids all persistent environments even as expected host", () => {
  for (const environment of Object.keys(DATABASES) as (keyof typeof DATABASES)[]) {
    assert.throws(() => assertRestoreTarget(connection(environment), "restore-test", DATABASES[environment].host));
  }
  const temporary = "ep-restore-test-123.c-3.eu-central-1.aws.neon.tech";
  assert.doesNotThrow(() => assertRestoreTarget(`postgres://u:p@${temporary}/neondb`, "restore-test", temporary));
  assert.throws(() => assertRestoreTarget(`postgres://u:p@${temporary}/neondb`, "production", temporary));
});
test("retention has explicit classes and rejects arbitrary paths", () => {
  assert.deepEqual(["daily", "weekly", "release"].map(kind => backupPolicy(kind).retentionDays), [14, 56, 186]);
  assert.throws(() => backupPolicy("../production"));
});
test("missing private storage aborts before any database connection or dump", async () => {
  await assert.rejects(backupProduction({ PRODUCTION_BACKUP_DATABASE_URL: connection("production") }), /BLOCKED_PRIVATE_BACKUP_STORAGE_REQUIRED/);
  await assert.rejects(backupProduction({ PRODUCTION_BACKUP_DATABASE_URL: connection("production"), BACKUP_BLOB_READ_WRITE_TOKEN: "test", BACKUP_PRIVATE_BLOB_HOST: "test.public.blob.vercel-storage.com" }), /BLOCKED_PRIVATE_BACKUP_STORAGE_REQUIRED/);
});
test("backup never deletes or overwrites existing remote objects and withholds command output", () => {
  const source = readFileSync(new URL("./backup.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bdel\(/);
  assert.doesNotMatch(source, /allowOverwrite: true|access: "public"/);
  assert.match(source, /allowOverwrite: false/);
  assert.match(source, /stdio: "ignore"/);
  assert.match(source, /default_transaction_read_only=on/);
  assert.ok(source.indexOf("BACKUP_READBACK_CHECKSUM_FAILED") < source.indexOf("const manifest"));
});
test("refresh is manual, workflows cannot deploy or inherit production environment secrets", () => {
  for (const name of ["refresh-preview", "backup-production", "restore-backup-test"]) {
    const source = readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), "utf8");
    assert.match(source, /workflow_dispatch:/);
    assert.doesNotMatch(source, /environment: production|secrets\.DATABASE_URL|vercel.*deploy|upload-artifact|contents: write/);
    if (name === "refresh-preview") assert.doesNotMatch(source, /schedule:/);
  }
});
