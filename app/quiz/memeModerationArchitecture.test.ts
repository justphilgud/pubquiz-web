import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260923190000_add_meme_moderation/migration.sql",
  "utf8",
);
const service = readFileSync("app/quiz/memeModeration.server.ts", "utf8");
const actions = readFileSync("app/quiz/memeModerationActions.ts", "utf8");
const review = readFileSync(
  "app/quiz/[quizId]/moderation/components/MemeModerationReview.tsx",
  "utf8",
);

test("persists exactly one stable selection per interaction run and one stable position", () => {
  assert.match(schema, /interaction_run_id\s+Int\s+@unique/);
  assert.match(schema, /@@unique\(\[meme_moderation_selection_id, position\]/);
  assert.match(migration, /interaction_run_id_key/);
  assert.match(service, /FOR UPDATE/);
  assert.match(
    service,
    /findUnique\(\{[\s\S]*?where: \{ interaction_run_id:/,
  );
});

test("review updates use optimistic revisions and never mutate AP1 submissions", () => {
  assert.match(service, /review_revision: input\.expectedReviewRevision/);
  assert.match(service, /selection\.revision !== input\.expectedRevision/);
  assert.match(service, /REVISION_CONFLICT/);
  assert.doesNotMatch(service, /team_answer_submissions\.(update|updateMany|delete|deleteMany)/);
  assert.match(review, /Ausschlüsse werden nicht nachbesetzt/);
});

test("every AP2 Server Action repeats live-controller authorization", () => {
  const exportedActions = [...actions.matchAll(/export async function /g)].length;
  const authorizationChecks = [...actions.matchAll(/requireQuizLiveController\(input\.quizId\)/g)].length;
  assert.equal(exportedActions, 3);
  assert.equal(authorizationChecks, exportedActions);
});

test("moderation reuses the shared MemeRenderer and does not expose team names", () => {
  assert.match(review, /MemeRenderer/);
  assert.doesNotMatch(review, /teamName|teamname/);
  assert.doesNotMatch(review, /<input|<textarea/);
});

test("AP3 reads only approved candidates from a completed persisted review", () => {
  assert.match(service, /state: "COMPLETED"/);
  assert.match(service, /where: \{ review_status: "APPROVED", selected_for_presentation: true \}/);
  assert.match(service, /orderBy: \{ position: "asc" \}/);
  assert.match(service, /teamId: candidate\.submission\.quiz_team_session\.team_id/);
});

test("pre-moderation syncs final submissions while input is open and randomizes only after close", () => {
  assert.match(service, /run\.state !== "OPEN"/);
  assert.match(service, /syncReviewCandidates/);
  assert.match(service, /ANSWER_PHASE_OPEN/);
  assert.match(service, /randomizeMemeCandidates/);
  assert.match(service, /selected_for_presentation:/);
  assert.match(review, /answerPhaseOpen/);
  assert.match(review, /keinen Teamnamen|anonym|anonyme/i);
});

test("a completed empty review lets the central Weiter flow leave the Meme question", () => {
  const moderationClient = readFileSync(
    "app/quiz/[quizId]/moderation/ModerationClient.tsx",
    "utf8",
  );
  assert.match(review, /selectionState === "SKIPPED"/);
  assert.match(moderationClient, /prepared\?\.skipped/);
});
