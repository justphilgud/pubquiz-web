ALTER TABLE "pubquiz"."team_antworten" ADD COLUMN "pixel_stage_history" JSONB;
ALTER TABLE "pubquiz"."quiz_interaction_runs" ADD COLUMN "pixel_completed_stages" INTEGER NOT NULL DEFAULT 0;
