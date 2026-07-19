ALTER TABLE pubquiz.fragen
ADD COLUMN template_config_json JSONB;

UPDATE pubquiz.frage_vorlagen
SET name = 'Bitcrush-Musik'
WHERE code = 'eight_bit';
