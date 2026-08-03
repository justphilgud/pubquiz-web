ALTER TABLE "pubquiz"."frage_story_elemente"
ADD COLUMN "sortierung" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "frage_story_element_id",
    ROW_NUMBER() OVER (
      PARTITION BY "fragen_id"
      ORDER BY "created_at", "frage_story_element_id"
    ) * 10 AS "sortierung"
  FROM "pubquiz"."frage_story_elemente"
)
UPDATE "pubquiz"."frage_story_elemente" AS target
SET "sortierung" = ranked."sortierung"
FROM ranked
WHERE target."frage_story_element_id" = ranked."frage_story_element_id";

CREATE INDEX "idx_frage_story_element_order"
ON "pubquiz"."frage_story_elemente"("fragen_id", "sortierung", "frage_story_element_id");

ALTER TABLE "pubquiz"."quiz_fragen"
ADD COLUMN "verknuepfte_story_elemente_uebernehmen" BOOLEAN NOT NULL DEFAULT true;
