import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync("app/quiz/actions.ts", "utf8");
const quizEditor = readFileSync("app/quiz/[quizId]/QuizFragenSortableTable.tsx", "utf8");
const moderation = readFileSync("app/quiz/[quizId]/moderation/ModerationClient.tsx", "utf8");
const snapshotRoute = readFileSync("app/api/quiz/live-snapshot/route.ts", "utf8");
const interactionServer = readFileSync("app/quiz/interaction/interaction.server.ts", "utf8");
const effectiveLiveSubmissions = readFileSync("app/quiz/liveResults/effectiveLiveSubmissions.ts", "utf8");
const adminActions = readFileSync("app/admin/live-text-replacements/actions.ts", "utf8");
const renderer = readFileSync("app/rendering/presentation/PresentationSlideRenderer.tsx", "utf8");
const migration = readFileSync("prisma/migrations/20260826120000_add_live_text_moderation/migration.sql", "utf8");

test("live controls and text publications use scoped live-controller authorization", () => {
  for (const action of ["setQuizLiveResultVisibility", "closeQuizQuestionAnswerPhase", "setLiveTextResponsePublication"]) {
    const start = actions.indexOf(`function ${action}`);
    assert.notEqual(start, -1);
    assert.match(actions.slice(start, start + 900), /requireQuizLiveController/);
  }
  assert.match(snapshotRoute, /includeLiveModeration[\s\S]{0,180}requireQuizLiveController/);
});

test("editor persistence and runtime use the same executable LIVE support contract", () => {
  const updateAction = actions.slice(
    actions.indexOf("export async function updateQuizQuestionResultDisplayMode"),
    actions.indexOf("export async function updateQuizAbschnitteSortierung"),
  );
  assert.match(updateAction, /ist_richtig: true/);
  assert.match(updateAction, /supportsLiveResultQuestion/);
  assert.doesNotMatch(updateAction, /map\(\(\) => \(\{ isCorrect: false \}\)\)/);
  assert.match(actions, /live_ergebnis_unterstuetzt: liveResultSupported/);
  assert.match(quizEditor, /await updateQuizQuestionResultDisplayMode[\s\S]{0,500}setItems/);
});

test("productive moderation requests private text data and exposes publish and hide controls", () => {
  assert.match(moderation, /includeLiveModeration: true/);
  assert.match(moderation, /Original/);
  assert.match(moderation, /Öffentlich/);
  assert.match(moderation, /Ersetzung angewendet/);
  assert.match(moderation, /Für Publikum freigeben/);
  assert.match(moderation, /Freigabe zurücknehmen/);
});

test("live-result reveal is server-confirmed and only offered after close", () => {
  const visibilityAction = actions.slice(
    actions.indexOf("export async function setQuizLiveResultVisibility"),
    actions.indexOf("export async function closeQuizQuestionAnswerPhase"),
  );
  assert.match(visibilityAction, /canToggleLiveResultVisibility\(run\.state\)/);
  assert.match(visibilityAction, /return \{\s*visible: updatedRun\.live_results_visible/);
  assert.match(moderation, /const result = await setQuizLiveResultVisibility/);
  assert.match(moderation, /visible: result\.visible/);
  assert.match(moderation, /liveResultMutationRevisionRef/);
  assert.match(moderation, /setLiveResultControlError/);
  assert.match(moderation, /role="alert"/);
  assert.match(moderation, /Antwortphase schließen/);
  assert.match(moderation, /Ergebnis anzeigen/);
  assert.match(moderation, /Quiz-Live-Ergebnis/);
  assert.match(moderation, /Antworten ansehen \(intern\)/);
  assert.match(moderation, /Antwortphase schließen/);
  assert.match(moderation, /Ergebnis anzeigen/);
  assert.doesNotMatch(moderation, /Aktuelle Verteilung zeigen/);
  assert.match(interactionServer, /isLiveResultVisibleToAudience/);
  assert.match(interactionServer, /canIncludeLiveResultAggregates/);
});

test("replacement CRUD is admin-only and public rendering has no team identity", () => {
  assert.match(adminActions, /requireAdmin\(\)/);
  const publicTextRenderer = renderer.slice(renderer.indexOf('data-live-result-kind="text"'), renderer.indexOf('data-live-result-kind="choice"'));
  assert.doesNotMatch(publicTextRenderer, /teamName|avatarCode|photoUrl|originalText/);
});

test("effective submissions are latest-per-team and replacements stay outside stored payloads", () => {
  assert.match(interactionServer, /selectEffectiveLiveSubmissions/);
  assert.match(interactionServer, /team_antworten\.findMany/);
  assert.match(effectiveLiveSubmissions, /answer\.interaction_run_id !== input\.interactionRunId/);
  assert.match(effectiveLiveSubmissions, /submission_version > current\.submission_version/);
  assert.doesNotMatch(actions.slice(actions.indexOf("setLiveTextResponsePublication"), actions.indexOf("getQuizLiveSnapshot")), /team_answer_submissions\.(update|delete)/);
});

test("the additive migration seeds only the required configurable initial rule", () => {
  assert.match(migration, /'Penis', 'Sonnenblume'/);
  assert.equal((migration.match(/INSERT INTO "pubquiz"\."public_text_replacement_rules"/g) ?? []).length, 1);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/);
});
