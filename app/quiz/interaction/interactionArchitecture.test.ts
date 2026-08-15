import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("stores current runs, CAS drafts and immutable versioned snapshots additively", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read(
    "prisma/migrations/20260814120000_add_quiz_interaction_runs/migration.sql",
  );
  assert.match(schema, /model quiz_interaction_runs/);
  assert.match(schema, /model team_answer_submissions/);
  assert.match(schema, /draft_revision\s+Int\s+@default\(0\)/);
  assert.match(schema, /submission_version\s+Int\s+@default\(1\)/);
  assert.match(
    schema,
    /@@unique\(\[interaction_run_id, quiz_team_session_id, submission_version\]/,
  );
  assert.match(
    schema,
    /@@unique\(\[interaction_run_id, quiz_team_session_id, draft_revision\]/,
  );
  assert.match(migration, /WHERE "is_current" = true/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|TRUNCATE/);
});

test("resubmission migration preserves existing snapshots and versions later submissions", () => {
  const migration = read(
    "prisma/migrations/20260815100000_allow_interaction_resubmissions/migration.sql",
  );
  const service = read("app/quiz/interaction/interaction.server.ts");
  assert.match(migration, /ADD COLUMN "submission_version"/);
  assert.match(migration, /uq_team_answer_submission_run_team_draft/);
  assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|DROP TABLE/);
  assert.match(service, /planSubmissionVersion/);
  assert.match(service, /submission_version: versionPlan\.submissionVersion/);
  assert.doesNotMatch(service, /team_answer_submissions\.update/);
});

test("presentation drives active runs while block close finalizes every released question", () => {
  const statusActions = read(
    "app/quiz/[quizId]/praesentation/statusActions.ts",
  );
  const actions = read("app/quiz/actions.ts");
  assert.match(statusActions, /syncInteractionForPresentation/);
  assert.match(statusActions, /parseQuizBlockPreviewSectionId/);
  assert.match(
    statusActions,
    /previewSectionId[\s\S]*ist_freigegeben: true[\s\S]*aktuelle_quiz_fragen_id: null/,
  );
  assert.match(
    statusActions,
    /identity\.phase === "QUESTION"[\s\S]*aktuelle_quiz_fragen_id: question\.quiz_fragen_id/,
  );
  assert.match(actions, /closeBlockInteractions/);
  assert.match(actions, /getQuizLiveSnapshot/);
  assert.match(
    actions,
    /antwort\.interaction_run_id === interactionRun\?\.interaction_run_id/,
  );
  assert.match(actions, /saveTeamAntwortDraft/);
  assert.match(actions, /submitTeamAntwort/);
  assert.match(statusActions, /distinct: \["quiz_team_session_id"\]/);
});

test("draft writes serialize on the run and use compare-and-swap revisions", () => {
  const service = read("app/quiz/interaction/interaction.server.ts");
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /expectedDraftRevision !== currentRevision/);
  assert.match(service, /REVISION_CONFLICT/);
  assert.match(service, /skipDuplicates: true/);
  assert.match(service, /DEADLINE_EXPIRED/);
});

test("only final submission lifecycle events trigger productive evaluation", () => {
  const service = read("app/quiz/interaction/interaction.server.ts");
  const saveDraft = service.slice(
    service.indexOf("export async function saveTeamAnswerDraft"),
    service.indexOf("export async function submitTeamAnswer"),
  );
  const submit = service.slice(
    service.indexOf("export async function submitTeamAnswer"),
    service.indexOf("export async function getQuizLiveSnapshotData"),
  );
  const close = service.slice(
    service.indexOf("async function closeRun"),
    service.indexOf("export async function syncInteractionForPresentation"),
  );

  assert.doesNotMatch(saveDraft, /recalculateQuizAnswerEvaluation/);
  assert.doesNotMatch(saveDraft, /bewertung_final: false/);
  assert.match(submit, /recalculateQuizAnswerEvaluation\(draft\.team_antwort_id, tx\)/);
  assert.match(close, /recalculateQuizQuestionEvaluation\(run\.quiz_fragen_id, db\)/);
});

test("block finalization snapshots the latest draft revision for every open question", () => {
  const service = read("app/quiz/interaction/interaction.server.ts");
  const autoFinalize = service.slice(
    service.indexOf("async function autoFinalizeDrafts"),
    service.indexOf("function isPixelInteractionRun"),
  );
  assert.match(
    autoFinalize,
    /submission\.draft_revision === draft\.draft_revision/,
  );
  assert.doesNotMatch(autoFinalize, /finalizedTeams/);
  assert.match(service, /export async function closeBlockInteractions/);
  assert.match(
    service,
    /!isPixelInteractionRun\(run\)[\s\S]*shouldKeepInteractionOpenUntilBlockClose\(run\.interaction_type\)/,
  );
});

test("read-only participant polling uses an uncached route instead of serialized server actions", () => {
  const client = read("app/quiz/[quizId]/antworten/QuizAntwortClient.tsx");
  const moderation = read("app/quiz/[quizId]/moderation/ModerationClient.tsx");
  const route = read("app/api/quiz/live-snapshot/route.ts");
  const service = read("app/quiz/interaction/interaction.server.ts");
  const proxy = read("proxy.ts");
  assert.match(client, /fetchQuizLiveSnapshot/);
  assert.match(client, /fetchQuizAnswerStatus/);
  assert.doesNotMatch(client, /await getQuizLiveSnapshot\(/);
  assert.doesNotMatch(client, /await getQuizAntwortStatusLive\(/);
  assert.match(moderation, /fetchQuizLiveSnapshot/);
  assert.doesNotMatch(moderation, /await getQuizLiveSnapshot\(/);
  assert.match(client, /fetch\("\/api\/quiz\/live-snapshot"/);
  assert.match(route, /getQuizLiveSnapshotData/);
  assert.match(route, /verifyTeamSessionToken/);
  assert.match(route, /includeAnswerStatus/);
  assert.match(service, /blockState:[\s\S]*isReleased:[\s\S]*isClosed:/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.match(proxy, /"\/api\/quiz\/live-snapshot"/);
});
