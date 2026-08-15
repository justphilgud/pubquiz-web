ALTER TABLE "pubquiz"."quiz_interaction_runs"
ADD COLUMN "stopped_by_team_session_id" INTEGER,
ADD COLUMN "stopped_at" TIMESTAMP(3),
ADD COLUMN "stopped_at_stage" INTEGER;

ALTER TABLE "pubquiz"."quiz_interaction_runs"
ADD CONSTRAINT "quiz_interaction_runs_stopped_by_team_session_id_fkey"
FOREIGN KEY ("stopped_by_team_session_id")
REFERENCES "pubquiz"."quiz_team_sessions"("quiz_team_session_id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."quiz_interaction_runs"
ADD CONSTRAINT "quiz_interaction_runs_stopped_at_stage_check"
CHECK ("stopped_at_stage" IS NULL OR "stopped_at_stage" IN (1, 2));

CREATE INDEX "idx_quiz_interaction_runs_pixel_stopper"
ON "pubquiz"."quiz_interaction_runs"("stopped_by_team_session_id");
