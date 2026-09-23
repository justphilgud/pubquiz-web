ALTER TABLE "pubquiz"."meme_presentations"
  ADD COLUMN "result_finalized_at" TIMESTAMP(3),
  ADD COLUMN "result_finalized_by_user_id" INTEGER,
  ADD COLUMN "result_revision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "pubquiz"."meme_result_entries" (
  "meme_result_entry_id" SERIAL NOT NULL,
  "meme_presentation_id" INTEGER NOT NULL,
  "meme_moderation_candidate_id" INTEGER NOT NULL,
  "vote_count" INTEGER NOT NULL,
  "is_winner" BOOLEAN NOT NULL DEFAULT false,
  "awarded_points" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "meme_result_entries_pkey" PRIMARY KEY ("meme_result_entry_id"),
  CONSTRAINT "meme_result_entries_vote_count_check" CHECK ("vote_count" >= 0),
  CONSTRAINT "meme_result_entries_awarded_points_check" CHECK ("awarded_points" IN (0, 1)),
  CONSTRAINT "meme_result_entries_winner_points_check" CHECK ("is_winner" = ("awarded_points" = 1))
);

CREATE UNIQUE INDEX "uq_meme_result_presentation_candidate"
  ON "pubquiz"."meme_result_entries"("meme_presentation_id", "meme_moderation_candidate_id");

CREATE INDEX "idx_meme_result_presentation_winner"
  ON "pubquiz"."meme_result_entries"("meme_presentation_id", "is_winner");

ALTER TABLE "pubquiz"."meme_presentations"
  ADD CONSTRAINT "meme_presentations_result_finalized_by_user_id_fkey"
  FOREIGN KEY ("result_finalized_by_user_id") REFERENCES "pubquiz"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."meme_result_entries"
  ADD CONSTRAINT "meme_result_entries_meme_presentation_id_fkey"
  FOREIGN KEY ("meme_presentation_id") REFERENCES "pubquiz"."meme_presentations"("meme_presentation_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."meme_result_entries"
  ADD CONSTRAINT "meme_result_entries_meme_moderation_candidate_id_fkey"
  FOREIGN KEY ("meme_moderation_candidate_id") REFERENCES "pubquiz"."meme_moderation_candidates"("meme_moderation_candidate_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
