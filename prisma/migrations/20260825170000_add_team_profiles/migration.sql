ALTER TABLE "pubquiz"."teams"
  ADD COLUMN "avatar_code" VARCHAR(32),
  ADD COLUMN "foto_url" TEXT,
  ADD COLUMN "foto_upload_gesperrt" BOOLEAN NOT NULL DEFAULT false;
