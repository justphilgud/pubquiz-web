import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260720120000_add_event_series/migration.sql",
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
