import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("live poll persistence is additive, revisioned and separate from quiz answers", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260828104000_add_live_poll_content/migration.sql");
  assert.match(schema, /model live_polls/);
  assert.match(schema, /model live_poll_revisions/);
  assert.match(schema, /model live_poll_responses/);
  assert.match(migration, /uq_live_poll_response_run_team/);
  assert.doesNotMatch(schema.slice(schema.indexOf("model live_poll_responses"), schema.indexOf("model frage_antwortfelder")), /punkte|bewertung|loesung/i);
});

test("content polls reuse runs and sessions but never write quiz submissions", () => {
  const runtime = read("app/umfragen/livePollRuntime.server.ts");
  const interaction = read("app/quiz/interaction/interaction.server.ts");
  const actions = read("app/umfragen/actions.ts");
  assert.match(runtime, /live_poll_responses\.upsert/);
  assert.match(runtime, /quiz_team_sessions\.findFirst/);
  assert.match(interaction, /CONTENT_POLL_SINGLE/);
  assert.match(interaction, /readLivePollRunSnapshot/);
  assert.match(actions, /!readLivePollRunSnapshot\(current\.config_snapshot\)/);
  assert.ok(actions.indexOf("readLivePollRunSnapshot(current.config_snapshot)") < actions.indexOf("closeCurrentInteraction(tx"));
  assert.doesNotMatch(runtime, /team_antworten\.(create|update|upsert)/);
  assert.doesNotMatch(runtime, /team_answer_submissions\.(create|update|upsert)/);
});

test("audience projection is anonymous while moderation retains original text", () => {
  const runtime = read("app/umfragen/livePollRuntime.ts");
  assert.match(runtime, /publicResponses: \{ id: number; publicText: string; updatedAt: string \}\[\]/);
  assert.match(runtime, /LivePollModerationResponse = LivePollResponseProjection/);
  assert.match(runtime, /slice\(-20\)/);
});
