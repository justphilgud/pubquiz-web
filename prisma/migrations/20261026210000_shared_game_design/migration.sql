ALTER TABLE "pubquiz"."eventreihen" ADD COLUMN "shared_design_template_id" VARCHAR(64);
ALTER TABLE "pubquiz"."game_drafts" ADD COLUMN "shared_design_template_id" VARCHAR(64);
ALTER TABLE "pubquiz"."quiz" ADD COLUMN "shared_design_template_id" VARCHAR(64), ADD COLUMN "shared_design_snapshot" JSONB;
