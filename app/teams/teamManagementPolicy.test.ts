import assert from "node:assert/strict";
import test from "node:test";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import {
  canAccessTeamFromEventSeries,
  canAccessTeamManagement,
  canManageGlobalTeamLifecycle,
  getTeamManagementEventSeriesIds,
} from "./teamManagementPolicy";

const actor = (...assignments: AuthorizationActor["assignments"]): AuthorizationActor => ({
  userId: 1,
  assignments,
});

test("administrator manages every global team and its lifecycle", () => {
  const admin = actor({ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null });
  assert.equal(getTeamManagementEventSeriesIds(admin), null);
  assert.equal(canAccessTeamManagement(admin), true);
  assert.equal(canManageGlobalTeamLifecycle(admin), true);
  assert.equal(canAccessTeamFromEventSeries(admin, []), true);
});

test("event manager is limited to teams from assigned event series", () => {
  const manager = actor({ role: "EVENT_MANAGER", scopeType: "EVENT_SERIES", eventSeriesId: 10 });
  assert.deepEqual(getTeamManagementEventSeriesIds(manager), [10]);
  assert.equal(canAccessTeamFromEventSeries(manager, [10, 20]), true);
  assert.equal(canAccessTeamFromEventSeries(manager, [20]), false);
  assert.equal(canManageGlobalTeamLifecycle(manager), false);
});

test("global and scoped editors receive no team-management rights", () => {
  for (const editor of [
    actor({ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }),
    actor({ role: "EDITOR", scopeType: "EVENT_SERIES", eventSeriesId: 10 }),
  ]) {
    assert.equal(canAccessTeamManagement(editor), false);
    assert.equal(canAccessTeamFromEventSeries(editor, [10]), false);
  }
});
