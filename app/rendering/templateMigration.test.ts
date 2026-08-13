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
