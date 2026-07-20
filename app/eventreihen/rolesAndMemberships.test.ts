import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { canCreateQuestions, canManageUsers } from "@/app/lib/permissions";
import { loadRoleMessages } from "@/app/i18n/roleMessages";
import {
  canAddEventSeriesRole,
  countEventSeriesRoleAssignments,
  getAvailableEventSeries,
} from "./membershipPolicy";
import { getGlobalAssignmentRoles } from "@/app/admin/users/userOverviewPolicy";

const migration = readFileSync(
  "prisma/migrations/20260723120000_cleanup_event_series_roles/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");
const membershipActions = readFileSync(
  "app/eventreihen/membershipActions.ts",
  "utf8",
);
const userOverview = readFileSync("app/admin/users/page.tsx", "utf8");
const userEditor = readFileSync("app/admin/users/EditUserDialog.tsx", "utf8");
const eventSeriesPage = readFileSync(
  "app/admin/eventreihen/[eventSeriesId]/page.tsx",
  "utf8",
);
const appHeader = readFileSync("app/components/AppHeader.tsx", "utf8");
const userMenu = readFileSync("app/components/UserMenu.tsx", "utf8");

const userActor: AuthorizationActor = { userId: 3, assignments: [] };

test("user overview reads assignments without deserializing legacy EVENT_EDITOR rows", () => {
  const legacyEventEditorRow = { rolle: "EVENT_EDITOR" };

  assert.equal(legacyEventEditorRow.rolle, "EVENT_EDITOR");
  assert.match(userOverview, /getRoleAssignmentOptions/);
  assert.match(membershipActions, /benutzer_rollenzuweisungen\.findMany/);
  assert.doesNotMatch(
    membershipActions,
    /eventreihe_benutzerrollen\.(findMany|findFirst)/,
  );
  assert.doesNotMatch(userOverview, /eventreihe_benutzerrollen|user\.role/);
});

test("navigation displays global roles from assignments instead of users.role", () => {
  assert.match(appHeader, /hasGlobalRole\(actor, "EDITOR"\)/);
  assert.match(appHeader, /roleLabel=\{globalRoleLabel\}/);
  assert.doesNotMatch(appHeader, /session\.user\.role/);
  assert.doesNotMatch(userMenu, /getUserRoleLabel|\brole:\s*string/);
});

test("global overview roles come only from valid GLOBAL assignments", () => {
  assert.deepEqual(
    getGlobalAssignmentRoles([
      { rolle: "ADMIN", scope_typ: "GLOBAL", eventreihe_id: null },
      { rolle: "EDITOR", scope_typ: "GLOBAL", eventreihe_id: null },
      { rolle: "EDITOR", scope_typ: "EVENT_SERIES", eventreihe_id: 10 },
      { rolle: "USER", scope_typ: "GLOBAL", eventreihe_id: null },
    ]),
    ["ADMIN", "EDITOR"],
  );
});

test("USER without a global assignment is represented without a global role", () => {
  assert.deepEqual(
    getGlobalAssignmentRoles([
      { rolle: "EVENT_MANAGER", scope_typ: "EVENT_SERIES", eventreihe_id: 10 },
      { rolle: "EDITOR", scope_typ: "EVENT_SERIES", eventreihe_id: 20 },
    ]),
    [],
  );
});

test("unknown overview assignment values fail closed", () => {
  assert.deepEqual(
    getGlobalAssignmentRoles([
      { rolle: "OWNER", scope_typ: "GLOBAL", eventreihe_id: null },
      { rolle: "ADMIN", scope_typ: "UNKNOWN", eventreihe_id: null },
      { rolle: "EDITOR", scope_typ: "GLOBAL", eventreihe_id: 10 },
      { rolle: "EVENT_MANAGER", scope_typ: "GLOBAL", eventreihe_id: null },
    ]),
    [],
  );
});

test("role migration is additive and preserves existing users and memberships", () => {
  assert.match(migration, /UserRole" ADD VALUE 'USER'/);
  assert.match(migration, /EventSeriesRole"[\s\S]+RENAME VALUE 'EDITOR' TO 'EVENT_EDITOR'/);
  assert.doesNotMatch(migration, /UPDATE|DELETE|DROP\s+(TABLE|COLUMN)/i);
  assert.match(schema, /enum UserRole \{[\s\S]+USER[\s\S]+EDITOR[\s\S]+ADMIN/);
  assert.match(schema, /role\s+UserRole @default\(EDITOR\)/);
});

test("USER has no global editorial or user-management rights", () => {
  assert.equal(canCreateQuestions(userActor), false);
  assert.equal(canManageUsers(userActor), false);
});

test("multiple event-series assignments allow different roles and reject duplicate targets", () => {
  const memberships = [
    { eventSeriesId: 1, role: "EVENT_MANAGER" as const },
    { eventSeriesId: 2, role: "EDITOR" as const },
  ];
  assert.deepEqual(countEventSeriesRoleAssignments(memberships), {
    EVENT_MANAGER: 1,
    EDITOR: 1,
  });
  assert.equal(canAddEventSeriesRole(memberships, 1), false);
  assert.equal(canAddEventSeriesRole(memberships, 3), true);
  assert.deepEqual(
    getAvailableEventSeries([{ id: 1 }, { id: 2 }, { id: 3 }], memberships),
    [{ id: 3 }],
  );
});

test("membership actions separate add, role change and removal", () => {
  assert.match(membershipActions, /addEventSeriesRoleAssignment/);
  assert.match(membershipActions, /changeEventSeriesRoleAssignment/);
  assert.match(membershipActions, /removeEventSeriesRoleAssignment/);
  assert.match(membershipActions, /\.create\(/);
  assert.match(membershipActions, /\.update\(/);
  assert.match(membershipActions, /\.delete\(/);
  assert.doesNotMatch(membershipActions, /\.upsert\(/);
});

test("user overview is compact and editing owns the full membership list", () => {
  assert.doesNotMatch(userOverview, /<details|EventSeriesMembershipManager/);
  assert.match(userOverview, /countEventSeriesRoleAssignments/);
  assert.match(userEditor, /EventSeriesRoleAssignmentManager/);
  assert.match(userEditor, /eventSeriesRoles/);
});

test("event-series page exposes only a compact access summary", () => {
  assert.match(eventSeriesPage, /accessSummary/);
  assert.match(eventSeriesPage, /editInUserManagement/);
  assert.doesNotMatch(eventSeriesPage, /EventSeriesMembershipManager|<select/);
});

test("German and English role and membership messages are complete", () => {
  for (const locale of ["de", "en"] as const) {
    const messages = loadRoleMessages(locale);
    for (const role of ["USER", "EDITOR", "ADMIN"] as const) {
      assert.ok(messages.globalRoles[role]);
    }
    for (const role of ["EVENT_MANAGER", "EDITOR"] as const) {
      assert.ok(messages.assignmentRoles[role]);
    }
    for (const key of ["eventSeriesAccess", "access", "eventSeries", "eventSeriesRole"] as const) {
      assert.ok(messages.fields[key]);
    }
  }
});
