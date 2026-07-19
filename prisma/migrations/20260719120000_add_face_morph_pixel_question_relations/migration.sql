CREATE TABLE "pubquiz"."fragen_relationen" (
    "fragen_relation_id" SERIAL NOT NULL,
    "quell_fragen_id" INTEGER NOT NULL,
    "ziel_fragen_id" INTEGER NOT NULL,
    "antwort_position" INTEGER NOT NULL,
    "typ" VARCHAR(80) NOT NULL,
    "ist_aktiv" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fragen_relationen_pkey" PRIMARY KEY ("fragen_relation_id"),
    CONSTRAINT "chk_fragen_relation_antwort_position" CHECK ("antwort_position" IN (1, 2)),
    CONSTRAINT "chk_fragen_relation_typ" CHECK ("typ" = 'facemorph_pixel'),
    CONSTRAINT "chk_fragen_relation_unterschiedliche_fragen" CHECK ("quell_fragen_id" <> "ziel_fragen_id")
);

CREATE UNIQUE INDEX "uq_fragen_relation_quelle_typ_position" ON "pubquiz"."fragen_relationen"("quell_fragen_id", "typ", "antwort_position");
CREATE UNIQUE INDEX "uq_fragen_relation_ziel_typ" ON "pubquiz"."fragen_relationen"("ziel_fragen_id", "typ");
CREATE INDEX "idx_fragen_relation_quelle_aktiv" ON "pubquiz"."fragen_relationen"("quell_fragen_id", "ist_aktiv");
CREATE INDEX "idx_fragen_relation_ziel_aktiv" ON "pubquiz"."fragen_relationen"("ziel_fragen_id", "ist_aktiv");

ALTER TABLE "pubquiz"."fragen_relationen" ADD CONSTRAINT "fk_fragen_relation_quelle" FOREIGN KEY ("quell_fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "pubquiz"."fragen_relationen" ADD CONSTRAINT "fk_fragen_relation_ziel" FOREIGN KEY ("ziel_fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE CASCADE ON UPDATE NO ACTION;
