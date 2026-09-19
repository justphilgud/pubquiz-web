import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260722120000_add_rendering_templates/migration.sql",
  "utf8",
);
const consistencyMigration = readFileSync(
  "prisma/migrations/20260813120000_sync_template_source_fields/migration.sql",
  "utf8",
);
const cleanupMigration = readFileSync(
  "prisma/migrations/20260919170000_cleanup_presentation_templates/migration.sql",
  "utf8",
);

test("template migration is additive and preserves inheritance for existing data", () => {
  assert.match(migration, /default_presentation_template_id[^;]+NOT NULL DEFAULT 'ungegoogelt-default'/);
  assert.match(migration, /default_answer_form_template_id[^;]+NOT NULL DEFAULT 'ungegoogelt-default'/);
  assert.match(migration, /presentation_template_id[^;]+VARCHAR\(64\)/);
  assert.match(migration, /answer_form_template_id[^;]+VARCHAR\(64\)/);
  assert.doesNotMatch(migration, /UPDATE\s+"pubquiz"\."quiz"/i);
  assert.doesNotMatch(migration, /DELETE|DROP\s+(TABLE|COLUMN)/i);
});

test("template consistency migration follows the authoritative presentation fields", () => {
  assert.match(
    consistencyMigration,
    /UPDATE "pubquiz"\."eventreihen"[\s\S]+SET "default_answer_form_template_id" = "default_presentation_template_id"/,
  );
  assert.match(
    consistencyMigration,
    /UPDATE "pubquiz"\."quiz"[\s\S]+SET "answer_form_template_id" = "presentation_template_id"/,
  );
  assert.equal((consistencyMigration.match(/IS DISTINCT FROM/g) ?? []).length, 2);
  assert.doesNotMatch(consistencyMigration, /DELETE|DROP\s+(TABLE|COLUMN)/i);
});

test("template cleanup migrates every retired reference before archiving copies", () => {
  assert.match(cleanupMigration, /BEGIN;[\s\S]+COMMIT;/);
  assert.match(cleanupMigration, /'ungegoogelt-dark'/);
  assert.match(cleanupMigration, /'corporate-reference'/);
  assert.match(cleanupMigration, /"source_template_id" IS NOT NULL/);
  assert.match(cleanupMigration, /"presentation_template_id" LIKE '%-kopie%'/);
  assert.match(cleanupMigration, /lower\(trim\("name"\)\) LIKE '%kopie'/);

  const eventSeriesUpdate = cleanupMigration.indexOf('UPDATE "pubquiz"."eventreihen"');
  const quizUpdate = cleanupMigration.indexOf('UPDATE "pubquiz"."quiz"');
  const archiveUpdate = cleanupMigration.indexOf('UPDATE "pubquiz"."presentation_templates"');
  assert.ok(eventSeriesUpdate > 0);
  assert.ok(quizUpdate > eventSeriesUpdate);
  assert.ok(archiveUpdate > quizUpdate);
  assert.match(cleanupMigration, /RAISE EXCEPTION 'Template cleanup left a reference to a retired template'/);
});

test("template cleanup only changes template references and archival metadata", () => {
  assert.doesNotMatch(cleanupMigration, /DELETE\s+FROM|TRUNCATE/i);
  assert.equal((cleanupMigration.match(/UPDATE "pubquiz"\."quiz"/g) ?? []).length, 2);
  assert.match(cleanupMigration, /SET "presentation_template_id" = 'ungegoogelt-default'/);
  assert.match(cleanupMigration, /SET "answer_form_template_id" = 'ungegoogelt-default'/);
  assert.doesNotMatch(cleanupMigration, /SET\s+"(?:titel|eventreihe_id|intro_|outro_|aufloesungsstrategie)/i);
  assert.match(cleanupMigration, /SET[\s\S]+"status" = 'ARCHIVED',[\s\S]+"updated_at" = CURRENT_TIMESTAMP/);
});
