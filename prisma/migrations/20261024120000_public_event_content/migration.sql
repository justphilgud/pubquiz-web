-- Additive only: existing values and inherited series logos remain unchanged.
ALTER TABLE "pubquiz"."eventreihen" ADD COLUMN "reservierungs_url" VARCHAR(2048);
ALTER TABLE "pubquiz"."quiz"
  ADD COLUMN "reservierungs_url" VARCHAR(2048),
  ADD COLUMN "veranstaltungsbild_url" VARCHAR(2048),
  ADD COLUMN "oeffentliche_beschreibung" VARCHAR(2000),
  ADD COLUMN "oeffentliche_beschreibung_modus" VARCHAR(16) NOT NULL DEFAULT 'APPEND';
ALTER TABLE "pubquiz"."quiz" ADD CONSTRAINT "quiz_public_description_mode_check"
  CHECK ("oeffentliche_beschreibung_modus" IN ('APPEND', 'REPLACE'));
