ALTER TYPE "pubquiz"."ExternalQuestionImportItemStatus"
  ADD VALUE IF NOT EXISTS 'READY_FOR_REVIEW';
ALTER TYPE "pubquiz"."ExternalQuestionImportItemStatus"
  ADD VALUE IF NOT EXISTS 'REJECT_RECOMMENDED';

CREATE TYPE "pubquiz"."ExternalQuestionLocalizationStatus" AS ENUM (
  'NOT_RUN', 'LOCALIZED', 'REVIEW_REQUIRED', 'FAILED'
);

CREATE TYPE "pubquiz"."ExternalQuestionVerificationStatus" AS ENUM (
  'NOT_RUN', 'VERIFIED', 'CONTRADICTED', 'AMBIGUOUS', 'NO_RELIABLE_SOURCE'
);

ALTER TABLE "pubquiz"."external_question_import_items"
  ADD COLUMN "localization_status" "pubquiz"."ExternalQuestionLocalizationStatus" NOT NULL DEFAULT 'NOT_RUN',
  ADD COLUMN "localization_note" TEXT,
  ADD COLUMN "verification_status" "pubquiz"."ExternalQuestionVerificationStatus" NOT NULL DEFAULT 'NOT_RUN',
  ADD COLUMN "verification_note" TEXT,
  ADD COLUMN "verification_sources" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "automation_changes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "automation_model" VARCHAR(120),
  ADD COLUMN "automation_rejection_reason" TEXT,
  ADD COLUMN "automation_started_at" TIMESTAMP(3),
  ADD COLUMN "automation_completed_at" TIMESTAMP(3),
  ADD COLUMN "automation_error" TEXT,
  ADD COLUMN "review_started_at" TIMESTAMP(3),
  ADD COLUMN "review_edit_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "manually_edited" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_external_import_item_batch_verification"
  ON "pubquiz"."external_question_import_items"("import_batch_id", "verification_status");
