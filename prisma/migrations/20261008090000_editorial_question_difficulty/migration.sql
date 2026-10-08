-- Additive only: no backfill and no changes to player-result difficulty.
ALTER TABLE "pubquiz"."fragen"
  ADD COLUMN "redaktionelle_schwierigkeit" VARCHAR(10);
ALTER TABLE "pubquiz"."fragen"
  ADD CONSTRAINT "fragen_editorial_difficulty_check"
  CHECK ("redaktionelle_schwierigkeit" IN ('LEICHT', 'MITTEL', 'SCHWER')) NOT VALID;
ALTER TABLE "pubquiz"."fragen"
  VALIDATE CONSTRAINT "fragen_editorial_difficulty_check";
