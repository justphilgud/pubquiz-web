import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_USER_LIST_FILTERS,
  filterUsers,
  hasActiveUserFilters,
} from "./userFilterPolicy";

const users = [
  { name: "Max Muster", email: "max@example.de", isActive: true, roles: ["EDITOR" as const], eventSeriesIds: [1] },
  { name: "Ada Admin", email: "ada@example.de", isActive: true, roles: ["ADMIN" as const], eventSeriesIds: [] },
  { name: null, email: "archiv@example.de", isActive: false, roles: ["EVENT_MANAGER" as const], eventSeriesIds: [2] },
];

test("user search matches names and email addresses case-insensitively", () => {
  assert.deepEqual(filterUsers(users, { ...EMPTY_USER_LIST_FILTERS, query: "MAX" }), [users[0]]);
  assert.deepEqual(filterUsers(users, { ...EMPTY_USER_LIST_FILTERS, query: "ADA@EXAMPLE" }), [users[1]]);
});

test("event-series filter supports a concrete series and users without assignments", () => {
  assert.deepEqual(filterUsers(users, { ...EMPTY_USER_LIST_FILTERS, eventSeries: 2 }), [users[2]]);
  assert.deepEqual(filterUsers(users, { ...EMPTY_USER_LIST_FILTERS, eventSeries: "NONE" }), [users[1]]);
});

test("role and status filters use actual assignments", () => {
  assert.deepEqual(filterUsers(users, { ...EMPTY_USER_LIST_FILTERS, role: "ADMIN" }), [users[1]]);
  assert.deepEqual(filterUsers(users, { ...EMPTY_USER_LIST_FILTERS, status: "INACTIVE" }), [users[2]]);
});

test("all user filters combine with AND semantics", () => {
  assert.deepEqual(filterUsers(users, {
    query: "archiv",
    eventSeries: 2,
    role: "EVENT_MANAGER",
    status: "INACTIVE",
  }), [users[2]]);
  assert.deepEqual(filterUsers(users, {
    query: "max",
    eventSeries: 2,
    role: "EDITOR",
    status: "ACTIVE",
  }), []);
});

test("reset state returns all users and reports no active filters", () => {
  assert.deepEqual(filterUsers(users, EMPTY_USER_LIST_FILTERS), users);
  assert.equal(hasActiveUserFilters(EMPTY_USER_LIST_FILTERS), false);
  assert.equal(hasActiveUserFilters({ ...EMPTY_USER_LIST_FILTERS, query: "max" }), true);
});
