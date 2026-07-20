import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditEventSeriesQuestions,
  canEditGlobalQuestions,
  canManageEventSeries,
  canManageUsers,
  canReviewEventSeriesQuestions,
  hasGlobalRole,
  isLastActiveRoleHolder,
  isValidRoleAssignment,
  type AuthorizationActor,
  type RoleAssignmentSnapshot,
} from "./roleAssignmentPolicy";

const assignment = (role: unknown, scopeType: unknown, eventSeriesId: number | null): RoleAssignmentSnapshot => ({ role, scopeType, eventSeriesId });

test("only documented role and scope combinations are valid", () => {
  assert.equal(isValidRoleAssignment(assignment("ADMIN", "GLOBAL", null)), true);
  assert.equal(isValidRoleAssignment(assignment("EDITOR", "GLOBAL", null)), true);
  assert.equal(isValidRoleAssignment(assignment("EDITOR", "EVENT_SERIES", 10)), true);
  assert.equal(isValidRoleAssignment(assignment("EVENT_MANAGER", "EVENT_SERIES", 10)), true);
  assert.equal(isValidRoleAssignment(assignment("ADMIN", "EVENT_SERIES", 10)), false);
  assert.equal(isValidRoleAssignment(assignment("EVENT_MANAGER", "GLOBAL", null)), false);
  assert.equal(isValidRoleAssignment(assignment("EDITOR", "EVENT_SERIES", null)), false);
  assert.equal(isValidRoleAssignment(assignment("EDITOR", "GLOBAL", 10)), false);
  assert.equal(isValidRoleAssignment(assignment("UNKNOWN", "GLOBAL", null)), false);
  assert.equal(isValidRoleAssignment(assignment("EDITOR", "UNKNOWN", null)), false);
});

test("ADMIN global is a superset without redundant editor assignment", () => {
  const actor: AuthorizationActor = { userId: 1, assignments: [assignment("ADMIN", "GLOBAL", null)] };
  assert.equal(canManageUsers(actor), true);
  assert.equal(canEditGlobalQuestions(actor), true);
  assert.equal(canManageEventSeries(actor, 99), true);
  assert.equal(hasGlobalRole(actor, "EDITOR"), false);
});

test("global editor and scoped manager rights are united", () => {
  const actor: AuthorizationActor = {
    userId: 2,
    assignments: [
      assignment("EDITOR", "GLOBAL", null),
      assignment("EVENT_MANAGER", "EVENT_SERIES", 10),
      assignment("EDITOR", "EVENT_SERIES", 20),
    ],
  };
  assert.equal(canEditGlobalQuestions(actor), true);
  assert.equal(canReviewEventSeriesQuestions(actor, 10), true);
  assert.equal(canEditEventSeriesQuestions(actor, 20), true);
  assert.equal(canManageEventSeries(actor, 20), false);
  assert.equal(canEditEventSeriesQuestions(actor, 30), false);
});

test("invalid and unknown assignments fail closed", () => {
  const actor: AuthorizationActor = {
    userId: 3,
    assignments: [
      assignment("ADMIN", "EVENT_SERIES", 10),
      assignment("EVENT_MANAGER", "GLOBAL", null),
      assignment("UNKNOWN", "GLOBAL", null),
    ],
  };
  assert.equal(canManageUsers(actor), false);
  assert.equal(canEditGlobalQuestions(actor), false);
  assert.equal(canManageEventSeries(actor, 10), false);
});

test("last active role holder protection distinguishes one from multiple holders", () => {
  assert.equal(isLastActiveRoleHolder(1), true);
  assert.equal(isLastActiveRoleHolder(2), false);
});
