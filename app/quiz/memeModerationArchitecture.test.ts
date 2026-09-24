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
const submissionControls = readFileSync(
  "app/quiz/[quizId]/moderation/components/MemeSubmissionControls.tsx",
  "utf8",
);
const interactionService = readFileSync(
  "app/quiz/interaction/interaction.server.ts",
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
  assert.equal(exportedActions, 4);
  assert.equal(authorizationChecks, exportedActions);
});

test("moderation reuses the shared MemeRenderer and does not expose team names", () => {
  assert.match(review, /MemeRenderer/);
  assert.doesNotMatch(review, /teamName|teamname/);
  assert.doesNotMatch(review, /<input|<textarea/);
});

test("AP3 reads only approved candidates from a completed persisted review", () => {
  assert.match(service, /state: "COMPLETED"/);
  assert.match(service, /where: \{ review_status: "APPROVED" \}/);
  assert.match(service, /orderBy: \{ position: "asc" \}/);
  assert.match(service, /teamId: candidate\.submission\.quiz_team_session\.team_id/);
});

test("untimed Meme submissions close through the existing authoritative and idempotent run transition", () => {
  assert.match(submissionControls, /Einreichungen beenden/);
  assert.match(submissionControls, /state\.timerEnabled/);
  assert.match(actions, /closeUntimedMemeSubmissionPhaseAction/);
  assert.match(actions, /if \(!config \|\| config\.timerEnabled\)/);
  assert.match(actions, /closeQuizQuestionInteraction/);
  assert.match(actions, /MODERATOR_CLOSED_MEME_SUBMISSIONS/);
  assert.match(interactionService, /if \(run\.state === "OPEN" \|\| run\.state === "COUNTDOWN"\)/);
  assert.match(interactionService, /return run;/);
});
