CREATE TABLE "pubquiz"."excel_question_import_receipts" (
    "actor_id" INTEGER NOT NULL,
    "request_id" UUID NOT NULL,
    "plan_digest" CHAR(64) NOT NULL,
    "content_digest" CHAR(64) NOT NULL,
    "result_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excel_question_import_receipts_pkey" PRIMARY KEY ("actor_id", "request_id")
);

CREATE INDEX "excel_question_import_receipts_actor_id_content_digest_idx"
    ON "pubquiz"."excel_question_import_receipts"("actor_id", "content_digest");
