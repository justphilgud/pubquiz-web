CREATE TYPE "pubquiz"."MemePresentationState" AS ENUM (
  'PRESENTING',
  'OVERVIEW',
  'VOTING_OPEN',
  'VOTING_CLOSED'
);

CREATE TABLE "pubquiz"."meme_presentations" (
  "meme_presentation_id" SERIAL NOT NULL,
  "meme_moderation_selection_id" INTEGER NOT NULL,
  "quiz_id" INTEGER NOT NULL,
  "quiz_fragen_id" INTEGER NOT NULL,
  "state" "pubquiz"."MemePresentationState" NOT NULL DEFAULT 'PRESENTING',
  "active_candidate_position" INTEGER,
  "overview_page" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "started_by_user_id" INTEGER,
  "voting_opened_at" TIMESTAMP(3),
  "voting_closed_at" TIMESTAMP(3),
  "voting_closed_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meme_presentations_pkey" PRIMARY KEY ("meme_presentation_id")
);

CREATE TABLE "pubquiz"."meme_votes" (
  "meme_vote_id" SERIAL NOT NULL,
  "meme_presentation_id" INTEGER NOT NULL,
  "quiz_team_session_id" INTEGER NOT NULL,
  "meme_moderation_candidate_id" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meme_votes_pkey" PRIMARY KEY ("meme_vote_id")
);

CREATE UNIQUE INDEX "meme_presentations_meme_moderation_selection_id_key"
  ON "pubquiz"."meme_presentations"("meme_moderation_selection_id");
CREATE INDEX "idx_meme_presentation_quiz_state"
  ON "pubquiz"."meme_presentations"("quiz_id", "state", "updated_at");
CREATE INDEX "idx_meme_presentation_question"
  ON "pubquiz"."meme_presentations"("quiz_fragen_id", "updated_at");

CREATE UNIQUE INDEX "uq_meme_vote_presentation_team"
  ON "pubquiz"."meme_votes"("meme_presentation_id", "quiz_team_session_id");
CREATE INDEX "idx_meme_vote_candidate"
  ON "pubquiz"."meme_votes"("meme_presentation_id", "meme_moderation_candidate_id");
CREATE INDEX "idx_meme_vote_team"
  ON "pubquiz"."meme_votes"("quiz_team_session_id", "updated_at");

ALTER TABLE "pubquiz"."meme_presentations"
  ADD CONSTRAINT "meme_presentations_meme_moderation_selection_id_fkey"
  FOREIGN KEY ("meme_moderation_selection_id")
  REFERENCES "pubquiz"."meme_moderation_selections"("meme_moderation_selection_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_presentations"
  ADD CONSTRAINT "meme_presentations_quiz_id_fkey"
  FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_presentations"
  ADD CONSTRAINT "meme_presentations_quiz_fragen_id_fkey"
  FOREIGN KEY ("quiz_fragen_id") REFERENCES "pubquiz"."quiz_fragen"("quiz_fragen_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_presentations"
  ADD CONSTRAINT "meme_presentations_started_by_user_id_fkey"
  FOREIGN KEY ("started_by_user_id") REFERENCES "pubquiz"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_presentations"
  ADD CONSTRAINT "meme_presentations_voting_closed_by_user_id_fkey"
  FOREIGN KEY ("voting_closed_by_user_id") REFERENCES "pubquiz"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."meme_votes"
  ADD CONSTRAINT "meme_votes_meme_presentation_id_fkey"
  FOREIGN KEY ("meme_presentation_id")
  REFERENCES "pubquiz"."meme_presentations"("meme_presentation_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_votes"
  ADD CONSTRAINT "meme_votes_quiz_team_session_id_fkey"
  FOREIGN KEY ("quiz_team_session_id")
  REFERENCES "pubquiz"."quiz_team_sessions"("quiz_team_session_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."meme_votes"
  ADD CONSTRAINT "meme_votes_meme_moderation_candidate_id_fkey"
  FOREIGN KEY ("meme_moderation_candidate_id")
  REFERENCES "pubquiz"."meme_moderation_candidates"("meme_moderation_candidate_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."meme_presentations"
  ADD CONSTRAINT "meme_presentations_position_check"
  CHECK ("active_candidate_position" IS NULL OR "active_candidate_position" > 0),
  ADD CONSTRAINT "meme_presentations_overview_page_check"
  CHECK ("overview_page" >= 0),
  ADD CONSTRAINT "meme_presentations_revision_check"
  CHECK ("revision" > 0);
ALTER TABLE "pubquiz"."meme_votes"
  ADD CONSTRAINT "meme_votes_revision_check" CHECK ("revision" > 0);
