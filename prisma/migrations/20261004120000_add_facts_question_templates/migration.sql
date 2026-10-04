-- Additive registration only; facts use the existing template_config_json.
INSERT INTO pubquiz.frage_vorlagen (code, name, slide_typ)
VALUES
  ('fakten_jahr', 'Fakten → Jahr', 'facts'),
  ('fakten_land', 'Fakten → Land', 'facts'),
  ('fakten_frei', 'Fakten → freie Antwort', 'facts')
ON CONFLICT (code) DO NOTHING;
