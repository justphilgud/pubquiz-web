import { getNavigationCapabilities, activeNavigationSection, workspaceCollectionHref, quizCollectionReturnHref, teamCollectionReturnHref } from "./workspacePolicy";
import assert from "node:assert/strict";
import test from "node:test";
import { needsWorkspaceObjectContext, bindWorkspaceContentParams, canAccessCrossSeriesContent, getWorkspaceChoices, searchWorkspaceChoices, workspaceHref, workspaceSwitchHref } from "./workspacePolicy";
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

test("background context readback is limited to actual objects, never home, collections or live views", () => {
  for (const path of ["/", "/content", "/fragen", "/admin/users", "/quiz", "/workspaces/7/quiz/content", "/quiz/7/moderation", "/quiz/7/praesentation", "/quiz/7/antworten", "/content/questions/new"]) assert.equal(needsWorkspaceObjectContext(path), false, path);
  for (const path of ["/quiz/7", "/quiz/7/slides/intro", "/quiz/7/auswertung", "/quiz/7/auswertung/teams", "/content/questions/7", "/content/story-elements/7", "/content/polls/7", "/admin/eventreihen/7"]) assert.equal(needsWorkspaceObjectContext(path), true, path);
});


test("stable navigation uses the union of all permitted rows and keeps independent management", () => {
  const manager = actor("EVENT_MANAGER", [1, 2]);
  const choices = getWorkspaceChoices(manager, [{ ...series[0], products: ["QUIZ"] }, series[1]]);
  const capabilities = getNavigationCapabilities(manager, choices);
  assert.deepEqual(capabilities, { content: true, quizzes: true, bingo: true, karaoke: true, teams: true, templates: false, series: true, admin: false });
  assert.deepEqual(getNavigationCapabilities({ ...base, managedEventSeriesIds: [7] }, getWorkspaceChoices({ ...base, managedEventSeriesIds: [7] }, series)), { content: false, quizzes: false, bingo: false, karaoke: false, teams: false, templates: false, series: true, admin: false });
});

test("Bingo-only manager cannot access existing Quiz teams through the shared menu", () => {
  const bingoOnly: AuthorizationActor = { ...base, eventTypeAssignments: [{ eventSeriesId: 1, eventType: "BINGO", role: "EVENT_MANAGER", enabled: true }] };
  const capabilities = getNavigationCapabilities(bingoOnly, getWorkspaceChoices(bingoOnly, series));
  assert.equal(capabilities.bingo, true); assert.equal(capabilities.teams, false); assert.equal(capabilities.quizzes, false); assert.equal(capabilities.content, false);
  const editor = getNavigationCapabilities(actor("EDITOR"), getWorkspaceChoices(actor("EDITOR"), series));
  assert.equal(editor.karaoke, false); assert.equal(editor.teams, false); assert.equal(editor.templates, false);
});

test("main section remains attached to objects and old scoped routes", () => {
  for (const path of ["/content", "/content/questions/4", "/fragen/editor/4", "/quiz/1", "/workspaces/7/quiz/events"]) assert.equal(activeNavigationSection(path), "Quiz");
  assert.equal(activeNavigationSection("/admin/teams/1"), "Teams");
  assert.equal(activeNavigationSection("/workspaces/7/quiz/teams"), "Teams");
  assert.equal(activeNavigationSection("/templates/one"), "Templates");
  assert.equal(activeNavigationSection("/workspaces/7/settings"), "Eventreihen");
  assert.equal(activeNavigationSection("/admin/users"), "Administration");
  assert.equal(activeNavigationSection("/workspaces/7/bingo"), "Bingo");
});

test("series collection selection preserves the task and filters, never old objects", () => {
  assert.equal(workspaceCollectionHref(9, "quiz", "stories", "q=Bleibt&eventSeriesId=7&quizId=4&returnTo=evil"), "/workspaces/9/quiz/stories?q=Bleibt");
  assert.equal(workspaceCollectionHref(null, "quiz", "stories", "q=Bleibt"), "/content?q=Bleibt&contentType=STORY_ELEMENT");
  assert.equal(workspaceCollectionHref(9, "quiz", "events", "status=PAST&editQuizId=99"), "/workspaces/9/quiz/events?status=PAST");
  assert.equal(workspaceCollectionHref(null, "bingo", undefined, "quizId=99"), "/bingo");
});

test("quiz and team returns retain collection context and reject external or unrelated objects", () => {
  assert.equal(quizCollectionReturnHref("/quiz?series=7&status=PAST", 7), "/quiz?series=7&status=PAST");
  assert.equal(quizCollectionReturnHref("/workspaces/7/quiz/events?q=x", 7), "/workspaces/7/quiz/events?q=x");
  assert.equal(quizCollectionReturnHref("/workspaces/8/quiz/events", 7), "/quiz?series=7");
  assert.equal(quizCollectionReturnHref("/quiz?series=7&editQuizId=999&returnTo=evil", 7), "/quiz?series=7");
  assert.equal(teamCollectionReturnHref("/admin/teams?eventSeriesId=7&teamId=999"), "/admin/teams?eventSeriesId=7");
  assert.equal(teamCollectionReturnHref("/admin/teams?eventSeriesId=7"), "/admin/teams?eventSeriesId=7");
  for (const invalid of ["https://evil.invalid/quiz", "//evil.invalid/admin/teams", "/quiz/999", "/admin/users", "/admin/teams/9"]) {
    assert.equal(quizCollectionReturnHref(invalid, 7), "/quiz?series=7");
    assert.equal(teamCollectionReturnHref(invalid), "/admin/teams");
  }
});
