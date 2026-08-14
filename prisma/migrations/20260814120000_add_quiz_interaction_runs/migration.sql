CREATE TYPE "pubquiz"."QuizInteractionState" AS ENUM (
  'LOCKED', 'OPEN', 'COUNTDOWN', 'CLOSED', 'REVEALED'
);

CREATE TYPE "pubquiz"."TeamAnswerSubmissionStatus" AS ENUM (
  'SUBMITTED', 'AUTO_FINALIZED'
);

CREATE TABLE "pubquiz"."quiz_interaction_runs" (
  "interaction_run_id" SERIAL NOT NULL,
  "quiz_id" INTEGER NOT NULL,
  "quiz_fragen_id" INTEGER,
  "quiz_ablauf_element_id" INTEGER,
  "interaction_type" VARCHAR(32) NOT NULL,
  "state" "pubquiz"."QuizInteractionState" NOT NULL DEFAULT 'LOCKED',
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "opened_at" TIMESTAMP(3),
  "deadline_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "revealed_at" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 0,
  "config_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_interaction_runs_pkey" PRIMARY KEY ("interaction_run_id")
);

ALTER TABLE "pubquiz"."team_antworten"
  ADD COLUMN "interaction_run_id" INTEGER,
  ADD COLUMN "draft_revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "draft_updated_at" TIMESTAMP(3);

CREATE TABLE "pubquiz"."team_answer_submissions" (
  "team_answer_submission_id" SERIAL NOT NULL,
  "interaction_run_id" INTEGER NOT NULL,
  "team_antwort_id" INTEGER NOT NULL,
  "quiz_team_session_id" INTEGER NOT NULL,
  "status" "pubquiz"."TeamAnswerSubmissionStatus" NOT NULL,
  "interaction_type" VARCHAR(32) NOT NULL,
  "payload" JSONB NOT NULL,
  "draft_revision" INTEGER NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalization_reason" VARCHAR(64),
  CONSTRAINT "team_answer_submissions_pkey" PRIMARY KEY ("team_answer_submission_id")
);

CREATE UNIQUE INDEX "uq_quiz_interaction_runs_current"
  ON "pubquiz"."quiz_interaction_runs"("quiz_id")
  WHERE "is_current" = true;
CREATE INDEX "idx_quiz_interaction_runs_quiz_created"
  ON "pubquiz"."quiz_interaction_runs"("quiz_id", "created_at");
CREATE INDEX "idx_quiz_interaction_runs_question"
  ON "pubquiz"."quiz_interaction_runs"("quiz_fragen_id");
CREATE INDEX "idx_team_antworten_interaction_team"
  ON "pubquiz"."team_antworten"("interaction_run_id", "quiz_team_session_id");
CREATE UNIQUE INDEX "uq_team_answer_submission_run_team"
  ON "pubquiz"."team_answer_submissions"("interaction_run_id", "quiz_team_session_id");
CREATE INDEX "idx_team_answer_submissions_answer"
  ON "pubquiz"."team_answer_submissions"("team_antwort_id");
CREATE INDEX "idx_team_answer_submissions_team_time"
  ON "pubquiz"."team_answer_submissions"("quiz_team_session_id", "submitted_at");

ALTER TABLE "pubquiz"."quiz_interaction_runs"
  ADD CONSTRAINT "quiz_interaction_runs_quiz_id_fkey"
  FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."quiz_interaction_runs"
  ADD CONSTRAINT "quiz_interaction_runs_quiz_fragen_id_fkey"
  FOREIGN KEY ("quiz_fragen_id") REFERENCES "pubquiz"."quiz_fragen"("quiz_fragen_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."quiz_interaction_runs"
  ADD CONSTRAINT "quiz_interaction_runs_quiz_ablauf_element_id_fkey"
  FOREIGN KEY ("quiz_ablauf_element_id") REFERENCES "pubquiz"."quiz_ablauf_elemente"("quiz_ablauf_element_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."team_antworten"
  ADD CONSTRAINT "team_antworten_interaction_run_id_fkey"
  FOREIGN KEY ("interaction_run_id") REFERENCES "pubquiz"."quiz_interaction_runs"("interaction_run_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."team_answer_submissions"
  ADD CONSTRAINT "team_answer_submissions_interaction_run_id_fkey"
  FOREIGN KEY ("interaction_run_id") REFERENCES "pubquiz"."quiz_interaction_runs"("interaction_run_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."team_answer_submissions"
  ADD CONSTRAINT "team_answer_submissions_team_antwort_id_fkey"
  FOREIGN KEY ("team_antwort_id") REFERENCES "pubquiz"."team_antworten"("team_antwort_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."team_answer_submissions"
  ADD CONSTRAINT "team_answer_submissions_quiz_team_session_id_fkey"
  FOREIGN KEY ("quiz_team_session_id") REFERENCES "pubquiz"."quiz_team_sessions"("quiz_team_session_id") ON DELETE CASCADE ON UPDATE CASCADE;
