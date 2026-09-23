import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("AP3 moderator mutations and team votes use existing authorization boundaries", () => {
  const actions = read("app/quiz/memeVotingActions.ts");
  assert.match(actions, /requireQuizLiveController/);
  assert.match(actions, /resolveParticipantSession/);
  assert.match(actions, /startMemePresentationAction/);
  assert.match(actions, /transitionMemePresentationAction/);
  assert.match(actions, /submitMemeVoteAction/);
});

test("AP3 persists one effective vote per presentation and team", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260923210000_add_meme_presentation_voting/migration.sql");
  assert.match(schema, /@@unique\(\[meme_presentation_id, quiz_team_session_id\]/);
  assert.match(migration, /uq_meme_vote_presentation_team/);
  assert.match(migration, /ON DELETE RESTRICT/);
});

test("AP3 enforces approved candidates, self-vote rejection and closed-vote rejection on the server", () => {
  const service = read("app/quiz/memeVoting.server.ts");
  const policy = read("app/quiz/memeVoting.ts");
  assert.match(service, /where: \{ review_status: "APPROVED"/);
  assert.match(service, /planMemeVoteWrite/);
  assert.match(policy, /VOTING_CLOSED/);
  assert.match(policy, /SELF_VOTE/);
  assert.match(service, /pg_advisory_xact_lock/);
  assert.match(service, /REVISION_CONFLICT/);
});

test("AP3 reuses the shared renderer and disables the own candidate in the team UI", () => {
  const stage = read("app/rendering/meme/MemePresentationStage.tsx");
  const team = read("app/quiz/[quizId]/antworten/MemeVotingPanel.tsx");
  assert.match(stage, /MemeRenderer/);
  assert.match(team, /own \|\| pendingCandidateId/);
  assert.match(team, /Eigenes Meme · gesperrt/);
});

test("AP3 exposes neutral progress only to moderation and provides a closed AP4 read model", () => {
  const service = read("app/quiz/memeVoting.server.ts");
  assert.match(service, /if \(presentation && input\.includeModeration\)/);
  assert.match(service, /readClosedMemeVotingForAp4/);
  assert.match(service, /state: "VOTING_CLOSED" as const/);
  assert.doesNotMatch(read("app/rendering/meme/MemePresentationStage.tsx"), /votesCast|eligibleTeams|ranking|share|Prozent/);
});
