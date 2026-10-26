CREATE TABLE "pubquiz"."game_team_assignments" (
  "id" UUID NOT NULL,
  "game_id" UUID NOT NULL,
  "team_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_team_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_team_assignments_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "pubquiz"."game_drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "game_team_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "pubquiz"."teams"("team_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_game_team_assignments" ON "pubquiz"."game_team_assignments"("game_id", "team_id");
CREATE INDEX "idx_game_team_assignments_team" ON "pubquiz"."game_team_assignments"("team_id");
