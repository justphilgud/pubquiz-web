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

test("presentation drives interaction lifecycle while legacy block release is compatibility only", () => {
  const statusActions = read(
    "app/quiz/[quizId]/praesentation/statusActions.ts",
  );
  const actions = read("app/quiz/actions.ts");
  assert.match(statusActions, /syncInteractionForPresentation/);
  assert.match(actions, /closeCurrentInteraction/);
  assert.match(actions, /getQuizLiveSnapshot/);
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
