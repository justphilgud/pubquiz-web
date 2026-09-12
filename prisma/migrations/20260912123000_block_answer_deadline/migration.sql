ALTER TABLE "pubquiz"."quiz_block_freigaben"
ADD COLUMN "answer_deadline_at" TIMESTAMP(3);

-- Preserve a countdown already running when this additive migration is installed.
UPDATE "pubquiz"."quiz_block_freigaben" AS block
SET "answer_deadline_at" = presentation."countdown_started_at"
    + presentation."countdown_dauer_sekunden" * INTERVAL '1 second'
FROM "pubquiz"."quiz_praesentation_status" AS presentation
WHERE block."quiz_id" = presentation."quiz_id"
  AND block."ist_freigegeben" = true AND block."ist_geschlossen" = false
  AND presentation."countdown_status" = 'running'
  AND presentation."countdown_started_at" IS NOT NULL
  AND presentation."countdown_dauer_sekunden" > 0;
