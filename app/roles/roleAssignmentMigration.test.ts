import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("prisma/migrations/20260724120000_add_scope_role_assignments/migration.sql", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const membershipActions = readFileSync("app/eventreihen/membershipActions.ts", "utf8");
const userActions = readFileSync("app/admin/users/actions.ts", "utf8");
const transaction = readFileSync("app/roles/serializableTransaction.server.ts", "utf8");
const assignmentManager = readFileSync("app/eventreihen/EventSeriesMembershipManager.tsx", "utf8");
const userEditor = readFileSync("app/admin/users/EditUserDialog.tsx", "utf8");
const documentation = readFileSync("docs/architecture/role-assignments.md", "utf8");

test("assignment migration is additive and keeps every legacy structure", () => {
  assert.match(migration, /CREATE TYPE "pubquiz"\."RoleAssignmentRole"/);
  assert.match(migration, /CREATE TYPE "pubquiz"\."RoleScopeType"/);
  assert.match(migration, /CREATE TABLE "pubquiz"\."benutzer_rollenzuweisungen"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)|ALTER\s+TYPE[\s\S]+RENAME/i);
  assert.match(schema, /role\s+UserRole\s+@default\(EDITOR\)/);
  assert.match(schema, /model eventreihe_benutzerrollen/);
});

test("database constraints reject invalid scope references and role combinations", () => {
  assert.match(migration, /ck_rollenzuweisung_scope_referenz/);
  assert.match(migration, /ck_rollenzuweisung_rolle_scope/);
  assert.match(migration, /GLOBAL[\s\S]+eventreihe_id" IS NULL/);
  assert.match(migration, /EVENT_SERIES[\s\S]+eventreihe_id" IS NOT NULL/);
  assert.match(migration, /GLOBAL[\s\S]+ADMIN[\s\S]+EDITOR/);
  assert.match(migration, /EVENT_SERIES[\s\S]+EDITOR[\s\S]+EVENT_MANAGER/);
});

test("partial unique indexes cover global roles and variant-A event roles", () => {
  assert.match(migration, /uq_rollenzuweisung_global[\s\S]+benutzer_id", "rolle"[\s\S]+WHERE "scope_typ" = 'GLOBAL'/);
  assert.match(migration, /uq_rollenzuweisung_eventreihe[\s\S]+benutzer_id", "eventreihe_id"[\s\S]+WHERE "scope_typ" = 'EVENT_SERIES'/);
});

test("backfill maps all legacy roles without duplicates or destructive writes", () => {
  assert.match(migration, /WHEN 'ADMIN' THEN 'ADMIN'/);
  assert.match(migration, /WHEN 'EDITOR' THEN 'EDITOR'/);
  assert.match(migration, /WHERE "role"::text IN \('ADMIN', 'EDITOR'\)/);
  assert.match(migration, /WHEN 'EVENT_EDITOR' THEN 'EDITOR'/);
  assert.match(migration, /WHEN 'EVENT_MANAGER' THEN 'EVENT_MANAGER'/);
  assert.match(migration, /"zugewiesen_von_user_id",\s*"created_at",\s*"updated_at"/);
  assert.match(migration, /ON CONFLICT DO NOTHING/g);
  assert.doesNotMatch(migration, /DELETE\s+FROM|UPDATE\s+"pubquiz"\."users"/i);
});

test("dual writes use serializable transactions and touch both representations", () => {
  assert.match(transaction, /isolationLevel: "Serializable"/);
  assert.match(transaction, /P2034/);
  assert.match(userActions, /replaceGlobalRoleAssignments/);
  for (const operation of ["create", "update", "delete"] as const) {
    assert.match(membershipActions, new RegExp(`benutzer_rollenzuweisungen\\.${operation}`));
  }
  assert.match(membershipActions, /eventreihe_benutzerrollen\.create/);
  assert.match(membershipActions, /eventreihe_benutzerrollen\.updateMany/);
  assert.match(membershipActions, /eventreihe_benutzerrollen\.deleteMany/);
  assert.doesNotMatch(membershipActions, /\.upsert\(/);
});

test("role UI separates global and event-series roles and remains mobile safe", () => {
  assert.match(userEditor, /globalRoles/);
  assert.match(userEditor, /EventSeriesRoleAssignmentManager/);
  assert.match(assignmentManager, /eventSeriesArchived/);
  assert.match(assignmentManager, /\[overflow-wrap:anywhere\]/);
  assert.match(assignmentManager, /min-h-11/);
  assert.match(assignmentManager, /aria-live="polite"/);
  assert.doesNotMatch(assignmentManager, /EVENT_EDITOR/);
});

test("transition documentation defines source of truth, dual write and later contract", () => {
  assert.match(documentation, /alleinige Berechtigungsquelle/);
  assert.match(documentation, /serialisierbaren Transaktion/);
  assert.match(documentation, /Contract-Phase/);
  assert.match(documentation, /users\.role/);
});
