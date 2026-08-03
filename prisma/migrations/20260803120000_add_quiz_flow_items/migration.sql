-- CreateTable
CREATE TABLE "pubquiz"."quiz_ablauf_elemente" (
    "quiz_ablauf_element_id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "typ" VARCHAR(40) NOT NULL,
    "anker_typ" VARCHAR(24) NOT NULL,
    "anker_schluessel" VARCHAR(64) NOT NULL,
    "quiz_abschnitt_id" INTEGER,
    "sortierung" INTEGER NOT NULL,
    "ist_sichtbar" BOOLEAN NOT NULL DEFAULT true,
    "bezeichnung" VARCHAR(160),
    "konfiguration" JSONB NOT NULL,
    "ist_standard" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_ablauf_elemente_pkey" PRIMARY KEY ("quiz_ablauf_element_id")
);

-- AlterTable
ALTER TABLE "pubquiz"."quiz_praesentation_status"
ADD COLUMN "slide_key" VARCHAR(160);

-- CreateIndex
CREATE UNIQUE INDEX "uq_quiz_ablauf_slot_sortierung"
ON "pubquiz"."quiz_ablauf_elemente"("quiz_id", "anker_typ", "anker_schluessel", "sortierung");

-- CreateIndex
CREATE INDEX "idx_quiz_ablauf_anchor"
ON "pubquiz"."quiz_ablauf_elemente"("quiz_id", "anker_typ", "anker_schluessel");

-- CreateIndex
CREATE INDEX "idx_quiz_ablauf_abschnitt"
ON "pubquiz"."quiz_ablauf_elemente"("quiz_abschnitt_id");

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_ablauf_elemente"
ADD CONSTRAINT "quiz_ablauf_elemente_quiz_id_fkey"
FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_ablauf_elemente"
ADD CONSTRAINT "quiz_ablauf_elemente_quiz_abschnitt_id_fkey"
FOREIGN KEY ("quiz_abschnitt_id") REFERENCES "pubquiz"."quiz_abschnitte"("quiz_abschnitt_id") ON DELETE CASCADE ON UPDATE CASCADE;
