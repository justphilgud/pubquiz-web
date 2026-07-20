import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "next-auth";
import {
  getAppNavigationItems,
  isAppNavigationItemActive,
} from "./appNavigation";
import {
  canManageEventSeries,
  canManageQuizzes,
  canManageUsers,
} from "@/app/lib/permissions";

const adminSession = {
  user: { id: "1", role: "ADMIN" },
  expires: "2099-01-01T00:00:00.000Z",
} as Session;

const editorSession = {
  user: { id: "2", role: "EDITOR" },
  expires: "2099-01-01T00:00:00.000Z",
} as Session;

function navigationItemsFor(session: Session) {
  return getAppNavigationItems({
    canAccessQuestions: true,
    canManageQuizzes: canManageQuizzes(session),
    canManageEventSeries: canManageEventSeries(session),
    canManageUsers: canManageUsers(session),
  });
}

test("admin navigation contains event series between quiz and user management", () => {
  assert.deepEqual(navigationItemsFor(adminSession), [
    { href: "/fragen", label: "Fragen" },
    { href: "/quiz", label: "Quiz" },
    { href: "/admin/eventreihen", label: "Eventreihen" },
    { href: "/admin/users", label: "Benutzer" },
  ]);
});

test("editor navigation does not expose admin destinations", () => {
  assert.deepEqual(navigationItemsFor(editorSession), [
    { href: "/fragen", label: "Fragen" },
  ]);
});

test("USER without global or event-series rights has no functional navigation", () => {
  assert.deepEqual(
    getAppNavigationItems({
      canAccessQuestions: false,
      canManageQuizzes: false,
      canManageEventSeries: false,
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
