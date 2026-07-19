INSERT INTO pubquiz.frage_vorlagen (code, name, slide_typ)
VALUES
  ('eight_bit', '8 Bit Song', 'audio_guess'),
  ('pixelbild', 'Pixelbild', 'image_guess')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    slide_typ = EXCLUDED.slide_typ;

INSERT INTO pubquiz.frage_vorlage_antwortfelder (vorlage_id, label, sortierung, ist_pflicht)
SELECT vorlage_id, 'Lösung', 1, true
FROM pubquiz.frage_vorlagen
WHERE code = 'pixelbild'
  AND NOT EXISTS (
    SELECT 1
    FROM pubquiz.frage_vorlage_antwortfelder
    WHERE vorlage_id = pubquiz.frage_vorlagen.vorlage_id
      AND sortierung = 1
  );
