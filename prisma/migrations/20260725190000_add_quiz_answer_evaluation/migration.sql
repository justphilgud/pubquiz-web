CREATE TYPE "pubquiz"."QuizAnswerEvaluationStatus" AS ENUM (
  'UNANSWERED',
  'WRONG',
  'PARTIAL',
  'CORRECT',
  'REVIEW_REQUIRED'
);

CREATE TYPE "pubquiz"."QuizAnswerEvaluationSource" AS ENUM (
  'AUTO',
  'MANUAL',
  'LEGACY'
);

ALTER TABLE "pubquiz"."team_antworten"
  ADD COLUMN "auto_basis_punkte" DECIMAL(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN "auto_endpunkte" DECIMAL(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN "vergebene_punkte" DECIMAL(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN "bewertungsstatus" "pubquiz"."QuizAnswerEvaluationStatus" NOT NULL DEFAULT 'UNANSWERED',
  ADD COLUMN "bewertungsquelle" "pubquiz"."QuizAnswerEvaluationSource" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "bewertungsdetails" JSONB,
  ADD COLUMN "manuelle_punkte" DECIMAL(12,4),
  ADD COLUMN "bewertet_am" TIMESTAMP(3),
  ADD COLUMN "bewertet_von_user_id" INTEGER;

CREATE TABLE "pubquiz"."team_antwort_auswahlen" (
  "team_antwort_id" INTEGER NOT NULL,
  "antwort_id" INTEGER NOT NULL,
  CONSTRAINT "team_antwort_auswahlen_pkey"
    PRIMARY KEY ("team_antwort_id", "antwort_id")
);

ALTER TABLE "pubquiz"."team_antwort_auswahlen"
  ADD CONSTRAINT "team_antwort_auswahlen_team_antwort_id_fkey"
  FOREIGN KEY ("team_antwort_id")
  REFERENCES "pubquiz"."team_antworten"("team_antwort_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."team_antwort_auswahlen"
  ADD CONSTRAINT "team_antwort_auswahlen_antwort_id_fkey"
  FOREIGN KEY ("antwort_id")
  REFERENCES "pubquiz"."antworten"("antwort_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pubquiz"."team_antworten"
  ADD CONSTRAINT "team_antworten_bewertet_von_user_id_fkey"
  FOREIGN KEY ("bewertet_von_user_id")
  REFERENCES "pubquiz"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "pubquiz"."team_antwort_auswahlen" ("team_antwort_id", "antwort_id")
SELECT "team_antwort_id", "antwort_id"
FROM "pubquiz"."team_antworten"
WHERE "antwort_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Preserve the former binary historical result. Structured answers are
-- deliberately not reinterpreted as partial points during migration.
WITH legacy_result AS (
  SELECT
    ta."team_antwort_id",
    qf."quiz_id",
    qf."quiz_fragen_id",
    qf."punkte_modus",
    CASE
      WHEN ta."ist_manuell_falsch" THEN FALSE
      WHEN ta."ist_manuell_richtig" THEN TRUE
      ELSE COALESCE(a."ist_richtig", FALSE)
    END AS is_correct,
    ta."ist_manuell_falsch" OR ta."ist_manuell_richtig" AS is_manual
  FROM "pubquiz"."team_antworten" ta
  JOIN "pubquiz"."quiz_fragen" qf
    ON qf."quiz_fragen_id" = ta."quiz_fragen_id"
  LEFT JOIN "pubquiz"."antworten" a
    ON a."antwort_id" = ta."antwort_id"
),
session_counts AS (
  SELECT "quiz_id", COUNT(*) AS team_count
  FROM "pubquiz"."quiz_team_sessions"
  GROUP BY "quiz_id"
),
question_counts AS (
  SELECT
    lr."quiz_fragen_id",
    COUNT(*) FILTER (WHERE lr.is_correct) AS correct_count,
    COALESCE(MAX(sc.team_count), 0) AS team_count
  FROM legacy_result lr
  LEFT JOIN session_counts sc ON sc."quiz_id" = lr."quiz_id"
  GROUP BY lr."quiz_fragen_id"
),
legacy_points AS (
  SELECT
    lr.*,
    CASE
      WHEN NOT lr.is_correct THEN 0::DECIMAL
      WHEN lr."punkte_modus" = 'expertenbonus'
        AND qc.correct_count = 1 THEN 2::DECIMAL
      WHEN lr."punkte_modus" = 'risikofrage'
        AND qc.correct_count > 0
        THEN GREATEST(1::DECIMAL, qc.team_count::DECIMAL / qc.correct_count)
      ELSE 1::DECIMAL
    END AS points
  FROM legacy_result lr
  JOIN question_counts qc
    ON qc."quiz_fragen_id" = lr."quiz_fragen_id"
)
UPDATE "pubquiz"."team_antworten" ta
SET
  "auto_basis_punkte" = CASE WHEN lp.is_correct THEN 1 ELSE 0 END,
  "auto_endpunkte" = lp.points,
  "vergebene_punkte" = lp.points,
  "manuelle_punkte" = CASE WHEN lp.is_manual THEN lp.points ELSE NULL END,
  "bewertungsstatus" = CASE
    WHEN lp.is_correct THEN 'CORRECT'::"pubquiz"."QuizAnswerEvaluationStatus"
    ELSE 'WRONG'::"pubquiz"."QuizAnswerEvaluationStatus"
  END,
  "bewertungsquelle" = CASE
    WHEN lp.is_manual THEN 'MANUAL'::"pubquiz"."QuizAnswerEvaluationSource"
    ELSE 'LEGACY'::"pubquiz"."QuizAnswerEvaluationSource"
  END
FROM legacy_points lp
WHERE lp."team_antwort_id" = ta."team_antwort_id";
