ALTER TABLE "pubquiz"."team_answer_submissions"
  ADD COLUMN "submission_version" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "pubquiz"."uq_team_answer_submission_run_team";

CREATE UNIQUE INDEX "uq_team_answer_submission_run_team_version"
  ON "pubquiz"."team_answer_submissions"(
    "interaction_run_id",
    "quiz_team_session_id",
    "submission_version"
  );

CREATE UNIQUE INDEX "uq_team_answer_submission_run_team_draft"
  ON "pubquiz"."team_answer_submissions"(
    "interaction_run_id",
    "quiz_team_session_id",
    "draft_revision"
  );

CREATE INDEX "idx_team_answer_submissions_run_team_time"
  ON "pubquiz"."team_answer_submissions"(
    "interaction_run_id",
    "quiz_team_session_id",
    "submitted_at"
  );
