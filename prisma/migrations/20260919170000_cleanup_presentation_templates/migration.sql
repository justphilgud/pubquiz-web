BEGIN;

CREATE TEMP TABLE "_retired_presentation_templates" (
  "presentation_template_id" VARCHAR(64) PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO "_retired_presentation_templates" ("presentation_template_id")
VALUES
  ('ungegoogelt-dark'),
  ('corporate-reference');

INSERT INTO "_retired_presentation_templates" ("presentation_template_id")
SELECT "presentation_template_id"
FROM "pubquiz"."presentation_templates"
WHERE
  "source_template_id" IS NOT NULL
  OR "presentation_template_id" LIKE '%-kopie%'
  OR lower(trim("name")) LIKE '%kopie'
ON CONFLICT ("presentation_template_id") DO NOTHING;

UPDATE "pubquiz"."eventreihen"
SET "default_presentation_template_id" = 'ungegoogelt-default'
WHERE "default_presentation_template_id" IN (
  SELECT "presentation_template_id" FROM "_retired_presentation_templates"
);

UPDATE "pubquiz"."eventreihen"
SET "default_answer_form_template_id" = 'ungegoogelt-default'
WHERE "default_answer_form_template_id" IN (
  SELECT "presentation_template_id" FROM "_retired_presentation_templates"
);

UPDATE "pubquiz"."quiz"
SET "presentation_template_id" = 'ungegoogelt-default'
WHERE "presentation_template_id" IN (
  SELECT "presentation_template_id" FROM "_retired_presentation_templates"
);

UPDATE "pubquiz"."quiz"
SET "answer_form_template_id" = 'ungegoogelt-default'
WHERE "answer_form_template_id" IN (
  SELECT "presentation_template_id" FROM "_retired_presentation_templates"
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "pubquiz"."eventreihen" AS "event_series"
    WHERE
      "event_series"."default_presentation_template_id" IN (
        SELECT "presentation_template_id" FROM "_retired_presentation_templates"
      )
      OR "event_series"."default_answer_form_template_id" IN (
        SELECT "presentation_template_id" FROM "_retired_presentation_templates"
      )
  ) OR EXISTS (
    SELECT 1
    FROM "pubquiz"."quiz"
    WHERE
      "quiz"."presentation_template_id" IN (
        SELECT "presentation_template_id" FROM "_retired_presentation_templates"
      )
      OR "quiz"."answer_form_template_id" IN (
        SELECT "presentation_template_id" FROM "_retired_presentation_templates"
      )
  ) THEN
    RAISE EXCEPTION 'Template cleanup left a reference to a retired template';
  END IF;
END $$;

UPDATE "pubquiz"."presentation_templates"
SET
  "status" = 'ARCHIVED',
  "updated_at" = CURRENT_TIMESTAMP
WHERE
  "presentation_template_id" IN (
    SELECT "presentation_template_id" FROM "_retired_presentation_templates"
  )
  AND "status" <> 'ARCHIVED';

COMMIT;
