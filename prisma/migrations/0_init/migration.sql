-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pubquiz";

-- CreateEnum
CREATE TYPE "pubquiz"."UserRole" AS ENUM ('ADMIN', 'EDITOR');

-- CreateTable
CREATE TABLE "pubquiz"."antworten" (
    "antwort_id" SERIAL NOT NULL,
    "fragen_id" INTEGER NOT NULL,
    "antwort" TEXT NOT NULL,
    "ist_richtig" BOOLEAN NOT NULL DEFAULT false,
    "antworttyp_id" INTEGER NOT NULL,
    "zusatzinformation" TEXT,

    CONSTRAINT "antworten_pkey" PRIMARY KEY ("antwort_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."antworttyp" (
    "antworttyp_id" SERIAL NOT NULL,
    "antworttyp" TEXT NOT NULL,

    CONSTRAINT "antworttyp_pkey" PRIMARY KEY ("antworttyp_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."frage_antwortfeld_loesungen" (
    "loesung_id" SERIAL NOT NULL,
    "antwortfeld_id" INTEGER NOT NULL,
    "loesung_text" TEXT NOT NULL,
    "sortierung" INTEGER NOT NULL,
    "ist_akzeptiert" BOOLEAN NOT NULL DEFAULT true,
    "zusatzinformation" TEXT,

    CONSTRAINT "frage_antwortfeld_loesungen_pkey" PRIMARY KEY ("loesung_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."frage_antwortfelder" (
    "antwortfeld_id" SERIAL NOT NULL,
    "fragen_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sortierung" INTEGER NOT NULL,
    "ist_pflicht" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "frage_antwortfelder_pkey" PRIMARY KEY ("antwortfeld_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."frage_vorlage_antwortfelder" (
    "vorlage_antwortfeld_id" SERIAL NOT NULL,
    "vorlage_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sortierung" INTEGER NOT NULL,
    "ist_pflicht" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "frage_vorlage_antwortfelder_pkey" PRIMARY KEY ("vorlage_antwortfeld_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."frage_vorlagen" (
    "vorlage_id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slide_typ" TEXT NOT NULL,
    "ist_aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "frage_vorlagen_pkey" PRIMARY KEY ("vorlage_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."fragen" (
    "fragen_id" SERIAL NOT NULL,
    "frage" TEXT NOT NULL,
    "quelle" TEXT,
    "fragentyp" TEXT,
    "schwierigkeitslevel" DECIMAL(5,2),
    "erstellungsdatum" DATE NOT NULL DEFAULT CURRENT_DATE,
    "ist_archiviert" BOOLEAN NOT NULL DEFAULT false,
    "archivierungsgrund" TEXT,
    "vorlage_id" INTEGER,
    "freigegeben" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" INTEGER,
    "last_modified_by_user_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ist_unfertig" BOOLEAN NOT NULL DEFAULT false,
    "moderationsnotizen" TEXT,
    "gueltig_bis" DATE,

    CONSTRAINT "fragen_pkey" PRIMARY KEY ("fragen_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."fragen_kategorien" (
    "fragen_kategorie_zuordnung_id" SERIAL NOT NULL,
    "fragen_id" INTEGER NOT NULL,
    "fragenkategorie_id" INTEGER NOT NULL,

    CONSTRAINT "fragen_kategorien_pkey" PRIMARY KEY ("fragen_kategorie_zuordnung_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."fragenkategorie" (
    "fragenkategorie_id" SERIAL NOT NULL,
    "kategorie" TEXT NOT NULL,

    CONSTRAINT "fragenkategorie_pkey" PRIMARY KEY ("fragenkategorie_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."medien" (
    "medien_id" SERIAL NOT NULL,
    "fragen_id" INTEGER,
    "antwort_id" INTEGER,
    "medientyp_id" INTEGER NOT NULL,
    "datei" TEXT NOT NULL,
    "sortierung" INTEGER NOT NULL DEFAULT 1,
    "bemerkung" TEXT,
    "antwortfeld_id" INTEGER,

    CONSTRAINT "medien_pkey" PRIMARY KEY ("medien_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."medientyp" (
    "medientyp_id" SERIAL NOT NULL,
    "medientyp" TEXT NOT NULL,

    CONSTRAINT "medientyp_pkey" PRIMARY KEY ("medientyp_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."quiz" (
    "quiz_id" SERIAL NOT NULL,
    "quiz_datum" DATE,
    "titel" TEXT,
    "team_anzahl" INTEGER,
    "teilnehmer_anzahl" INTEGER,
    "bemerkung" TEXT,
    "ist_archiviert" BOOLEAN NOT NULL DEFAULT false,
    "archivierungsgrund" TEXT,
    "intro_begruessungstext" TEXT,
    "intro_begruessungstitel" TEXT,
    "intro_logo_url" TEXT,
    "intro_musik_url" TEXT,
    "intro_preise" TEXT,
    "intro_regeln" TEXT,
    "intro_wartetext" TEXT,
    "intro_startsequenz_text" TEXT,
    "intro_startzeit" TEXT,
    "intro_video_url" TEXT,
    "outro_bekanntmachungen" TEXT,
    "manuelle_bewertungen" INTEGER DEFAULT 0,

    CONSTRAINT "quiz_pkey" PRIMARY KEY ("quiz_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."quiz_abschnitte" (
    "quiz_abschnitt_id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "titel" TEXT NOT NULL,
    "abschnitt_typ" TEXT NOT NULL,
    "sortierung" INTEGER NOT NULL,
    "dauer_sekunden" INTEGER,
    "qr_code_url" TEXT,
    "medien_datei" TEXT,
    "bemerkung" TEXT,

    CONSTRAINT "quiz_abschnitte_pkey" PRIMARY KEY ("quiz_abschnitt_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."quiz_block_freigaben" (
    "quiz_block_freigabe_id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "quiz_abschnitt_id" INTEGER NOT NULL,
    "ist_freigegeben" BOOLEAN NOT NULL DEFAULT false,
    "ist_geschlossen" BOOLEAN NOT NULL DEFAULT false,
    "freigegeben_ab" TIMESTAMP(3),
    "geschlossen_ab" TIMESTAMP(3),
    "aktuelle_quiz_fragen_id" INTEGER,

    CONSTRAINT "quiz_block_freigaben_pkey" PRIMARY KEY ("quiz_block_freigabe_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."quiz_fragen" (
    "quiz_fragen_id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "fragen_id" INTEGER NOT NULL,
    "sortierung" INTEGER,
    "richtigeantworten" INTEGER DEFAULT 0,
    "falscheantworten" INTEGER DEFAULT 0,
    "antwort_reihenfolge" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "praesentationslayout" TEXT DEFAULT 'standard',
    "quiz_abschnitt_id" INTEGER,
    "punkte_basis" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "punkte_modus" TEXT NOT NULL DEFAULT 'standard',
    "praesentationsdauer_messungen" INTEGER DEFAULT 0,
    "praesentationsdauer_sekunden" INTEGER,

    CONSTRAINT "quiz_fragen_pkey" PRIMARY KEY ("quiz_fragen_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."quiz_praesentation_status" (
    "quiz_id" INTEGER NOT NULL,
    "slide_index" INTEGER NOT NULL DEFAULT 0,
    "slide_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quiz_started_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "audio_aktion" TEXT,
    "audio_aktion_id" INTEGER NOT NULL DEFAULT 0,
    "countdown_dauer_sekunden" INTEGER,
    "countdown_ended_at" TIMESTAMP(3),
    "countdown_started_at" TIMESTAMP(3),
    "countdown_status" TEXT,
    "medium_overlay_aktiv" BOOLEAN NOT NULL DEFAULT false,
    "endstand_reveal_count" INTEGER NOT NULL DEFAULT 0,
    "show_schaetzfrage" BOOLEAN NOT NULL DEFAULT false,
    "zeige_schaetzantwort" BOOLEAN NOT NULL DEFAULT false,
    "schaetzfrage_id" INTEGER,

    CONSTRAINT "quiz_praesentation_status_pkey" PRIMARY KEY ("quiz_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."quiz_team_sessions" (
    "quiz_team_session_id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "teamname" TEXT NOT NULL,
    "erstellt_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spieler_anzahl" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "quiz_team_sessions_pkey" PRIMARY KEY ("quiz_team_session_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."quiz_teams" (
    "quiz_team_id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "punkte" DECIMAL(6,2),
    "platzierung" INTEGER,

    CONSTRAINT "quiz_teams_pkey" PRIMARY KEY ("quiz_team_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."team_antworten" (
    "team_antwort_id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "quiz_abschnitt_id" INTEGER NOT NULL,
    "quiz_fragen_id" INTEGER NOT NULL,
    "quiz_team_session_id" INTEGER NOT NULL,
    "antwort_text" TEXT,
    "antwort_id" INTEGER,
    "aktualisiert_am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bewertete_antwort" TEXT,
    "bewertung_final" BOOLEAN NOT NULL DEFAULT false,
    "ist_manuell_falsch" BOOLEAN NOT NULL DEFAULT false,
    "ist_manuell_richtig" BOOLEAN NOT NULL DEFAULT false,
    "ist_skurril" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "team_antworten_pkey" PRIMARY KEY ("team_antwort_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."team_antwortfelder" (
    "team_antwortfeld_id" SERIAL NOT NULL,
    "team_antwort_id" INTEGER NOT NULL,
    "antwortfeld_id" INTEGER NOT NULL,
    "antwort_text" TEXT,

    CONSTRAINT "team_antwortfelder_pkey" PRIMARY KEY ("team_antwortfeld_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."teams" (
    "team_id" SERIAL NOT NULL,
    "teamname" TEXT NOT NULL,
    "team_passwort" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("team_id")
);

-- CreateTable
CREATE TABLE "pubquiz"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "pubquiz"."UserRole" NOT NULL DEFAULT 'EDITOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_antworten_fragen_id" ON "pubquiz"."antworten"("fragen_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "antworttyp_antworttyp_key" ON "pubquiz"."antworttyp"("antworttyp" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "frage_vorlagen_code_key" ON "pubquiz"."frage_vorlagen"("code" ASC);

-- CreateIndex
CREATE INDEX "idx_fragen_kategorien_fragen_id" ON "pubquiz"."fragen_kategorien"("fragen_id" ASC);

-- CreateIndex
CREATE INDEX "idx_fragen_kategorien_kategorie_id" ON "pubquiz"."fragen_kategorien"("fragenkategorie_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_fragen_kategorien" ON "pubquiz"."fragen_kategorien"("fragen_id" ASC, "fragenkategorie_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "fragenkategorie_kategorie_key" ON "pubquiz"."fragenkategorie"("kategorie" ASC);

-- CreateIndex
CREATE INDEX "idx_medien_antwort_id" ON "pubquiz"."medien"("antwort_id" ASC);

-- CreateIndex
CREATE INDEX "idx_medien_antwortfeld_id" ON "pubquiz"."medien"("antwortfeld_id" ASC);

-- CreateIndex
CREATE INDEX "idx_medien_fragen_id" ON "pubquiz"."medien"("fragen_id" ASC);

-- CreateIndex
CREATE INDEX "idx_medien_sortierung_antwort" ON "pubquiz"."medien"("antwort_id" ASC, "sortierung" ASC) WHERE (antwort_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_medien_sortierung_antwortfeld" ON "pubquiz"."medien"("antwortfeld_id" ASC, "sortierung" ASC) WHERE (antwortfeld_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_medien_sortierung_frage" ON "pubquiz"."medien"("fragen_id" ASC, "sortierung" ASC) WHERE (fragen_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "medientyp_medientyp_key" ON "pubquiz"."medientyp"("medientyp" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_quiz_block_freigabe" ON "pubquiz"."quiz_block_freigaben"("quiz_id" ASC, "quiz_abschnitt_id" ASC);

-- CreateIndex
CREATE INDEX "idx_quiz_fragen_quiz_id" ON "pubquiz"."quiz_fragen"("quiz_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_quiz_fragen" ON "pubquiz"."quiz_fragen"("quiz_id" ASC, "fragen_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_quiz_fragen_sortierung" ON "pubquiz"."quiz_fragen"("quiz_id" ASC, "sortierung" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_quiz_team_session_teamname" ON "pubquiz"."quiz_team_sessions"("quiz_id" ASC, "teamname" ASC);

-- CreateIndex
CREATE INDEX "idx_quiz_teams_quiz_id" ON "pubquiz"."quiz_teams"("quiz_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_quiz_teams" ON "pubquiz"."quiz_teams"("quiz_id" ASC, "team_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_antwort_pro_frage" ON "pubquiz"."team_antworten"("quiz_fragen_id" ASC, "quiz_team_session_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_antwortfeld" ON "pubquiz"."team_antwortfelder"("team_antwort_id" ASC, "antwortfeld_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "teams_teamname_key" ON "pubquiz"."teams"("teamname" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "pubquiz"."users"("email" ASC);

-- AddForeignKey
ALTER TABLE "pubquiz"."antworten" ADD CONSTRAINT "fk_antworten_antworttyp" FOREIGN KEY ("antworttyp_id") REFERENCES "pubquiz"."antworttyp"("antworttyp_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."antworten" ADD CONSTRAINT "fk_antworten_fragen" FOREIGN KEY ("fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."frage_antwortfeld_loesungen" ADD CONSTRAINT "frage_antwortfeld_loesungen_antwortfeld_id_fkey" FOREIGN KEY ("antwortfeld_id") REFERENCES "pubquiz"."frage_antwortfelder"("antwortfeld_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."frage_antwortfelder" ADD CONSTRAINT "frage_antwortfelder_fragen_id_fkey" FOREIGN KEY ("fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."frage_vorlage_antwortfelder" ADD CONSTRAINT "frage_vorlage_antwortfelder_vorlage_id_fkey" FOREIGN KEY ("vorlage_id") REFERENCES "pubquiz"."frage_vorlagen"("vorlage_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."fragen" ADD CONSTRAINT "fragen_vorlage_id_fkey" FOREIGN KEY ("vorlage_id") REFERENCES "pubquiz"."frage_vorlagen"("vorlage_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."fragen_kategorien" ADD CONSTRAINT "fk_fragen_kategorien_fragen" FOREIGN KEY ("fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."fragen_kategorien" ADD CONSTRAINT "fk_fragen_kategorien_kategorie" FOREIGN KEY ("fragenkategorie_id") REFERENCES "pubquiz"."fragenkategorie"("fragenkategorie_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."medien" ADD CONSTRAINT "fk_medien_antworten" FOREIGN KEY ("antwort_id") REFERENCES "pubquiz"."antworten"("antwort_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."medien" ADD CONSTRAINT "fk_medien_fragen" FOREIGN KEY ("fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."medien" ADD CONSTRAINT "fk_medien_medientyp" FOREIGN KEY ("medientyp_id") REFERENCES "pubquiz"."medientyp"("medientyp_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."medien" ADD CONSTRAINT "medien_antwortfeld_id_fkey" FOREIGN KEY ("antwortfeld_id") REFERENCES "pubquiz"."frage_antwortfelder"("antwortfeld_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_abschnitte" ADD CONSTRAINT "quiz_abschnitte_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_block_freigaben" ADD CONSTRAINT "quiz_block_freigaben_quiz_abschnitt_id_fkey" FOREIGN KEY ("quiz_abschnitt_id") REFERENCES "pubquiz"."quiz_abschnitte"("quiz_abschnitt_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_block_freigaben" ADD CONSTRAINT "quiz_block_freigaben_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_fragen" ADD CONSTRAINT "fk_quiz_fragen_fragen" FOREIGN KEY ("fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_fragen" ADD CONSTRAINT "fk_quiz_fragen_quiz" FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_fragen" ADD CONSTRAINT "quiz_fragen_quiz_abschnitt_id_fkey" FOREIGN KEY ("quiz_abschnitt_id") REFERENCES "pubquiz"."quiz_abschnitte"("quiz_abschnitt_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_praesentation_status" ADD CONSTRAINT "quiz_praesentation_status_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_team_sessions" ADD CONSTRAINT "quiz_team_sessions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_teams" ADD CONSTRAINT "fk_quiz_teams_quiz" FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."quiz_teams" ADD CONSTRAINT "fk_quiz_teams_teams" FOREIGN KEY ("team_id") REFERENCES "pubquiz"."teams"("team_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pubquiz"."team_antworten" ADD CONSTRAINT "team_antworten_antwort_id_fkey" FOREIGN KEY ("antwort_id") REFERENCES "pubquiz"."antworten"("antwort_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."team_antworten" ADD CONSTRAINT "team_antworten_quiz_abschnitt_id_fkey" FOREIGN KEY ("quiz_abschnitt_id") REFERENCES "pubquiz"."quiz_abschnitte"("quiz_abschnitt_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."team_antworten" ADD CONSTRAINT "team_antworten_quiz_fragen_id_fkey" FOREIGN KEY ("quiz_fragen_id") REFERENCES "pubquiz"."quiz_fragen"("quiz_fragen_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."team_antworten" ADD CONSTRAINT "team_antworten_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."team_antworten" ADD CONSTRAINT "team_antworten_quiz_team_session_id_fkey" FOREIGN KEY ("quiz_team_session_id") REFERENCES "pubquiz"."quiz_team_sessions"("quiz_team_session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."team_antwortfelder" ADD CONSTRAINT "team_antwortfelder_antwortfeld_id_fkey" FOREIGN KEY ("antwortfeld_id") REFERENCES "pubquiz"."frage_antwortfelder"("antwortfeld_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."team_antwortfelder" ADD CONSTRAINT "team_antwortfelder_team_antwort_id_fkey" FOREIGN KEY ("team_antwort_id") REFERENCES "pubquiz"."team_antworten"("team_antwort_id") ON DELETE CASCADE ON UPDATE CASCADE;

