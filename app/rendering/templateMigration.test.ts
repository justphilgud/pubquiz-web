import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260722120000_add_rendering_templates/migration.sql",
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
