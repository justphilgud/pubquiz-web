import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "next-auth";
import { canCreateQuestions, canManageUsers } from "@/app/lib/permissions";
import { loadRoleMessages } from "@/app/i18n/roleMessages";
import {
  canAddMembership,
  countMembershipRoles,
  getAvailableEventSeries,
} from "./membershipPolicy";

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

const userSession = {
  user: { id: "3", role: "USER" },
  expires: "2099-01-01T00:00:00.000Z",
} as Session;

test("role migration is additive and preserves existing users and memberships", () => {
  assert.match(migration, /UserRole" ADD VALUE 'USER'/);
  assert.match(migration, /EventSeriesRole"[\s\S]+RENAME VALUE 'EDITOR' TO 'EVENT_EDITOR'/);
  assert.doesNotMatch(migration, /UPDATE|DELETE|DROP\s+(TABLE|COLUMN)/i);
  assert.match(schema, /enum UserRole \{[\s\S]+USER[\s\S]+EDITOR[\s\S]+ADMIN/);
  assert.match(schema, /role\s+UserRole @default\(EDITOR\)/);
});

test("USER has no global editorial or user-management rights", () => {
  assert.equal(canCreateQuestions(userSession), false);
  assert.equal(canManageUsers(userSession), false);
});

test("multiple memberships allow different roles and reject duplicate targets", () => {
  const memberships = [
    { eventSeriesId: 1, role: "EVENT_MANAGER" as const },
    { eventSeriesId: 2, role: "EVENT_EDITOR" as const },
  ];
  assert.deepEqual(countMembershipRoles(memberships), {
    EVENT_MANAGER: 1,
    EVENT_EDITOR: 1,
  });
  assert.equal(canAddMembership(memberships, 1), false);
  assert.equal(canAddMembership(memberships, 3), true);
  assert.deepEqual(
    getAvailableEventSeries([{ id: 1 }, { id: 2 }, { id: 3 }], memberships),
    [{ id: 3 }],
  );
});

test("membership actions separate add, role change and removal", () => {
  assert.match(membershipActions, /addEventSeriesMembership/);
  assert.match(membershipActions, /changeEventSeriesMembershipRole/);
  assert.match(membershipActions, /removeEventSeriesMembership/);
  assert.match(membershipActions, /\.create\(/);
  assert.match(membershipActions, /\.update\(/);
  assert.match(membershipActions, /\.delete\(/);
  assert.doesNotMatch(membershipActions, /\.upsert\(/);
});

test("user overview is compact and editing owns the full membership list", () => {
  assert.doesNotMatch(userOverview, /<details|EventSeriesMembershipManager/);
  assert.match(userOverview, /countMembershipRoles/);
  assert.match(userEditor, /EventSeriesMembershipManager/);
  assert.match(userEditor, /eventSeriesAccess/);
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
    for (const role of ["EVENT_MANAGER", "EVENT_EDITOR"] as const) {
      assert.ok(messages.eventSeriesRoles[role]);
    }
    for (const key of ["eventSeriesAccess", "access", "eventSeries", "eventSeriesRole"] as const) {
      assert.ok(messages.fields[key]);
    }
  }
});
