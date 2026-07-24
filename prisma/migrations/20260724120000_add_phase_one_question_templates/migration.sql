INSERT INTO pubquiz.frage_vorlagen (code, name, slide_typ)
VALUES
  ('wahr_falsch', 'Wahr oder falsch', 'boolean'),
  ('schaetzfrage', 'Schätzfrage', 'numeric'),
  ('reihenfolge', 'Reihenfolge', 'ordering'),
  ('uebersetzt_vorgelesen', 'Übersetzt vorgelesen', 'translated_audio'),
  ('anagramm', 'Anagramm', 'anagram'),
  ('google_rezensionen', 'Google-Rezensionen', 'review_sequence')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    slide_typ = EXCLUDED.slide_typ,
    ist_aktiv = true;
