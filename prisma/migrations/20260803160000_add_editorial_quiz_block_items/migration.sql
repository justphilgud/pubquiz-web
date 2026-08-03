-- Additive editorial sequence settings. Existing quizzes retain the historical
-- question -> solution behaviour through the database default.
ALTER TABLE "pubquiz"."quiz"
ADD COLUMN "aufloesungsstrategie" VARCHAR(32) NOT NULL DEFAULT 'AFTER_EACH_QUESTION';

ALTER TABLE "pubquiz"."quiz_abschnitte"
ADD COLUMN "aufloesungsstrategie" VARCHAR(32);

ALTER TABLE "pubquiz"."quiz_ablauf_elemente"
ADD COLUMN "quiz_fragen_id" INTEGER,
ADD COLUMN "konfigurations_version" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "uq_quiz_ablauf_frage_typ"
ON "pubquiz"."quiz_ablauf_elemente"("quiz_id", "typ", "quiz_fragen_id");

CREATE INDEX "idx_quiz_ablauf_frage"
ON "pubquiz"."quiz_ablauf_elemente"("quiz_fragen_id");

ALTER TABLE "pubquiz"."quiz_ablauf_elemente"
ADD CONSTRAINT "quiz_ablauf_elemente_quiz_fragen_id_fkey"
FOREIGN KEY ("quiz_fragen_id") REFERENCES "pubquiz"."quiz_fragen"("quiz_fragen_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."quiz"
ADD CONSTRAINT "chk_quiz_aufloesungsstrategie"
CHECK ("aufloesungsstrategie" IN ('AFTER_EACH_QUESTION', 'END_OF_BLOCK', 'MANUAL'));

ALTER TABLE "pubquiz"."quiz_abschnitte"
ADD CONSTRAINT "chk_quiz_abschnitt_aufloesungsstrategie"
CHECK (
  "aufloesungsstrategie" IS NULL OR
  "aufloesungsstrategie" IN ('AFTER_EACH_QUESTION', 'END_OF_BLOCK', 'MANUAL')
);

ALTER TABLE "pubquiz"."quiz_ablauf_elemente"
ADD CONSTRAINT "chk_quiz_ablauf_fragebezug"
CHECK (
  ("typ" IN ('QUESTION', 'QUESTION_SOLUTION') AND "quiz_fragen_id" IS NOT NULL) OR
  ("typ" NOT IN ('QUESTION', 'QUESTION_SOLUTION') AND "quiz_fragen_id" IS NULL)
);
