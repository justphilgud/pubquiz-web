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
import { resolveUserRoleSelection } from "@/app/admin/users/userRoleFormPolicy";
import {
  filterEventSeries,
  selectAllEventSeries,
} from "@/app/admin/users/eventSeriesSelectionPolicy";

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
const userCreator = readFileSync("app/admin/users/CreateUserDialog.tsx", "utf8");
const userActions = readFileSync("app/admin/users/actions.ts", "utf8");
const roleFields = readFileSync("app/admin/users/UserRoleFields.tsx", "utf8");
const seriesPicker = readFileSync("app/admin/users/EventSeriesPicker.tsx", "utf8");
const assignmentWrites = readFileSync("app/roles/roleAssignmentWrites.server.ts", "utf8");

const userActor: AuthorizationActor = { userId: 3, assignments: [] };


test("user creation resolves combined administrator and global editor roles", () => {
  assert.deepEqual(
    resolveUserRoleSelection({
      administrator: true,
      editor: true,
      editorScope: "GLOBAL",
      editorEventSeriesIds: [],
      eventManager: false,
      eventManagerEventSeriesIds: [],
    }),
    {
      globalRoles: ["ADMIN", "EDITOR"],
      eventSeriesAssignments: [],
    },
  );
});

test("user creation resolves each standalone role", () => {
  assert.deepEqual(
    resolveUserRoleSelection({
      administrator: true,
      editor: false,
      editorScope: "GLOBAL",
      editorEventSeriesIds: [],
      eventManager: false,
      eventManagerEventSeriesIds: [],
    }),
    { globalRoles: ["ADMIN"], eventSeriesAssignments: [] },
  );
  assert.deepEqual(
    resolveUserRoleSelection({
      administrator: false,
      editor: true,
      editorScope: "GLOBAL",
      editorEventSeriesIds: [],
      eventManager: false,
      eventManagerEventSeriesIds: [],
    }),
    { globalRoles: ["EDITOR"], eventSeriesAssignments: [] },
  );
  assert.deepEqual(
    resolveUserRoleSelection({
      administrator: false,
      editor: true,
      editorScope: "EVENT_SERIES",
      editorEventSeriesIds: [10],
      eventManager: false,
      eventManagerEventSeriesIds: [],
    }),
    {
      globalRoles: [],
      eventSeriesAssignments: [{ eventSeriesId: 10, role: "EDITOR" }],
    },
  );
  assert.deepEqual(
    resolveUserRoleSelection({
      administrator: false,
      editor: false,
      editorScope: "GLOBAL",
      editorEventSeriesIds: [],
      eventManager: true,
      eventManagerEventSeriesIds: [20],
    }),
    {
      globalRoles: [],
      eventSeriesAssignments: [
        { eventSeriesId: 20, role: "EVENT_MANAGER" },
      ],
    },
  );
});

test("user creation resolves scoped editors and event managers", () => {
  assert.deepEqual(
    resolveUserRoleSelection({
      administrator: false,
      editor: true,
      editorScope: "EVENT_SERIES",
      editorEventSeriesIds: [1, 2],
      eventManager: true,
      eventManagerEventSeriesIds: [3, 4],
    }),
    {
      globalRoles: [],
      eventSeriesAssignments: [
        { eventSeriesId: 1, role: "EDITOR" },
        { eventSeriesId: 2, role: "EDITOR" },
        { eventSeriesId: 3, role: "EVENT_MANAGER" },
        { eventSeriesId: 4, role: "EVENT_MANAGER" },
      ],
    },
  );
});

test("user creation rejects missing and incomplete roles", () => {
  const base = {
    administrator: false,
    editor: false,
    editorScope: "GLOBAL",
    editorEventSeriesIds: [] as number[],
    eventManager: false,
    eventManagerEventSeriesIds: [] as number[],
  };
  assert.throws(() => resolveUserRoleSelection(base), /Mindestens eine Rolle/);
  assert.throws(
    () => resolveUserRoleSelection({
      ...base,
      editor: true,
      editorScope: "EVENT_SERIES",
    }),
    /mindestens eine Eventreihe/i,
  );
  assert.throws(
    () => resolveUserRoleSelection({ ...base, eventManager: true }),
    /mindestens eine Eventreihe/i,
  );
  assert.throws(
    () => resolveUserRoleSelection({
      ...base,
      editor: true,
      editorScope: "EVENT_SERIES",
      editorEventSeriesIds: [1],
      eventManager: true,
      eventManagerEventSeriesIds: [1],
    }),
    /nur einer Rolle/,
  );
});

test("event-series picker searches, preserves archive filtering and selects in bulk", () => {
  const series = [
    { id: 1, name: "K\u00f6ln", archived: false },
    { id: 2, name: "Berlin", archived: false },
    { id: 3, name: "K\u00f6ln Alt", archived: true },
  ];
  assert.deepEqual(
    filterEventSeries(series, { locale: "de", query: "k\u00f6ln", showArchived: false }),
    [series[0]],
  );
  assert.deepEqual(selectAllEventSeries(series, { includeArchived: false }), [1, 2]);
  assert.deepEqual(selectAllEventSeries(series, { includeArchived: true }), [1, 2, 3]);
  assert.deepEqual(
    selectAllEventSeries(series, { includeArchived: true, unavailableIds: [2] }),
    [1, 3],
  );
});

test("create and edit reuse responsive role fields and searchable picker", () => {
  assert.match(userCreator, /UserRoleFields/);
  assert.match(userEditor, /UserRoleFields/);
  assert.match(roleFields, /editor &&/);
  assert.match(roleFields, /eventManager &&/);
  assert.match(seriesPicker, /SearchInput/);
  assert.match(seriesPicker, /overflow-y-auto/);
  assert.match(seriesPicker, /sm:grid-cols-2/);
  assert.doesNotMatch(seriesPicker, /overflow-x-auto|break-all/);
});

test("user and all assignments are created inside one rollback boundary", () => {
  assert.match(
    userActions,
    /withSerializableTransaction[\s\S]+users\.create[\s\S]+replaceGlobalRoleAssignments[\s\S]+replaceEventSeriesRoleAssignments/,
  );
  assert.match(assignmentWrites, /benutzer_rollenzuweisungen\.create/);
  assert.match(assignmentWrites, /eventreihe_benutzerrollen\.create/);
  assert.doesNotMatch(userActions, /\$transaction\([^,]+\)/);
});
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
  assert.match(userEditor, /UserRoleFields/);
  assert.match(roleFields, /EventSeriesPicker/);
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
    for (const key of [
      "administratorDescription",
      "editorDescription",
      "eventManagerDescription",
      "selectedEventSeries",
      "selectEditorSeries",
      "selectManagerSeries",
    ] as const) {
      assert.ok(messages.roleConfiguration[key]);
    }
    for (const key of [
      "searchLabel",
      "selectAllActive",
      "selectAll",
      "showArchived",
      "done",
    ] as const) {
      assert.ok(messages.eventSeriesPicker[key]);
    }
  }
});
