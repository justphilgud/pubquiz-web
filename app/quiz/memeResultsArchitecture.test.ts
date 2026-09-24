import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("AP4 finalization is moderator-only and accepts only a closed AP3 voting", () => {
  const action = read("app/quiz/memeResultsActions.ts");
  const service = read("app/quiz/memeResults.server.ts");
  assert.match(action, /requireQuizLiveController/);
  assert.match(service, /state: "VOTING_CLOSED"/);
  assert.match(service, /where: \{ review_status: "APPROVED", selected_for_presentation: true \}/);
  assert.match(service, /votes: \{ select: \{ meme_moderation_candidate_id: true \} \}/);
});

test("AP4 serializes two moderators and persists exactly one immutable result entry per candidate", () => {
  const service = read("app/quiz/memeResults.server.ts");
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260923230000_add_meme_results/migration.sql");
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /if \(presentation\.result_finalized_at\)/);
  assert.match(service, /alreadyFinalized: true/);
  assert.match(schema, /@@unique\(\[meme_presentation_id, meme_moderation_candidate_id\]/);
  assert.match(migration, /uq_meme_result_presentation_candidate/);
  assert.match(migration, /winner_points_check/);
});

test("AP4 writes winner points into the central quiz score and adds no parallel scoreboard", () => {
  const service = read("app/quiz/memeResults.server.ts");
  const scoreboard = read("app/quiz/[quizId]/praesentation/statusActions.ts");
  assert.match(service, /tx\.team_antworten\.updateMany/);
  assert.match(service, /vergebene_punkte: points/);
  assert.match(service, /strategy: "MEME_VOTING"/);
  assert.match(scoreboard, /tx\.team_antworten\.groupBy/);
  assert.doesNotMatch(read("prisma/schema.prisma"), /meme_(score|scoreboard|total_points)/i);
});

test("AP4 never mutates AP1 submissions, AP2 candidates or AP3 votes", () => {
  const service = read("app/quiz/memeResults.server.ts");
  assert.doesNotMatch(service, /team_answer_submissions\.(update|updateMany|delete|deleteMany)/);
  assert.doesNotMatch(service, /meme_moderation_(selections|candidates)\.(update|updateMany|delete|deleteMany)/);
  assert.doesNotMatch(service, /meme_votes\.(create|update|updateMany|delete|deleteMany|upsert)/);
});

test("AP4 exposes team identity only for moderation or the existing solution phase", () => {
  const snapshot = read("app/quiz/memeVoting.server.ts");
  const interaction = read("app/quiz/interaction/interaction.server.ts");
  assert.match(snapshot, /input\.includeResult \|\| input\.includeModeration/);
  assert.match(interaction, /presentationIdentity\.phase === "SOLUTION"/);
  assert.doesNotMatch(read("app/rendering/meme/MemePresentationStage.tsx"), /teamName|TeamIdentityVisual|voteCount|share/);
});

test("AP4 blocks forward navigation and later recalculation until the persisted result is final", () => {
  const navigation = read("app/quiz/[quizId]/praesentation/statusActions.ts");
  const evaluation = read("app/quiz/evaluation/evaluation.server.ts");
  const actions = read("app/quiz/actions.ts");
  assert.match(navigation, /result_finalized_at: \{ not: null \}/);
  assert.match(navigation, /Meme-Voting schließen und Ergebnis finalisieren/);
  assert.match(evaluation, /templateId === "meme_beschriften"/);
  assert.match(evaluation, /result_finalized_at: \{ not: null \}/);
  assert.match(actions, /finalisierte Meme-Voting bestimmt diese Punkte/);
});

test("AP4 keeps direct and delayed reveal in the existing question/solution slide sequence", () => {
  const renderer = read("app/rendering/presentation/PresentationSlideRenderer.tsx");
  const slides = read("app/quiz/[quizId]/praesentation/buildPraesentationSlides.ts");
  assert.match(renderer, /slide\.typ === "frage"[\s\S]*MemePresentationStage/);
  assert.match(renderer, /MemeResultStage/);
  assert.match(slides, /resolveQuizBlockSequence/);
  assert.match(slides, /solutionStrategy: blockSequence\.strategy/);
});
