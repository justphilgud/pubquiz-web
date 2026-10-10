-- Add only new template master data. Existing questions and templates remain untouched.
INSERT INTO pubquiz.frage_vorlagen (code, name, beschreibung, slide_typ)
VALUES ('musik', 'Musik', 'Interpret und Titel eines normal abgespielten Liedes erkennen.', 'audio_guess')
ON CONFLICT (code) DO NOTHING;

INSERT INTO pubquiz.frage_vorlage_antwortfelder (vorlage_id, label, sortierung, ist_pflicht)
SELECT v.vorlage_id, f.label, f.sortierung, true
FROM pubquiz.frage_vorlagen v
CROSS JOIN (VALUES ('Interpret', 1), ('Songtitel', 2)) AS f(label, sortierung)
WHERE v.code = 'musik'
  AND NOT EXISTS (
    SELECT 1 FROM pubquiz.frage_vorlage_antwortfelder existing
    WHERE existing.vorlage_id = v.vorlage_id AND existing.sortierung = f.sortierung
  );
