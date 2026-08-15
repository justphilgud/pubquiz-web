import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("live actions share the canonical Prisma client with access and interaction services", () => {
  const actions = read("app/quiz/actions.ts");
  const access = read("app/quiz/quizAccess.server.ts");
  const interaction = read("app/quiz/interaction/interaction.server.ts");

  assert.match(actions, /from "@\/app\/lib\/prisma"/);
  assert.match(access, /from "@\/app\/lib\/prisma"/);
  assert.match(interaction, /from "@\/app\/lib\/prisma"/);
  assert.doesNotMatch(actions, /from "@\/lib\/prisma"/);
});

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
  const controllerRoute = read("app/api/quiz/live-snapshot/route.ts");
  const participantRoute = read("app/api/quiz/team-live-snapshot/route.ts");
  const participantSession = read("app/quiz/participantSession.server.ts");
  const service = read("app/quiz/interaction/interaction.server.ts");
  const proxy = read("proxy.ts");
  assert.match(client, /fetchQuizLiveSnapshot/);
  assert.match(client, /fetchQuizAnswerStatus/);
  assert.doesNotMatch(client, /await getQuizLiveSnapshot\(/);
  assert.doesNotMatch(client, /await getQuizAntwortStatusLive\(/);
  assert.match(moderation, /fetchQuizLiveSnapshot/);
  assert.doesNotMatch(moderation, /await getQuizLiveSnapshot\(/);
  assert.match(client, /fetch\("\/api\/quiz\/team-live-snapshot"/);
  assert.match(controllerRoute, /await auth\(\)/);
  assert.match(controllerRoute, /getQuizLiveSnapshotData\(quizId, null\)/);
  assert.match(participantRoute, /resolveParticipantSession/);
  assert.match(participantRoute, /INVALID_SESSION/);
  assert.match(participantRoute, /includeAnswerStatus/);
  assert.match(participantSession, /quiz_team_sessions\.findFirst/);
  assert.match(participantSession, /quiz_team_session_id: payload\.sessionId/);
  assert.match(participantSession, /quiz_id: quizId/);
  assert.match(service, /blockState:[\s\S]*isReleased:[\s\S]*isClosed:/);
  assert.match(participantRoute, /"Cache-Control": "no-store"/);
  assert.match(proxy, /"\/api\/quiz\/team-live-snapshot"/);
  assert.doesNotMatch(proxy, /"\/api\/quiz\/live-snapshot"/);
});

test("full participant refresh does not hydrate the complete run history", () => {
  const actions = read("app/quiz/actions.ts");
  const participantStatus = actions.slice(
    actions.indexOf("export async function getQuizAntwortStatus"),
    actions.indexOf("export async function searchTeamsForAntworten"),
  );
  const participantRoute = read("app/api/quiz/team-live-snapshot/route.ts");

  assert.doesNotMatch(participantStatus, /interaction_runs:\s*\{/);
  assert.match(participantStatus, /quiz_interaction_runs\.findMany/);
  assert.match(participantStatus, /\{ is_current: true \}/);
  assert.match(
    participantStatus,
    /opened_at: \{ gte: offenerBlockFreigabe\.freigegeben_ab \}/,
  );
  assert.ok(
    participantRoute.indexOf("includeAnswerStatus === true") <
      participantRoute.indexOf("resolveParticipantSession(quizId, token)"),
  );
});

test("a stale presentation slide cannot reopen a manually locked block", () => {
  const service = read("app/quiz/interaction/interaction.server.ts");
  const sync = service.slice(
    service.indexOf("export async function syncInteractionForPresentation"),
    service.indexOf("export async function closeCurrentInteraction"),
  );
  assert.match(sync, /isQuizQuestionBlockOpen\(blockRelease\)/);
  assert.match(sync, /reason: "BLOCK_LOCKED"/);
  assert.ok(
    sync.indexOf("isQuizQuestionBlockOpen(blockRelease)") <
      sync.indexOf("quiz_interaction_runs.create"),
  );
  assert.match(
    sync,
    /currentRun\?\.quiz_fragen_id === identity\.questionAssignmentId &&[\s\S]*currentRun\.state === "OPEN"[\s\S]*currentRun\.state === "COUNTDOWN"/,
  );
});

test("a conscious block reopen resynchronizes the current question", () => {
  const actions = read("app/quiz/actions.ts");
  const reopen = actions.slice(
    actions.indexOf("export async function freigabeQuizBlock"),
    actions.indexOf("export async function schliesseQuizBlock"),
  );

  assert.match(reopen, /prisma\.\$transaction/);
  assert.match(reopen, /quiz_praesentation_status\.findUnique/);
  assert.match(reopen, /syncInteractionForPresentation/);
  assert.match(reopen, /knownOpenQuizSectionId: data\.quizAbschnittId/);
  assert.match(
    reopen,
    /aktuelle_quiz_fragen_id: interactionRun\.quiz_fragen_id/,
  );
});

test("live block mutations avoid redundant work without changing finalization rules", () => {
  const actions = read("app/quiz/actions.ts");
  const service = read("app/quiz/interaction/interaction.server.ts");
  const closeRun = service.slice(
    service.indexOf("async function closeRun"),
    service.indexOf("export async function syncInteractionForPresentation"),
  );

  assert.match(
    actions.slice(
      actions.indexOf("export async function freigabeQuizBlock"),
      actions.indexOf("export async function setAktuelleQuizFrage"),
    ),
    /Promise\.all\(\[[\s\S]*requireQuizLiveController[\s\S]*requireQuizQuestionSection/,
  );
  assert.match(service, /knownOpenQuizSectionId\?: number/);
  assert.match(service, /if \(drafts\.length === 0\) return 0/);
  assert.match(closeRun, /finalizedDrafts > 0/);
  assert.match(closeRun, /recalculateQuizQuestionEvaluation/);
  assert.match(
    service,
    /previousRun\?\.config_snapshot \?\?[\s\S]*buildInteractionConfigSnapshot/,
  );

  const closeBlock = actions.slice(
    actions.indexOf("export async function schliesseQuizBlock"),
    actions.indexOf("export async function setAktuelleQuizFrage"),
  );
  assert.ok(
    closeBlock.indexOf("prisma.quiz_block_freigaben.upsert") <
      closeBlock.indexOf("closeBlockInteractions"),
  );
});
