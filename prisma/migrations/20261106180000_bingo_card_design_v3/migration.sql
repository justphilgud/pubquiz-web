-- Additive only: old cards, snapshots and migration files are never rewritten.
BEGIN;
ALTER TABLE pubquiz.bingo_card_series DROP CONSTRAINT bingo_card_series_print_snapshot_check;
ALTER TABLE pubquiz.bingo_card_series ADD CONSTRAINT bingo_card_series_print_snapshot_check CHECK (jsonb_typeof(print_snapshot)='object' AND print_snapshot->>'version' IN ('1','2','3'));
ALTER TABLE pubquiz.bingo_print_versions DROP CONSTRAINT bingo_print_versions_snapshot_check;
ALTER TABLE pubquiz.bingo_print_versions ADD CONSTRAINT bingo_print_versions_snapshot_check CHECK (jsonb_typeof(snapshot)='object' AND snapshot->>'version' IN ('2','3'));
ALTER TABLE pubquiz.bingo_rounds ADD COLUMN term_snapshot jsonb;
ALTER TABLE pubquiz.bingo_rounds ADD CONSTRAINT bingo_round_terms_shape CHECK (term_snapshot IS NULL OR (jsonb_typeof(term_snapshot)='object' AND term_snapshot->>'version'='1'));
CREATE TABLE pubquiz.bingo_term_sets (
 id uuid PRIMARY KEY,
 game_id uuid NOT NULL REFERENCES pubquiz.bingo_preparations(game_id) ON DELETE RESTRICT,
 config jsonb NOT NULL CHECK (jsonb_typeof(config)='object' AND config->>'version'='1'),
 revision integer NOT NULL DEFAULT 0 CHECK (revision>=0),
 created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX bingo_term_sets_game ON pubquiz.bingo_term_sets(game_id);
COMMIT;
