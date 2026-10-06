CREATE TYPE "pubquiz"."QuizPurpose" AS ENUM ('REGULAR', 'TEST');
ALTER TABLE "pubquiz"."quiz" ADD COLUMN "purpose" "pubquiz"."QuizPurpose" NOT NULL DEFAULT 'REGULAR';
