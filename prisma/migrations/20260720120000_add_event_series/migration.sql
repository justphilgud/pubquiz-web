CREATE TABLE "pubquiz"."eventreihen" (
    "eventreihe_id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "oeffentlicher_name" VARCHAR(150),
    "beschreibung" VARCHAR(2000),
    "interne_bemerkung" VARCHAR(2000),
    "ist_oeffentlich" BOOLEAN NOT NULL DEFAULT false,
    "ist_archiviert" BOOLEAN NOT NULL DEFAULT false,
    "archiviert_am" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventreihen_pkey" PRIMARY KEY ("eventreihe_id")
);

CREATE UNIQUE INDEX "eventreihen_slug_key"
ON "pubquiz"."eventreihen"("slug");

CREATE UNIQUE INDEX "uq_eventreihen_name_ci"
ON "pubquiz"."eventreihen"(LOWER("name"));

CREATE INDEX "idx_eventreihen_status_name"
ON "pubquiz"."eventreihen"("ist_archiviert", "name");

INSERT INTO "pubquiz"."eventreihen" (
    "name",
    "slug",
    "ist_oeffentlich",
    "ist_archiviert"
)
VALUES ('Bestandsquizze', 'bestandsquizze', false, false);

ALTER TABLE "pubquiz"."quiz"
ADD COLUMN "eventreihe_id" INTEGER,
ADD COLUMN "veranstaltungszeit" VARCHAR(5),
ADD COLUMN "veranstaltungsname" VARCHAR(200),
ADD COLUMN "karten_url" VARCHAR(2048),
ADD COLUMN "oeffentliche_url" VARCHAR(2048);

UPDATE "pubquiz"."quiz"
SET "eventreihe_id" = (
    SELECT "eventreihe_id"
    FROM "pubquiz"."eventreihen"
    WHERE "slug" = 'bestandsquizze'
);

ALTER TABLE "pubquiz"."quiz"
ALTER COLUMN "eventreihe_id" SET NOT NULL;

CREATE INDEX "idx_quiz_eventreihe_id"
ON "pubquiz"."quiz"("eventreihe_id");

ALTER TABLE "pubquiz"."quiz"
ADD CONSTRAINT "quiz_eventreihe_id_fkey"
FOREIGN KEY ("eventreihe_id")
REFERENCES "pubquiz"."eventreihen"("eventreihe_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- quiz_datum bleibt in Paket 1 absichtlich nullable. Neue und fachlich neu
-- gespeicherte Quizze werden in der Anwendung zwingend validiert. Eine
-- separate Folgemigration setzt NOT NULL erst nach manueller Bestandspflege.
