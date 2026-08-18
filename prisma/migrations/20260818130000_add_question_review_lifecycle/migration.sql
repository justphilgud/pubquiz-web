ALTER TABLE "pubquiz"."fragen"
  ADD COLUMN "pruefen_ab" DATE,
  ADD COLUMN "aktualitaet_geprueft_am" TIMESTAMP(3),
  ADD COLUMN "aktualitaet_geprueft_von_user_id" INTEGER;

ALTER TABLE "pubquiz"."fragen"
  ADD CONSTRAINT "fragen_aktualitaet_geprueft_von_user_id_fkey"
  FOREIGN KEY ("aktualitaet_geprueft_von_user_id")
  REFERENCES "pubquiz"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."fragen"
  ADD CONSTRAINT "chk_fragen_ein_lebenszyklusdatum"
  CHECK ("gueltig_bis" IS NULL OR "pruefen_ab" IS NULL);

CREATE INDEX "idx_fragen_gueltig_bis"
  ON "pubquiz"."fragen"("gueltig_bis", "ist_archiviert");

CREATE INDEX "idx_fragen_pruefen_ab"
  ON "pubquiz"."fragen"("pruefen_ab", "ist_archiviert");
