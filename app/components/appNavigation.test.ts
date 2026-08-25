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
  canManageTeams,
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
    canAccessStoryElements: true,
    canManageQuizzes: canManageQuizzes(actor),
    canManageEventSeries: canManageEventSeries(actor),
    canViewPresentationTemplates: canManageUsers(actor),
    canManageCategories: canManageCategories(actor),
    canManageUsers: canManageUsers(actor),
    canManageTeams: canManageTeams(actor),
  });
}

test("admin navigation orders event series, quiz and templates before users", () => {
  assert.deepEqual(navigationItemsFor(adminActor), [
    { href: "/content", label: "Content" },
    { href: "/admin/eventreihen", label: "Eventreihen" },
    { href: "/quiz", label: "Quiz" },
    { href: "/admin/teams", label: "Teams" },
    { href: "/templates", label: "Templates" },
    { href: "/admin/users", label: "Benutzer" },
  ]);
});

test("category capability never exposes the dashboard-only category route", () => {
  assert.equal(
    getAppNavigationItems({
      canAccessQuestions: false,
      canAccessStoryElements: false,
      canManageQuizzes: false,
      canManageEventSeries: false,
      canViewPresentationTemplates: false,
      canManageCategories: true,
      canManageUsers: false,
      canManageTeams: false,
    }).some(({ href }) => href === "/admin/kategorien"),
    false,
  );
});

test("editor navigation does not expose admin destinations", () => {
  assert.deepEqual(navigationItemsFor(editorActor), [
    { href: "/content", label: "Content" },
  ]);
});

test("USER without global or event-series rights has no functional navigation", () => {
  assert.deepEqual(
    getAppNavigationItems({
      canAccessQuestions: false,
      canAccessStoryElements: false,
      canManageQuizzes: false,
      canManageEventSeries: false,
      canViewPresentationTemplates: false,
      canManageCategories: false,
      canManageUsers: false,
      canManageTeams: false,
    }),
    [],
  );
});

test("membership capabilities expose operational navigation without users", () => {
  assert.deepEqual(
    getAppNavigationItems({
      canAccessQuestions: true,
      canAccessStoryElements: true,
      canManageQuizzes: true,
      canManageEventSeries: true,
      canViewPresentationTemplates: false,
      canManageCategories: false,
      canManageUsers: false,
      canManageTeams: true,
    }),
    [
      { href: "/content", label: "Content" },
      { href: "/admin/eventreihen", label: "Eventreihen" },
      { href: "/quiz", label: "Quiz" },
      { href: "/admin/teams", label: "Teams" },
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

test("template navigation stays active throughout the generator", () => {
  assert.equal(isAppNavigationItemActive("/templates", "/templates"), true);
  assert.equal(isAppNavigationItemActive("/templates/new", "/templates"), true);
  assert.equal(isAppNavigationItemActive("/quiz", "/templates"), false);
});

test("content navigation owns all content library and editor routes", () => {
  for (const pathname of [
    "/content",
    "/content/new",
    "/fragen",
    "/fragen/editor/12",
    "/story-elemente",
    "/story-elemente/42",
  ]) {
    assert.equal(isAppNavigationItemActive(pathname, "/content"), true, pathname);
  }
  assert.equal(isAppNavigationItemActive("/quiz", "/content"), false);
});

test("either existing content capability exposes one shared navigation item", () => {
  const base = {
    canManageQuizzes: false,
    canManageEventSeries: false,
    canViewPresentationTemplates: false,
    canManageCategories: false,
    canManageUsers: false,
    canManageTeams: false,
  };
  assert.deepEqual(getAppNavigationItems({ ...base, canAccessQuestions: true, canAccessStoryElements: false }), [{ href: "/content", label: "Content" }]);
  assert.deepEqual(getAppNavigationItems({ ...base, canAccessQuestions: false, canAccessStoryElements: true }), [{ href: "/content", label: "Content" }]);
});
