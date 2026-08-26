CREATE TYPE "pubquiz"."QuizResultDisplayMode" AS ENUM ('STANDARD', 'LIVE');

ALTER TABLE "pubquiz"."quiz_fragen"
  ADD COLUMN "ergebnisdarstellung" "pubquiz"."QuizResultDisplayMode" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "pubquiz"."quiz_interaction_runs"
  ADD COLUMN "live_results_visible" BOOLEAN NOT NULL DEFAULT false;
