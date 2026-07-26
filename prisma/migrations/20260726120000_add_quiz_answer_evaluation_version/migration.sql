ALTER TABLE "pubquiz"."team_antworten"
ADD COLUMN "bewertungs_version" INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN "pubquiz"."team_antworten"."bewertungs_version" IS
  '0 marks evaluation data that predates the reproducible central evaluation lifecycle.';
