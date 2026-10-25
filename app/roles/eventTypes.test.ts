import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_TYPES, isEventType } from "./eventTypes";
import { hasEventTypeAccess, canManageEventSeries, canEditGlobalQuestions, type AuthorizationActor } from "./roleAssignmentPolicy";
test("catalogue has stable unique identifiers, no implied playable future formats", () => {
  assert.deepEqual(EVENT_TYPES.map(t => t.id), ["QUIZ", "BINGO", "POWERPOINT_KARAOKE"]);
  assert.equal(EVENT_TYPES.filter(t => t.implemented).length, 1); assert.equal(isEventType("UNKNOWN"), false);
});
test("one person may manage Quiz in A, edit Quiz and manage Bingo in B", () => {
  const actor: AuthorizationActor = { userId: 3, assignments: [], eventTypeAssignments: [
    { eventSeriesId: 10, eventType: "QUIZ", role: "EVENT_MANAGER", enabled: true },
    { eventSeriesId: 20, eventType: "QUIZ", role: "EDITOR", enabled: true },
    { eventSeriesId: 20, eventType: "BINGO", role: "EVENT_MANAGER", enabled: true },
  ] };
  assert.equal(hasEventTypeAccess(actor, 10, "QUIZ", "EVENT_MANAGER"), true);
  assert.equal(hasEventTypeAccess(actor, 20, "QUIZ", "EVENT_MANAGER"), false);
  assert.equal(hasEventTypeAccess(actor, 20, "QUIZ"), true);
  assert.equal(hasEventTypeAccess(actor, 20, "BINGO", "EVENT_MANAGER"), true);
  assert.equal(hasEventTypeAccess(actor, 10, "BINGO"), false);
  assert.equal(canManageEventSeries(actor, 20), false);
});
test("product and user role are independent conjunctive prerequisites", () => {
  const actor: AuthorizationActor = { userId: 4, assignments: [], eventTypeAssignments: [
    { eventSeriesId: 20, eventType: "BINGO", role: "EVENT_MANAGER", enabled: false },
  ] };
  assert.equal(hasEventTypeAccess(actor, 20, "BINGO"), false);
  assert.equal(hasEventTypeAccess(actor, 10, "QUIZ"), false);
  assert.equal(hasEventTypeAccess({ ...actor, eventTypeAssignments: [{ ...actor.eventTypeAssignments![0], enabled: true }] }, 20, "BINGO"), true);
});
test("global Quiz editor gains no new product rights; admin stays global", () => {
  const editor: AuthorizationActor = { userId: 2, assignments: [{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }] };
  assert.equal(canEditGlobalQuestions(editor), true);
  for (const t of EVENT_TYPES) assert.equal(hasEventTypeAccess(editor, 20, t.id), false);
  const admin: AuthorizationActor = { userId: 1, assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }] };
  for (const t of EVENT_TYPES) assert.equal(hasEventTypeAccess(admin, 20, t.id, "EVENT_MANAGER"), true);
});
