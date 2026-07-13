-- Introduce an explicit review lifecycle without inferring submissions from
-- the completion state of legacy questions.
CREATE TYPE "pubquiz"."QuestionReviewStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED'
);

ALTER TABLE "pubquiz"."fragen"
ADD COLUMN "review_status" "pubquiz"."QuestionReviewStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "submitted_at" TIMESTAMP(3),
ADD COLUMN "submitted_by_user_id" INTEGER,
ADD COLUMN "review_feedback" TEXT,
ADD COLUMN "reviewed_at" TIMESTAMP(3),
ADD COLUMN "reviewed_by_user_id" INTEGER;

-- Only an existing approval proves that a legacy question was approved.
UPDATE "pubquiz"."fragen"
SET "review_status" = 'APPROVED'
WHERE "freigegeben" = true;

CREATE INDEX "idx_fragen_eigene_arbeitsliste"
ON "pubquiz"."fragen"("created_by_user_id", "review_status", "ist_archiviert");

CREATE INDEX "idx_fragen_review_queue"
ON "pubquiz"."fragen"("review_status", "ist_archiviert", "submitted_at");
