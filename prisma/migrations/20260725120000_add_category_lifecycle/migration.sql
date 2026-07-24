CREATE TYPE "pubquiz"."CategoryStatus" AS ENUM ('ACTIVE', 'PENDING', 'ARCHIVED');

ALTER TABLE "pubquiz"."fragenkategorie"
  ADD COLUMN "status" "pubquiz"."CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "created_by_user_id" INTEGER,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "pubquiz"."fragenkategorie"
  ADD CONSTRAINT "fragenkategorie_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id")
  REFERENCES "pubquiz"."users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "idx_fragenkategorie_status_name"
  ON "pubquiz"."fragenkategorie"("status", "kategorie");

CREATE INDEX "idx_fragenkategorie_created_by"
  ON "pubquiz"."fragenkategorie"("created_by_user_id");
