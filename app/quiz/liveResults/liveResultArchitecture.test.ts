import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync("app/quiz/actions.ts", "utf8");
const snapshotRoute = readFileSync("app/api/quiz/live-snapshot/route.ts", "utf8");
const interactionServer = readFileSync("app/quiz/interaction/interaction.server.ts", "utf8");
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

test("replacement CRUD is admin-only and public rendering has no team identity", () => {
  assert.match(adminActions, /requireAdmin\(\)/);
  const publicTextRenderer = renderer.slice(renderer.indexOf('data-live-result-kind="text"'), renderer.indexOf('data-live-result-kind="choice"'));
  assert.doesNotMatch(publicTextRenderer, /teamName|avatarCode|photoUrl|originalText/);
});

test("effective submissions are latest-per-team and replacements stay outside stored payloads", () => {
  assert.match(interactionServer, /latestLiveSubmissions/);
  assert.match(interactionServer, /findIndex[\s\S]{0,200}quiz_team_session_id/);
  assert.doesNotMatch(actions.slice(actions.indexOf("setLiveTextResponsePublication"), actions.indexOf("getQuizLiveSnapshot")), /team_answer_submissions\.(update|delete)/);
});

test("the additive migration seeds only the required configurable initial rule", () => {
  assert.match(migration, /'Penis', 'Sonnenblume'/);
  assert.equal((migration.match(/INSERT INTO "pubquiz"\."public_text_replacement_rules"/g) ?? []).length, 1);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/);
});
