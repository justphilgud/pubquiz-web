INSERT INTO pubquiz.frage_vorlagen (code, name, beschreibung, slide_typ)
VALUES (
  'kunstwerk',
  'Kunstwerk',
  'Künstler und Titel eines abgebildeten Kunstwerks erkennen.',
  'image_guess'
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    beschreibung = EXCLUDED.beschreibung,
    slide_typ = EXCLUDED.slide_typ,
    ist_aktiv = true;

UPDATE pubquiz.frage_vorlage_antwortfelder
SET label = 'Künstler',
    ist_pflicht = true
WHERE vorlage_id = (
  SELECT vorlage_id
  FROM pubquiz.frage_vorlagen
  WHERE code = 'kunstwerk'
)
  AND sortierung = 1;

INSERT INTO pubquiz.frage_vorlage_antwortfelder (
  vorlage_id,
  label,
  sortierung,
  ist_pflicht
)
SELECT vorlage_id, 'Künstler', 1, true
FROM pubquiz.frage_vorlagen
WHERE code = 'kunstwerk'
  AND NOT EXISTS (
    SELECT 1
    FROM pubquiz.frage_vorlage_antwortfelder
    WHERE vorlage_id = pubquiz.frage_vorlagen.vorlage_id
      AND sortierung = 1
  );

UPDATE pubquiz.frage_vorlage_antwortfelder
SET label = 'Titel',
    ist_pflicht = true
WHERE vorlage_id = (
  SELECT vorlage_id
  FROM pubquiz.frage_vorlagen
  WHERE code = 'kunstwerk'
)
  AND sortierung = 2;

INSERT INTO pubquiz.frage_vorlage_antwortfelder (
  vorlage_id,
  label,
  sortierung,
  ist_pflicht
)
SELECT vorlage_id, 'Titel', 2, true
FROM pubquiz.frage_vorlagen
WHERE code = 'kunstwerk'
  AND NOT EXISTS (
    SELECT 1
    FROM pubquiz.frage_vorlage_antwortfelder
    WHERE vorlage_id = pubquiz.frage_vorlagen.vorlage_id
      AND sortierung = 2
  );
