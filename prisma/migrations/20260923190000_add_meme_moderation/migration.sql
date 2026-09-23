CREATE TYPE "pubquiz"."MemeModerationSelectionState" AS ENUM (
  'REVIEWING',
  'COMPLETED',
  'SKIPPED'
);

CREATE TYPE "pubquiz"."MemeModerationReviewStatus" AS ENUM (
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "pubquiz"."meme_moderation_selections" (
  "meme_moderation_selection_id" SERIAL NOT NULL,
  "interaction_run_id" INTEGER NOT NULL,
  "quiz_fragen_id" INTEGER NOT NULL,
  "state" "pubquiz"."MemeModerationSelectionState" NOT NULL DEFAULT 'REVIEWING',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "valid_submission_count" INTEGER NOT NULL,
  "selection_limit" INTEGER,
  "created_by_user_id" INTEGER,
  "finalized_by_user_id" INTEGER,
  "finalized_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "meme_moderation_selections_pkey"
    PRIMARY KEY ("meme_moderation_selection_id")
);

CREATE TABLE "pubquiz"."meme_moderation_candidates" (
  "meme_moderation_candidate_id" SERIAL NOT NULL,
  "meme_moderation_selection_id" INTEGER NOT NULL,
  "team_answer_submission_id" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "review_status" "pubquiz"."MemeModerationReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "review_revision" INTEGER NOT NULL DEFAULT 1,
  "reviewed_by_user_id" INTEGER,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "meme_moderation_candidates_pkey"
    PRIMARY KEY ("meme_moderation_candidate_id")
);

CREATE UNIQUE INDEX "meme_moderation_selections_interaction_run_id_key"
  ON "pubquiz"."meme_moderation_selections"("interaction_run_id");
CREATE INDEX "idx_meme_selection_question_state"
  ON "pubquiz"."meme_moderation_selections"("quiz_fragen_id", "state");
CREATE UNIQUE INDEX "meme_moderation_candidates_team_answer_submission_id_key"
  ON "pubquiz"."meme_moderation_candidates"("team_answer_submission_id");
CREATE UNIQUE INDEX "uq_meme_candidate_selection_position"
  ON "pubquiz"."meme_moderation_candidates"("meme_moderation_selection_id", "position");
CREATE INDEX "idx_meme_candidate_selection_status"
  ON "pubquiz"."meme_moderation_candidates"("meme_moderation_selection_id", "review_status");

ALTER TABLE "pubquiz"."meme_moderation_selections"
  ADD CONSTRAINT "meme_moderation_selections_interaction_run_id_fkey"
  FOREIGN KEY ("interaction_run_id")
  REFERENCES "pubquiz"."quiz_interaction_runs"("interaction_run_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_moderation_selections"
  ADD CONSTRAINT "meme_moderation_selections_quiz_fragen_id_fkey"
  FOREIGN KEY ("quiz_fragen_id")
  REFERENCES "pubquiz"."quiz_fragen"("quiz_fragen_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_moderation_selections"
  ADD CONSTRAINT "meme_moderation_selections_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "pubquiz"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_moderation_selections"
  ADD CONSTRAINT "meme_moderation_selections_finalized_by_user_id_fkey"
  FOREIGN KEY ("finalized_by_user_id") REFERENCES "pubquiz"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."meme_moderation_candidates"
  ADD CONSTRAINT "meme_moderation_candidates_meme_moderation_selection_id_fkey"
  FOREIGN KEY ("meme_moderation_selection_id")
  REFERENCES "pubquiz"."meme_moderation_selections"("meme_moderation_selection_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_moderation_candidates"
  ADD CONSTRAINT "meme_moderation_candidates_team_answer_submission_id_fkey"
  FOREIGN KEY ("team_answer_submission_id")
  REFERENCES "pubquiz"."team_answer_submissions"("team_answer_submission_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_moderation_candidates"
  ADD CONSTRAINT "meme_moderation_candidates_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "pubquiz"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."meme_moderation_selections"
  ADD CONSTRAINT "meme_moderation_selections_counts_check"
  CHECK ("revision" > 0 AND "valid_submission_count" >= 0 AND ("selection_limit" IS NULL OR "selection_limit" > 0));
ALTER TABLE "pubquiz"."meme_moderation_candidates"
  ADD CONSTRAINT "meme_moderation_candidates_position_check"
  CHECK ("position" > 0 AND "review_revision" > 0);
