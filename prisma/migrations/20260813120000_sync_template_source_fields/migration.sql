-- Presentation templates are the authoritative source for every rendered surface.
-- Keep the legacy answer-form columns synchronized for historical rows without
-- changing the effective runtime template.
UPDATE "pubquiz"."eventreihen"
SET "default_answer_form_template_id" = "default_presentation_template_id"
WHERE "default_answer_form_template_id" IS DISTINCT FROM "default_presentation_template_id";

UPDATE "pubquiz"."quiz"
SET "answer_form_template_id" = "presentation_template_id"
WHERE "answer_form_template_id" IS DISTINCT FROM "presentation_template_id";
