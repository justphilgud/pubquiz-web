import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260825150000_add_global_team_identity/migration.sql", "utf8");
const sessionService = readFileSync("app/teams/teamSession.server.ts", "utf8");
const managementService = readFileSync("app/teams/teamManagement.server.ts", "utf8");
const actions = readFileSync("app/teams/actions.ts", "utf8");
const passwordPanel = readFileSync("app/admin/teams/TeamPasswordPanel.tsx", "utf8");
const lifecyclePanel = readFileSync("app/admin/teams/TeamLifecyclePanel.tsx", "utf8");
const listLoader = managementService.slice(
  managementService.indexOf("export async function loadTeamManagementPage"),
  managementService.indexOf("export async function loadTeamDetail"),
);

test("quiz sessions and quiz assignments reference one stable global team identity", () => {
  assert.match(schema, /model teams[\s\S]+teamname_normalisiert\s+String\s+@unique/);
  assert.match(schema, /model quiz_team_sessions[\s\S]+team_id\s+Int[\s\S]+@@unique\(\[quiz_id, team_id\]/);
  assert.match(sessionService, /where:\s*\{ teamname_normalisiert: normalizedName \}/);
  assert.match(sessionService, /quiz_id_team_id/);
  assert.match(sessionService, /quiz_teams\.upsert/);
  assert.doesNotMatch(sessionService, /quiz_id_teamname/);
});

test("migration refuses ambiguous legacy data instead of merging it", () => {
  assert.match(migration, /normalized duplicate team names require manual resolution/);
  assert.match(migration, /quiz session has no unambiguous global team/);
  assert.match(migration, /ON DELETE RESTRICT/);
});

test("quiz and event-series results stay scoped below the global team", () => {
  assert.match(schema, /model quiz_teams[\s\S]+@@unique\(\[quiz_id, team_id\]/);
  assert.match(schema, /model quiz[\s\S]+eventreihe_id\s+Int/);
  assert.match(managementService, /quiz:\s*\{ eventreihe_id: \{ in: eventSeriesIds \} \}/);
});

test("password data is revealed only through an authorized server action", () => {
  assert.match(actions, /revealTeamPasswordAction[\s\S]+requireTeamManagementActor[\s\S]+assertTeamAccess/);
  assert.match(passwordPanel, /Passwort anzeigen/);
  assert.doesNotMatch(listLoader, /team_passwort:\s*true/);
  assert.doesNotMatch(actions, /console\.(?:info|warn|error)\([^\n]*password/i);
});

test("event-manager direct object access is checked server-side", () => {
  assert.match(managementService, /assertTeamAccess/);
  assert.match(managementService, /where:\s*\{ team_id: teamId, \.\.\.teamScopeWhere\(actor\) \}/);
  for (const operation of ["setTeamPasswordAction", "randomizeTeamPasswordAction"]) {
    assert.match(actions, new RegExp(`${operation}[\\s\\S]+assertTeamAccess`));
  }
});

test("destructive actions are admin-only and history needs explicit name confirmation", () => {
  assert.match(actions, /requireAdminTeamActor/);
  assert.match(actions, /confirmation !== team\.teamname/);
  assert.match(actions, /quiz_team_sessions\.deleteMany/);
  assert.match(actions, /quiz_teams\.deleteMany/);
  assert.match(lifecyclePanel, /Team endgültig löschen/);
  assert.match(lifecyclePanel, /Sessions, Antworten, Bewertungen, Punkte und Quizzuordnungen/);
});
