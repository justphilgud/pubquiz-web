-- Additive only: no Quiz rows, states, identifiers or existing columns touched.
CREATE TABLE "pubquiz"."game_drafts" (
  "id" UUID NOT NULL,
  "eventart" VARCHAR(64) NOT NULL,
  "eventreihe_id" INTEGER NOT NULL,
  "titel" VARCHAR(150) NOT NULL,
  "datum" DATE,
  "uhrzeit" VARCHAR(5),
  "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "game_drafts_type_check" CHECK ("eventart" IN ('BINGO','POWERPOINT_KARAOKE')),
  CONSTRAINT "game_drafts_status_check" CHECK ("status" = 'DRAFT'),
  CONSTRAINT "game_drafts_title_check" CHECK (length(btrim("titel")) BETWEEN 1 AND 150),
  CONSTRAINT "game_drafts_time_check" CHECK ("uhrzeit" IS NULL OR ("datum" IS NOT NULL AND "uhrzeit" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')),
  CONSTRAINT "game_drafts_eventreihe_id_fkey" FOREIGN KEY ("eventreihe_id") REFERENCES "pubquiz"."eventreihen"("eventreihe_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "idx_game_drafts_type_series_updated" ON "pubquiz"."game_drafts"("eventart", "eventreihe_id", "updated_at");
