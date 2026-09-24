CREATE TYPE "pubquiz"."ExternalQuestionImportBatchStatus" AS ENUM (
  'FETCHING', 'PROCESSING', 'REVIEW_READY', 'COMPLETED', 'FAILED'
);

CREATE TYPE "pubquiz"."ExternalQuestionImportItemStatus" AS ENUM (
  'IMPORTED', 'AUTO_REJECTED', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED'
);

CREATE TABLE "pubquiz"."external_question_import_batches" (
  "import_batch_id" SERIAL NOT NULL,
  "provider" VARCHAR(80) NOT NULL,
  "requested_count" INTEGER NOT NULL,
  "fetched_count" INTEGER NOT NULL DEFAULT 0,
  "status" "pubquiz"."ExternalQuestionImportBatchStatus" NOT NULL DEFAULT 'FETCHING',
  "report_json" JSONB,
  "error_message" TEXT,
  "created_by_user_id" INTEGER NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "external_question_import_batches_pkey" PRIMARY KEY ("import_batch_id")
);

CREATE TABLE "pubquiz"."external_question_import_items" (
  "import_item_id" SERIAL NOT NULL,
  "import_batch_id" INTEGER NOT NULL,
  "provider" VARCHAR(80) NOT NULL,
  "external_reference" VARCHAR(128) NOT NULL,
  "license" VARCHAR(80) NOT NULL,
  "license_url" TEXT NOT NULL,
  "original_language" VARCHAR(10) NOT NULL,
  "original_category" TEXT NOT NULL,
  "original_difficulty" VARCHAR(40) NOT NULL,
  "original_type" VARCHAR(40) NOT NULL,
  "original_question" TEXT NOT NULL,
  "original_correct_answer" TEXT NOT NULL,
  "original_incorrect_answers" JSONB NOT NULL,
  "provider_payload_json" JSONB NOT NULL,
  "prepared_question" TEXT,
  "prepared_correct_answer" TEXT,
  "prepared_incorrect_answers" JSONB,
  "explanation" TEXT,
  "verification_source_url" TEXT,
  "verification_source_title" TEXT,
  "suggested_category_id" INTEGER,
  "suggested_category_name" TEXT,
  "mapped_difficulty" DECIMAL(5,2),
  "status" "pubquiz"."ExternalQuestionImportItemStatus" NOT NULL DEFAULT 'IMPORTED',
  "issue_codes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "duplicate_candidates" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "content_fingerprint" VARCHAR(64) NOT NULL,
  "question_id" INTEGER,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verified_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_user_id" INTEGER,
  "rejection_reason" TEXT,
  CONSTRAINT "external_question_import_items_pkey" PRIMARY KEY ("import_item_id")
);

CREATE INDEX "idx_external_import_batch_provider_started" ON "pubquiz"."external_question_import_batches"("provider", "started_at");
CREATE INDEX "idx_external_import_batch_status_started" ON "pubquiz"."external_question_import_batches"("status", "started_at");
CREATE UNIQUE INDEX "uq_external_import_provider_reference" ON "pubquiz"."external_question_import_items"("provider", "external_reference");
CREATE UNIQUE INDEX "uq_external_import_item_question" ON "pubquiz"."external_question_import_items"("question_id");
CREATE INDEX "idx_external_import_item_batch_status" ON "pubquiz"."external_question_import_items"("import_batch_id", "status");
CREATE INDEX "idx_external_import_item_fingerprint" ON "pubquiz"."external_question_import_items"("content_fingerprint");
CREATE INDEX "idx_external_import_item_category" ON "pubquiz"."external_question_import_items"("suggested_category_id");

ALTER TABLE "pubquiz"."external_question_import_batches"
  ADD CONSTRAINT "external_import_batch_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."external_question_import_items"
  ADD CONSTRAINT "external_import_item_batch_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "pubquiz"."external_question_import_batches"("import_batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."external_question_import_items"
  ADD CONSTRAINT "external_import_item_category_fkey" FOREIGN KEY ("suggested_category_id") REFERENCES "pubquiz"."fragenkategorie"("fragenkategorie_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."external_question_import_items"
  ADD CONSTRAINT "external_import_item_question_fkey" FOREIGN KEY ("question_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."external_question_import_items"
  ADD CONSTRAINT "external_import_item_reviewed_by_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
