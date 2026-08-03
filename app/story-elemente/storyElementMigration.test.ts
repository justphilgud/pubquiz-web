import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260803190000_add_story_element_content_library/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");
const workflowMigration = readFileSync(
  "prisma/migrations/20260803220000_add_story_workflow_order_and_placement_policy/migration.sql",
  "utf8",
);

test("story content migration is additive and protects scopes and revisions", () => {
  assert.match(migration, /CREATE TABLE "pubquiz"\."story_elemente"/);
  assert.match(migration, /CREATE TABLE "pubquiz"\."story_element_revisionen"/);
  assert.match(migration, /CREATE TABLE "pubquiz"\."frage_story_elemente"/);
  assert.match(migration, /ck_story_elemente_scope/);
  assert.match(migration, /uq_story_element_revision/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
});

test("placements reference a concrete immutable story revision", () => {
  assert.match(schema, /story_element_revision_id\s+Int\?/);
  assert.match(schema, /story_element_revision\s+story_element_revisionen\?/);
  assert.match(schema, /model frage_story_elemente/);
  assert.match(schema, /enum StoryQuestionRelationship/);
});

test("story model has no scoring or answer fields", () => {
  const model = /model story_elemente \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
  assert.doesNotMatch(model, /punkte|antwort|bewertung/i);
});

test("story workflow migration adds deterministic link order and an explicit quiz opt-out", () => {
  assert.match(workflowMigration, /ADD COLUMN "sortierung" INTEGER NOT NULL DEFAULT 0/);
  assert.match(workflowMigration, /ROW_NUMBER\(\) OVER/);
  assert.match(workflowMigration, /verknuepfte_story_elemente_uebernehmen/);
  assert.doesNotMatch(workflowMigration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
});
