-- Additive optional display setting; no backfill or changes to cards, journals or scores.
ALTER TABLE pubquiz.bingo_rounds
  ADD COLUMN presentation_color varchar(7),
  ADD CONSTRAINT bingo_round_color_hex CHECK (
    presentation_color IS NULL OR presentation_color ~ '^#[0-9A-Fa-f]{6}$'
  );
