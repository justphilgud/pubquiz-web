-- Additive content architecture for reusable, unscored story elements.
CREATE TYPE "pubquiz"."StoryElementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "pubquiz"."StoryElementScope" AS ENUM ('GLOBAL', 'EVENT_SERIES', 'QUIZ');
CREATE TYPE "pubquiz"."StoryQuestionRelationship" AS ENUM ('CONTEXT', 'AFTER_SOLUTION', 'RELATED', 'REVEAL', 'FOLLOW_UP');

CREATE TABLE "pubquiz"."story_elemente" (
    "story_element_id" SERIAL NOT NULL,
    "stable_key" VARCHAR(64) NOT NULL,
    "status" "pubquiz"."StoryElementStatus" NOT NULL DEFAULT 'DRAFT',
    "geltungsbereich" "pubquiz"."StoryElementScope" NOT NULL DEFAULT 'EVENT_SERIES',
    "eventreihe_id" INTEGER,
    "quiz_id" INTEGER,
    "created_by_user_id" INTEGER,
    "source_story_element_id" INTEGER,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_elemente_pkey" PRIMARY KEY ("story_element_id"),
    CONSTRAINT "ck_story_elemente_scope" CHECK (
      ("geltungsbereich" = 'GLOBAL' AND "eventreihe_id" IS NULL AND "quiz_id" IS NULL) OR
      ("geltungsbereich" = 'EVENT_SERIES' AND "eventreihe_id" IS NOT NULL AND "quiz_id" IS NULL) OR
      ("geltungsbereich" = 'QUIZ' AND "eventreihe_id" IS NULL AND "quiz_id" IS NOT NULL)
    )
);

CREATE TABLE "pubquiz"."story_element_revisionen" (
    "story_element_revision_id" SERIAL NOT NULL,
    "story_element_id" INTEGER NOT NULL,
    "revisionsnummer" INTEGER NOT NULL,
    "typ" VARCHAR(40) NOT NULL,
    "titel" VARCHAR(160) NOT NULL,
    "beschreibung" VARCHAR(1000),
    "kategorie" VARCHAR(120),
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "moderationsnotiz" VARCHAR(2000),
    "konfigurations_version" INTEGER NOT NULL DEFAULT 1,
    "konfiguration" JSONB NOT NULL,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_element_revisionen_pkey" PRIMARY KEY ("story_element_revision_id"),
    CONSTRAINT "ck_story_element_revision_number" CHECK ("revisionsnummer" > 0),
    CONSTRAINT "ck_story_element_config_version" CHECK ("konfigurations_version" > 0),
    CONSTRAINT "ck_story_element_type" CHECK ("typ" IN (
      'IMAGE', 'IMAGE_GALLERY', 'TEXT', 'ANECDOTE', 'QUOTE', 'PORTRAIT',
      'CHAPTER_INTRO', 'MEDIA_SEQUENCE', 'AUDIO', 'VIDEO', 'CUSTOM_MESSAGE'
    ))
);

CREATE TABLE "pubquiz"."frage_story_elemente" (
    "frage_story_element_id" SERIAL NOT NULL,
    "fragen_id" INTEGER NOT NULL,
    "story_element_id" INTEGER NOT NULL,
    "beziehung" "pubquiz"."StoryQuestionRelationship" NOT NULL DEFAULT 'RELATED',
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "frage_story_elemente_pkey" PRIMARY KEY ("frage_story_element_id")
);

ALTER TABLE "pubquiz"."quiz_ablauf_elemente"
  ADD COLUMN "story_element_revision_id" INTEGER,
  ADD COLUMN "story_bezugs_quiz_fragen_id" INTEGER,
  ADD COLUMN "story_beziehung" "pubquiz"."StoryQuestionRelationship";

CREATE UNIQUE INDEX "story_elemente_stable_key_key"
  ON "pubquiz"."story_elemente"("stable_key");
CREATE INDEX "idx_story_elemente_status_updated"
  ON "pubquiz"."story_elemente"("status", "updated_at");
CREATE INDEX "idx_story_elemente_scope_eventreihe"
  ON "pubquiz"."story_elemente"("geltungsbereich", "eventreihe_id");
CREATE INDEX "idx_story_elemente_quiz"
  ON "pubquiz"."story_elemente"("quiz_id");
CREATE INDEX "idx_story_elemente_creator"
  ON "pubquiz"."story_elemente"("created_by_user_id");
CREATE UNIQUE INDEX "uq_story_element_revision"
  ON "pubquiz"."story_element_revisionen"("story_element_id", "revisionsnummer");
CREATE INDEX "idx_story_element_revision_created"
  ON "pubquiz"."story_element_revisionen"("story_element_id", "created_at");
CREATE UNIQUE INDEX "uq_frage_story_element"
  ON "pubquiz"."frage_story_elemente"("fragen_id", "story_element_id");
CREATE INDEX "idx_frage_story_element_story"
  ON "pubquiz"."frage_story_elemente"("story_element_id", "beziehung");
CREATE INDEX "idx_quiz_ablauf_story_revision"
  ON "pubquiz"."quiz_ablauf_elemente"("story_element_revision_id");
CREATE INDEX "idx_quiz_ablauf_story_question"
  ON "pubquiz"."quiz_ablauf_elemente"("story_bezugs_quiz_fragen_id");

ALTER TABLE "pubquiz"."story_elemente"
  ADD CONSTRAINT "story_elemente_eventreihe_id_fkey"
  FOREIGN KEY ("eventreihe_id") REFERENCES "pubquiz"."eventreihen"("eventreihe_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."story_elemente"
  ADD CONSTRAINT "story_elemente_quiz_id_fkey"
  FOREIGN KEY ("quiz_id") REFERENCES "pubquiz"."quiz"("quiz_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."story_elemente"
  ADD CONSTRAINT "story_elemente_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."story_elemente"
  ADD CONSTRAINT "story_elemente_source_story_element_id_fkey"
  FOREIGN KEY ("source_story_element_id") REFERENCES "pubquiz"."story_elemente"("story_element_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."story_element_revisionen"
  ADD CONSTRAINT "story_element_revisionen_story_element_id_fkey"
  FOREIGN KEY ("story_element_id") REFERENCES "pubquiz"."story_elemente"("story_element_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."story_element_revisionen"
  ADD CONSTRAINT "story_element_revisionen_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."frage_story_elemente"
  ADD CONSTRAINT "frage_story_elemente_fragen_id_fkey"
  FOREIGN KEY ("fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."frage_story_elemente"
  ADD CONSTRAINT "frage_story_elemente_story_element_id_fkey"
  FOREIGN KEY ("story_element_id") REFERENCES "pubquiz"."story_elemente"("story_element_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."frage_story_elemente"
  ADD CONSTRAINT "frage_story_elemente_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."quiz_ablauf_elemente"
  ADD CONSTRAINT "quiz_ablauf_elemente_story_element_revision_id_fkey"
  FOREIGN KEY ("story_element_revision_id") REFERENCES "pubquiz"."story_element_revisionen"("story_element_revision_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pubquiz"."quiz_ablauf_elemente"
  ADD CONSTRAINT "quiz_ablauf_elemente_story_bezugs_quiz_fragen_id_fkey"
  FOREIGN KEY ("story_bezugs_quiz_fragen_id") REFERENCES "pubquiz"."quiz_fragen"("quiz_fragen_id") ON DELETE SET NULL ON UPDATE CASCADE;
