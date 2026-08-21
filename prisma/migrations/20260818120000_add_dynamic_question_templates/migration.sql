CREATE TYPE "pubquiz"."QuestionTemplateKind" AS ENUM (
  'SYSTEM',
  'DYNAMIC'
);

CREATE TYPE "pubquiz"."QuestionTemplateStatus" AS ENUM (
  'ACTIVE',
  'PENDING',
  'REJECTED',
  'ARCHIVED'
);

ALTER TABLE "pubquiz"."frage_vorlagen"
ADD COLUMN "beschreibung" TEXT,
ADD COLUMN "art" "pubquiz"."QuestionTemplateKind" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN "status" "pubquiz"."QuestionTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "basis_code" TEXT,
ADD COLUMN "konfiguration_json" JSONB,
ADD COLUMN "source_fragen_id" INTEGER,
ADD COLUMN "created_by_user_id" INTEGER,
ADD COLUMN "reviewed_by_user_id" INTEGER,
ADD COLUMN "review_feedback" TEXT,
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "reviewed_at" TIMESTAMP(3);

ALTER TABLE "pubquiz"."fragen"
ADD COLUMN "source_vorlage_id" INTEGER;

ALTER TABLE "pubquiz"."frage_vorlagen"
ADD CONSTRAINT "frage_vorlagen_source_fragen_id_fkey"
FOREIGN KEY ("source_fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id")
ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "frage_vorlagen_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "pubquiz"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "frage_vorlagen_reviewed_by_user_id_fkey"
FOREIGN KEY ("reviewed_by_user_id") REFERENCES "pubquiz"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "ck_frage_vorlagen_dynamic_snapshot"
CHECK (
  ("art" = 'SYSTEM' AND "basis_code" IS NULL AND "konfiguration_json" IS NULL)
  OR
  ("art" = 'DYNAMIC' AND "basis_code" IS NOT NULL AND "konfiguration_json" IS NOT NULL)
);

ALTER TABLE "pubquiz"."fragen"
ADD CONSTRAINT "fragen_source_vorlage_id_fkey"
FOREIGN KEY ("source_vorlage_id") REFERENCES "pubquiz"."frage_vorlagen"("vorlage_id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_frage_vorlagen_art_status_name"
ON "pubquiz"."frage_vorlagen"("art", "status", "name");

CREATE INDEX "idx_frage_vorlagen_source_frage"
ON "pubquiz"."frage_vorlagen"("source_fragen_id");

CREATE INDEX "idx_fragen_source_vorlage"
ON "pubquiz"."fragen"("source_vorlage_id");
