CREATE TYPE "pubquiz"."EventSeriesRole" AS ENUM ('EVENT_MANAGER', 'EDITOR');
CREATE TYPE "pubquiz"."QuestionScope" AS ENUM ('GLOBAL', 'EVENT_SERIES');

ALTER TABLE "pubquiz"."fragen"
ADD COLUMN "geltungsbereich" "pubquiz"."QuestionScope" NOT NULL DEFAULT 'GLOBAL';

CREATE TABLE "pubquiz"."eventreihe_benutzerrollen" (
    "eventreihe_benutzerrolle_id" SERIAL NOT NULL,
    "eventreihe_id" INTEGER NOT NULL,
    "benutzer_id" INTEGER NOT NULL,
    "rolle" "pubquiz"."EventSeriesRole" NOT NULL,
    "zugewiesen_von_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eventreihe_benutzerrollen_pkey" PRIMARY KEY ("eventreihe_benutzerrolle_id"),
    CONSTRAINT "eventreihe_benutzerrollen_eventreihe_id_fkey" FOREIGN KEY ("eventreihe_id") REFERENCES "pubquiz"."eventreihen"("eventreihe_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "eventreihe_benutzerrollen_benutzer_id_fkey" FOREIGN KEY ("benutzer_id") REFERENCES "pubquiz"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "eventreihe_benutzerrollen_zugewiesen_von_user_id_fkey" FOREIGN KEY ("zugewiesen_von_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_eventreihe_benutzerrolle_benutzer_eventreihe"
ON "pubquiz"."eventreihe_benutzerrollen"("benutzer_id", "eventreihe_id");
CREATE INDEX "idx_eventreihe_benutzerrollen_benutzer"
ON "pubquiz"."eventreihe_benutzerrollen"("benutzer_id");
CREATE INDEX "idx_eventreihe_benutzerrollen_eventreihe"
ON "pubquiz"."eventreihe_benutzerrollen"("eventreihe_id");

CREATE TABLE "pubquiz"."fragen_eventreihen" (
    "fragen_eventreihe_id" SERIAL NOT NULL,
    "fragen_id" INTEGER NOT NULL,
    "eventreihe_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fragen_eventreihen_pkey" PRIMARY KEY ("fragen_eventreihe_id"),
    CONSTRAINT "fragen_eventreihen_fragen_id_fkey" FOREIGN KEY ("fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fragen_eventreihen_eventreihe_id_fkey" FOREIGN KEY ("eventreihe_id") REFERENCES "pubquiz"."eventreihen"("eventreihe_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_fragen_eventreihen_frage_eventreihe"
ON "pubquiz"."fragen_eventreihen"("fragen_id", "eventreihe_id");
CREATE INDEX "idx_fragen_eventreihen_frage"
ON "pubquiz"."fragen_eventreihen"("fragen_id");
CREATE INDEX "idx_fragen_eventreihen_eventreihe"
ON "pubquiz"."fragen_eventreihen"("eventreihe_id");
