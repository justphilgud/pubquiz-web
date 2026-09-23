ALTER TABLE "pubquiz"."quiz_fragen"
ADD COLUMN "meme_config_json" JSONB;

INSERT INTO "pubquiz"."frage_vorlagen" (
  "code",
  "name",
  "beschreibung",
  "slide_typ"
)
VALUES (
  'meme_beschriften',
  'Meme beschriften',
  'Teams beschriften ein vorgegebenes Bild mit einem oberen und unteren Memetext.',
  'meme_caption'
)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "beschreibung" = EXCLUDED."beschreibung",
    "slide_typ" = EXCLUDED."slide_typ",
    "ist_aktiv" = true;
