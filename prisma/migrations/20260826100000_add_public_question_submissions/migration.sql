CREATE TABLE "pubquiz"."public_question_submissions" (
  "public_submission_id" SERIAL NOT NULL,
  "fragen_id" INTEGER NOT NULL,
  "submitter_name" VARCHAR(120),
  "submitter_email" VARCHAR(254),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "public_question_submissions_pkey" PRIMARY KEY ("public_submission_id"),
  CONSTRAINT "uq_public_question_submissions_fragen_id" UNIQUE ("fragen_id"),
  CONSTRAINT "public_question_submissions_fragen_id_fkey"
    FOREIGN KEY ("fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_public_question_submissions_created_at"
  ON "pubquiz"."public_question_submissions"("created_at");

CREATE TABLE "pubquiz"."public_question_rate_limits" (
  "rate_limit_id" SERIAL NOT NULL,
  "request_fingerprint" VARCHAR(64) NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "public_question_rate_limits_pkey" PRIMARY KEY ("rate_limit_id"),
  CONSTRAINT "uq_public_question_rate_limit_window"
    UNIQUE ("request_fingerprint", "window_start"),
  CONSTRAINT "chk_public_question_rate_limit_count"
    CHECK ("request_count" >= 0)
);

CREATE INDEX "idx_public_question_rate_limits_updated_at"
  ON "pubquiz"."public_question_rate_limits"("updated_at");
