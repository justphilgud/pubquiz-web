import assert from "node:assert/strict";
import test from "node:test";
import { bindWorkspaceContentParams, canAccessCrossSeriesContent, getWorkspaceChoices, searchWorkspaceChoices, workspaceHref, workspaceSwitchHref } from "./workspacePolicy";
import { contentReturnHref } from "@/app/components/content/contentNavigation";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
const base: AuthorizationActor = { userId: 1, assignments: [] };
const series = Array.from({ length: 110 }, (_, index) => ({ id: index + 1, name: `Reihe ${String(index + 1).padStart(3, "0")}`, products: ["QUIZ", "BINGO", "POWERPOINT_KARAOKE"] }));
function actor(role: string, ids = [1]): AuthorizationActor {
  return { ...base, assignments: ids.map(id => ({ role, scopeType: "EVENT_SERIES", eventSeriesId: id })), eventTypeAssignments: ids.flatMap(id => series[0].products.map(eventType => ({ eventSeriesId: id, eventType, role, enabled: true }))) };
}
test("catalog reuses current per-series/product policy; managers never receive foreign rows", () => {
  const choices = getWorkspaceChoices(actor("EVENT_MANAGER", [1, 2]), series);
  assert.deepEqual(choices.map(choice => choice.id), [1, 2]);
  assert.deepEqual(choices[0].eventTypes, ["QUIZ", "BINGO", "POWERPOINT_KARAOKE"]);
  assert.equal(choices[0].canManage, false);
  assert.equal(choices[0].canManageQuiz, true);
});
test("editors have no Karaoke functions or quiz management; global editor is Quiz library only", () => {
  const choices = getWorkspaceChoices(actor("EDITOR"), series);
  assert.deepEqual(choices[0].eventTypes, ["QUIZ", "BINGO"]);
  assert.equal(choices[0].canManageQuiz, false);
  const global = { ...base, assignments: [{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }] };
  assert.deepEqual(getWorkspaceChoices(global, series), []);
  assert.equal(canAccessCrossSeriesContent(global), true);
});
test("management-only access remains independent, including no enabled products", () => {
  const choices = getWorkspaceChoices({ ...base, managedEventSeriesIds: [7] }, series.map(row => ({ ...row, products: [] })));
  assert.deepEqual(choices.map(choice => choice.id), [7]);
  assert.equal(workspaceHref(choices[0]), "/workspaces/7/settings");
  assert.equal(canAccessCrossSeriesContent(base), false);
  assert.deepEqual(getWorkspaceChoices(base, series), []);
});
test("disabled products and removed assignments disappear; Admin also has no disabled product entry", () => {
  const admin = { ...base, assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }] };
  assert.deepEqual(getWorkspaceChoices(admin, [{ ...series[0], products: [] }])[0].eventTypes, []);
  assert.deepEqual(getWorkspaceChoices(actor("EDITOR"), [{ ...series[0], products: ["POWERPOINT_KARAOKE"] }]), []);
  assert.deepEqual(getWorkspaceChoices(base, series), []);
});
test("110-row search is case-insensitive and context switches always discard old object IDs", () => {
  const choices = getWorkspaceChoices(actor("EVENT_MANAGER", series.map(row => row.id)), series);
  assert.equal(choices.length, 110);
  assert.deepEqual(searchWorkspaceChoices(choices, "  REIHE 109 ").map(choice => choice.id), [109]);
  assert.equal(workspaceHref(choices[108], "BINGO"), "/workspaces/109/bingo");
  assert.equal(workspaceHref({ ...choices[108], eventTypes: ["QUIZ"] }, "BINGO"), "/workspaces/109/quiz");
});
test("safe content return preserves canonical list context but rejects external and object targets", () => {
  assert.equal(contentReturnHref("/workspaces/109/quiz/stories?q=abc"), "/workspaces/109/quiz/stories?q=abc");
  for (const invalid of ["https://evil.invalid/workspaces/1/quiz/content", "//evil.invalid/content", "/workspaces/1/quiz/new-question", "/workspaces/0/quiz/content", "/workspaces/1/bingo/content"]) assert.equal(contentReturnHref(invalid), "/content");
});

test("collection switches preserve the work area only when available, never object IDs", () => {
  const manager = getWorkspaceChoices(actor("EVENT_MANAGER"), series)[0];
  assert.equal(workspaceSwitchHref(manager, "QUIZ", "stories"), "/workspaces/1/quiz/stories");
  assert.equal(workspaceSwitchHref(manager, "QUIZ", "77"), "/workspaces/1/quiz/events");
  const editor = getWorkspaceChoices(actor("EDITOR"), series)[0];
  assert.equal(workspaceSwitchHref(editor, "QUIZ", "teams"), "/workspaces/1/quiz/content");
  assert.equal(workspaceSwitchHref(editor, "BINGO", "content"), "/workspaces/1/bingo");
});

test("workspace path wins over manipulated scope/type filters; resets cannot drop context", () => {
  const query = bindWorkspaceContentParams("eventSeriesId=999&contentType=POLL&q=bleibt", 7, "QUESTION");
  assert.equal(query.get("eventSeriesId"), "7");
  assert.equal(query.get("contentType"), "QUESTION");
  assert.equal(query.get("q"), "bleibt");
  assert.equal(bindWorkspaceContentParams("", 7, "STORY_ELEMENT").toString(), "eventSeriesId=7&contentType=STORY_ELEMENT");
  assert.equal(bindWorkspaceContentParams("eventSeriesId=999&contentType=POLL", undefined, "QUESTION").toString(), "eventSeriesId=999&contentType=POLL");
});
