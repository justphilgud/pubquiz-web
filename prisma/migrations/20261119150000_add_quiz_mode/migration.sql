-- Existing quizzes and inserts without an explicit mode keep category balancing.
ALTER TABLE "pubquiz"."quiz"
  ADD COLUMN "quiz_modus" VARCHAR(16) NOT NULL DEFAULT 'VARIED';

ALTER TABLE "pubquiz"."quiz"
  ADD CONSTRAINT "quiz_modus_valid" CHECK ("quiz_modus" IN ('VARIED', 'THEMED'));
