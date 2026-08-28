CREATE TYPE "pubquiz"."LivePollStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "pubquiz"."LivePollScope" AS ENUM ('GLOBAL', 'EVENT_SERIES', 'QUIZ');
CREATE TYPE "pubquiz"."LivePollType" AS ENUM ('SINGLE_CHOICE', 'FREE_TEXT');
CREATE TYPE "pubquiz"."LivePollPublicationMode" AS ENUM ('AUTOMATIC', 'MODERATED');

CREATE TABLE "pubquiz"."live_polls" (
  "live_poll_id" SERIAL NOT NULL,
  "stable_key" VARCHAR(64) NOT NULL,
  "status" "pubquiz"."LivePollStatus" NOT NULL DEFAULT 'DRAFT',
  "geltungsbereich" "pubquiz"."LivePollScope" NOT NULL DEFAULT 'EVENT_SERIES',
  "eventreihe_id" INTEGER,
  "quiz_id" INTEGER,
  "created_by_user_id" INTEGER,
  "source_live_poll_id" INTEGER,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_polls_pkey" PRIMARY KEY ("live_poll_id"),
  CONSTRAINT "live_polls_scope_check" CHECK (
    ("geltungsbereich" = 'GLOBAL' AND "eventreihe_id" IS NULL AND "quiz_id" IS NULL) OR
    ("geltungsbereich" = 'EVENT_SERIES' AND "eventreihe_id" IS NOT NULL AND "quiz_id" IS NULL) OR
    ("geltungsbereich" = 'QUIZ' AND "eventreihe_id" IS NULL AND "quiz_id" IS NOT NULL)
  )
);

CREATE TABLE "pubquiz"."live_poll_revisions" (
  "live_poll_revision_id" SERIAL NOT NULL,
  "live_poll_id" INTEGER NOT NULL,
  "revisionsnummer" INTEGER NOT NULL,
  "typ" "pubquiz"."LivePollType" NOT NULL,
  "prompt" VARCHAR(300) NOT NULL,
  "publication_mode" "pubquiz"."LivePollPublicationMode" NOT NULL DEFAULT 'AUTOMATIC',
  "optionen" JSONB NOT NULL,
  "moderationsnotiz" VARCHAR(2000),
  "created_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_poll_revisions_pkey" PRIMARY KEY ("live_poll_revision_id"),
  CONSTRAINT "live_poll_revision_number_check" CHECK ("revisionsnummer" > 0)
);

ALTER TABLE "pubquiz"."quiz_ablauf_elemente"
  ADD COLUMN "live_poll_revision_id" INTEGER;

CREATE TABLE "pubquiz"."live_poll_responses" (
  "live_poll_response_id" SERIAL NOT NULL,
  "interaction_run_id" INTEGER NOT NULL,
  "live_poll_revision_id" INTEGER NOT NULL,
  "quiz_team_session_id" INTEGER NOT NULL,
  "selected_option_id" VARCHAR(64),
  "original_text" VARCHAR(500),
  "public_text" VARCHAR(500),
  "is_visible" BOOLEAN NOT NULL DEFAULT false,
  "moderated_by_user_id" INTEGER,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_poll_responses_pkey" PRIMARY KEY ("live_poll_response_id"),
  CONSTRAINT "live_poll_response_shape_check" CHECK (
    ("selected_option_id" IS NOT NULL AND "original_text" IS NULL AND "public_text" IS NULL) OR
    ("selected_option_id" IS NULL AND "original_text" IS NOT NULL AND "public_text" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "live_polls_stable_key_key" ON "pubquiz"."live_polls"("stable_key");
CREATE INDEX "idx_live_polls_status_updated" ON "pubquiz"."live_polls"("status", "updated_at");
CREATE INDEX "idx_live_polls_scope_eventreihe" ON "pubquiz"."live_polls"("geltungsbereich", "eventreihe_id");
CREATE INDEX "idx_live_polls_quiz" ON "pubquiz"."live_polls"("quiz_id");
CREATE UNIQUE INDEX "uq_live_poll_revision" ON "pubquiz"."live_poll_revisions"("live_poll_id", "revisionsnummer");
CREATE INDEX "idx_live_poll_revision_created" ON "pubquiz"."live_poll_revisions"("live_poll_id", "created_at");
CREATE INDEX "idx_quiz_ablauf_live_poll_revision" ON "pubquiz"."quiz_ablauf_elemente"("live_poll_revision_id");
CREATE UNIQUE INDEX "uq_live_poll_response_run_team" ON "pubquiz"."live_poll_responses"("interaction_run_id", "quiz_team_session_id");
CREATE INDEX "idx_live_poll_response_public" ON "pubquiz"."live_poll_responses"("interaction_run_id", "is_visible", "updated_at");
CREATE INDEX "idx_live_poll_response_team" ON "pubquiz"."live_poll_responses"("quiz_team_session_id", "updated_at");

ALTER TABLE "pubquiz"."live_polls" ADD CONSTRAINT "live_polls_eventreihe_id_fkey" FOREIGN KEY ("eventreihe_id") REFERENCES "pubquiz"."eventreihen"("eventreihe_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."live_polls" ADD CONSTRAINT "live_polls_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."live_polls" ADD CONSTRAINT "live_polls_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."live_polls" ADD CONSTRAINT "live_polls_source_live_poll_id_fkey" FOREIGN KEY ("source_live_poll_id") REFERENCES "pubquiz"."live_polls"("live_poll_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."live_poll_revisions" ADD CONSTRAINT "live_poll_revisions_live_poll_id_fkey" FOREIGN KEY ("live_poll_id") REFERENCES "pubquiz"."live_polls"("live_poll_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."live_poll_revisions" ADD CONSTRAINT "live_poll_revisions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."quiz_ablauf_elemente" ADD CONSTRAINT "quiz_ablauf_elemente_live_poll_revision_id_fkey" FOREIGN KEY ("live_poll_revision_id") REFERENCES "pubquiz"."live_poll_revisions"("live_poll_revision_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."live_poll_responses" ADD CONSTRAINT "live_poll_responses_interaction_run_id_fkey" FOREIGN KEY ("interaction_run_id") REFERENCES "pubquiz"."quiz_interaction_runs"("interaction_run_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."live_poll_responses" ADD CONSTRAINT "live_poll_responses_live_poll_revision_id_fkey" FOREIGN KEY ("live_poll_revision_id") REFERENCES "pubquiz"."live_poll_revisions"("live_poll_revision_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."live_poll_responses" ADD CONSTRAINT "live_poll_responses_quiz_team_session_id_fkey" FOREIGN KEY ("quiz_team_session_id") REFERENCES "pubquiz"."quiz_team_sessions"("quiz_team_session_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."live_poll_responses" ADD CONSTRAINT "live_poll_responses_moderated_by_user_id_fkey" FOREIGN KEY ("moderated_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
