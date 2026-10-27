BEGIN;
SET LOCAL search_path TO pubquiz,public;
ALTER TABLE pubquiz.eventreihen ADD COLUMN bingo_print_config jsonb;
ALTER TABLE pubquiz.game_drafts ADD COLUMN bingo_print_config jsonb;
ALTER TABLE pubquiz.eventreihen ADD CONSTRAINT bingo_series_print_config CHECK (bingo_print_config IS NULL OR (jsonb_typeof(bingo_print_config)='object' AND bingo_print_config->>'version'='1'));
ALTER TABLE pubquiz.game_drafts ADD CONSTRAINT bingo_game_print_config CHECK (bingo_print_config IS NULL OR (eventart='BINGO' AND jsonb_typeof(bingo_print_config)='object' AND bingo_print_config->>'version'='1'));
ALTER TABLE pubquiz.bingo_card_series DROP CONSTRAINT bingo_card_series_print_snapshot_check;
ALTER TABLE pubquiz.bingo_card_series ADD CONSTRAINT bingo_card_series_print_snapshot_check CHECK (jsonb_typeof(print_snapshot)='object' AND print_snapshot->>'version' IN ('1','2'));
CREATE TABLE pubquiz.bingo_series_labels (
  series_id uuid PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES pubquiz.game_drafts(id) ON DELETE RESTRICT,
  prefix integer NOT NULL CHECK (prefix>0),
  UNIQUE(game_id,prefix),
  UNIQUE(series_id,game_id),
  FOREIGN KEY(series_id,game_id) REFERENCES pubquiz.bingo_card_series(id,game_id) ON DELETE RESTRICT
);
INSERT INTO pubquiz.bingo_series_labels(series_id,game_id,prefix)
SELECT id,game_id,row_number() OVER (PARTITION BY game_id ORDER BY created_at,id)::integer FROM pubquiz.bingo_card_series;
CREATE TRIGGER bingo_labels_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_series_labels FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TABLE pubquiz.bingo_print_versions (
  series_id uuid NOT NULL REFERENCES pubquiz.bingo_card_series(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version>=2),
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND snapshot->>'version'='2'),
  created_by integer NOT NULL REFERENCES pubquiz.users(id) ON DELETE RESTRICT,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(series_id,version)
);
CREATE TRIGGER bingo_print_versions_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_print_versions FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
COMMIT;
