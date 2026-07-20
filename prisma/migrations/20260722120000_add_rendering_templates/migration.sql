ALTER TABLE "pubquiz"."eventreihen"
ADD COLUMN "default_presentation_template_id" VARCHAR(64) NOT NULL DEFAULT 'ungegoogelt-default',
ADD COLUMN "default_answer_form_template_id" VARCHAR(64) NOT NULL DEFAULT 'ungegoogelt-default';

ALTER TABLE "pubquiz"."quiz"
ADD COLUMN "presentation_template_id" VARCHAR(64),
ADD COLUMN "answer_form_template_id" VARCHAR(64);
