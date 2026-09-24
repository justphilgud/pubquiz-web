ALTER TABLE "pubquiz"."meme_moderation_candidates"
  ADD COLUMN "selected_for_presentation" BOOLEAN NOT NULL DEFAULT false;

UPDATE "pubquiz"."meme_moderation_candidates" AS candidate
SET "selected_for_presentation" = true
FROM "pubquiz"."meme_moderation_selections" AS selection
WHERE selection."meme_moderation_selection_id" = candidate."meme_moderation_selection_id"
  AND selection."state" = 'COMPLETED'
  AND candidate."review_status" = 'APPROVED';

CREATE INDEX "idx_meme_candidate_selection_presented"
  ON "pubquiz"."meme_moderation_candidates"("meme_moderation_selection_id", "selected_for_presentation");
