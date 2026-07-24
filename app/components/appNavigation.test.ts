import assert from "node:assert/strict";
import test from "node:test";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import {
  getAppNavigationItems,
  isAppNavigationItemActive,
} from "./appNavigation";
import {
  canManageEventSeries,
  canManageCategories,
  canManageQuizzes,
  canManageUsers,
} from "@/app/lib/permissions";

const adminActor: AuthorizationActor = {
  userId: 1,
  assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }],
};

const editorActor: AuthorizationActor = {
  userId: 2,
  assignments: [{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }],
};

function navigationItemsFor(actor: AuthorizationActor) {
  return getAppNavigationItems({
    canAccessQuestions: true,
    canManageQuizzes: canManageQuizzes(actor),
    canManageEventSeries: canManageEventSeries(actor),
    canManageCategories: canManageCategories(actor),
    canManageUsers: canManageUsers(actor),
  });
}

test("admin navigation contains event series between quiz and user management", () => {
  assert.deepEqual(navigationItemsFor(adminActor), [
    { href: "/fragen", label: "Fragen" },
    { href: "/quiz", label: "Quiz" },
    { href: "/admin/eventreihen", label: "Eventreihen" },
    { href: "/admin/kategorien", label: "Kategorien" },
    { href: "/admin/users", label: "Benutzer" },
  ]);
});

test("editor navigation does not expose admin destinations", () => {
  assert.deepEqual(navigationItemsFor(editorActor), [
    { href: "/fragen", label: "Fragen" },
  ]);
});

test("USER without global or event-series rights has no functional navigation", () => {
  assert.deepEqual(
    getAppNavigationItems({
      canAccessQuestions: false,
      canManageQuizzes: false,
      canManageEventSeries: false,
      canManageCategories: false,
      canManageUsers: false,
    }),
    [],
  );
});

test("membership capabilities expose operational navigation without users", () => {
  assert.deepEqual(
    getAppNavigationItems({
      canAccessQuestions: true,
      canManageQuizzes: true,
      canManageEventSeries: true,
      canManageCategories: false,
      canManageUsers: false,
    }),
    [
      { href: "/fragen", label: "Fragen" },
      { href: "/quiz", label: "Quiz" },
      { href: "/admin/eventreihen", label: "Eventreihen" },
    ],
  );
});

test("event series navigation stays active on detail pages", () => {
  assert.equal(
    isAppNavigationItemActive("/admin/eventreihen", "/admin/eventreihen"),
    true,
  );
  assert.equal(
    isAppNavigationItemActive("/admin/eventreihen/12", "/admin/eventreihen"),
    true,
  );
  assert.equal(
    isAppNavigationItemActive("/admin/users", "/admin/eventreihen"),
    false,
  );
});
