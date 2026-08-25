-- A team is the global identity. Quiz sessions and quiz assignments reference it.
-- Existing name collisions are intentionally not merged by this migration.

ALTER TABLE "pubquiz"."teams"
  ADD COLUMN "teamname_normalisiert" TEXT,
  ADD COLUMN "ist_archiviert" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "archiviert_am" TIMESTAMP(3),
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "pubquiz"."teams"
SET "teamname_normalisiert" = lower(btrim("teamname"));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "pubquiz"."teams"
    GROUP BY "teamname_normalisiert"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Global team migration stopped: normalized duplicate team names require manual resolution.';
  END IF;
END $$;

ALTER TABLE "pubquiz"."teams"
  ALTER COLUMN "teamname_normalisiert" SET NOT NULL;

CREATE UNIQUE INDEX "teams_teamname_normalisiert_key"
  ON "pubquiz"."teams"("teamname_normalisiert");
CREATE INDEX "idx_teams_status_name"
  ON "pubquiz"."teams"("ist_archiviert", "teamname");

ALTER TABLE "pubquiz"."quiz_team_sessions"
  ADD COLUMN "team_id" INTEGER;

UPDATE "pubquiz"."quiz_team_sessions" AS session
SET "team_id" = team."team_id"
FROM "pubquiz"."teams" AS team
WHERE team."teamname_normalisiert" = lower(btrim(session."teamname"));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "pubquiz"."quiz_team_sessions"
    WHERE "team_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Global team migration stopped: at least one quiz session has no unambiguous global team.';
  END IF;
END $$;

ALTER TABLE "pubquiz"."quiz_team_sessions"
  ALTER COLUMN "team_id" SET NOT NULL;

ALTER TABLE "pubquiz"."quiz_team_sessions"
  ADD CONSTRAINT "quiz_team_sessions_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "pubquiz"."teams"("team_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "uq_quiz_team_session_team"
  ON "pubquiz"."quiz_team_sessions"("quiz_id", "team_id");
CREATE INDEX "idx_quiz_team_sessions_team_activity"
  ON "pubquiz"."quiz_team_sessions"("team_id", "erstellt_am");

INSERT INTO "pubquiz"."quiz_teams" ("quiz_id", "team_id")
SELECT DISTINCT "quiz_id", "team_id"
FROM "pubquiz"."quiz_team_sessions"
ON CONFLICT ("quiz_id", "team_id") DO NOTHING;
