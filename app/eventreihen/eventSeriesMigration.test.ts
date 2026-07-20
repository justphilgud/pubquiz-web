import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260720120000_add_event_series/migration.sql",
  "utf8",
);
const roleAndQuestionScopeMigration = readFileSync(
  "prisma/migrations/20260721120000_add_event_series_roles_and_question_scope/migration.sql",
  "utf8",
);

test("migration assigns every existing quiz to the deterministic legacy series", () => {
  assert.match(migration, /VALUES \('Bestandsquizze', 'bestandsquizze'/);
  assert.match(migration, /UPDATE "pubquiz"\."quiz"/);
  assert.match(migration, /ALTER COLUMN "eventreihe_id" SET NOT NULL/);
  assert.match(migration, /ON DELETE RESTRICT/);
});

test("migration deliberately does not invent or constrain legacy quiz dates", () => {
  assert.doesNotMatch(
    migration,
    /UPDATE\s+"pubquiz"\."quiz"\s+SET\s+"quiz_datum"/i,
  );
  assert.doesNotMatch(migration, /ALTER COLUMN "quiz_datum" SET NOT NULL/);
});

test("role and question-scope migration keeps existing questions global", () => {
  assert.match(roleAndQuestionScopeMigration, /"geltungsbereich"[^;]+NOT NULL DEFAULT 'GLOBAL'/);
  assert.doesNotMatch(roleAndQuestionScopeMigration, /UPDATE\s+"pubquiz"\."fragen"/i);
  assert.doesNotMatch(roleAndQuestionScopeMigration, /INSERT\s+INTO\s+"pubquiz"\."eventreihe_benutzerrollen"/i);
});

test("role and question-scope migration contains typed roles and relational constraints", () => {
  assert.match(roleAndQuestionScopeMigration, /EventSeriesRole[\s\S]+EVENT_MANAGER[\s\S]+EDITOR/);
  assert.match(roleAndQuestionScopeMigration, /uq_eventreihe_benutzerrolle_benutzer_eventreihe/);
  assert.match(roleAndQuestionScopeMigration, /uq_fragen_eventreihen_frage_eventreihe/);
  assert.match(roleAndQuestionScopeMigration, /FOREIGN KEY \("fragen_id"\)/);
});
