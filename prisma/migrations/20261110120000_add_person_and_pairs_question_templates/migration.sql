INSERT INTO pubquiz.frage_vorlagen (code, name, slide_typ)
VALUES ('fakten_person', 'Fakten → Person', 'facts'),
       ('paare_bilden', 'Paare bilden', 'pairs')
ON CONFLICT (code) DO NOTHING;
