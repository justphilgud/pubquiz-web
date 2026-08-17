INSERT INTO pubquiz.frage_vorlagen (code, name, slide_typ)
VALUES
  ('umfrage_einfach', 'Umfrage: eine Auswahl', 'poll_single'),
  ('umfrage_mehrfach', 'Umfrage: mehrere Auswahlen', 'poll_multi'),
  ('umfrage_skala', 'Umfrage: Skala', 'poll_scale')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    slide_typ = EXCLUDED.slide_typ,
    ist_aktiv = true;
