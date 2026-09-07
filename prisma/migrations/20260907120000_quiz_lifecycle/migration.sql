-- Additive only. Existing started quizzes retain their live position.
ALTER TABLE "pubquiz"."quiz_praesentation_status"
  ADD COLUMN "quiz_stopped_at" TIMESTAMP(3),
  ADD COLUMN "lifecycle_revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pubquiz"."quiz_interaction_runs"
  ADD COLUMN "is_hidden" BOOLEAN NOT NULL DEFAULT false;
