-- AP3: one persisted selected round per run; AP1 remains the state authority.
-- No existing table, row, card or migration is rewritten.
BEGIN;
CREATE TABLE pubquiz.bingo_live_runs (
  id uuid PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES pubquiz.game_drafts(id) ON DELETE RESTRICT,
  round_id uuid NOT NULL,
  eventreihe_id integer NOT NULL REFERENCES pubquiz.eventreihen(eventreihe_id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL CHECK (status IN ('RUNNING','PAUSED','ENDED')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  started_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  created_by integer NOT NULL REFERENCES pubquiz.users(id) ON DELETE RESTRICT,
  round_snapshot jsonb NOT NULL CHECK (jsonb_typeof(round_snapshot)='object'),
  design_snapshot jsonb NOT NULL CHECK (jsonb_typeof(design_snapshot)='object'),
  visual_assets jsonb NOT NULL CHECK (jsonb_typeof(visual_assets)='object'),
  audience_key uuid NOT NULL UNIQUE,
  start_request_id uuid NOT NULL,
  start_request_hash char(64) NOT NULL CHECK (start_request_hash ~ '^[0-9a-f]{64}$'),
  UNIQUE(game_id,start_request_id),
  UNIQUE(id,game_id),
  FOREIGN KEY(round_id,game_id) REFERENCES pubquiz.bingo_rounds(id,game_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX bingo_live_one_active ON pubquiz.bingo_live_runs(game_id)
  WHERE status IN ('RUNNING','PAUSED');
CREATE INDEX bingo_live_game_history ON pubquiz.bingo_live_runs(game_id,started_at,id);

CREATE UNIQUE INDEX bingo_cards_identity_series ON pubquiz.bingo_cards(id,series_id);
CREATE TABLE pubquiz.bingo_live_cards (
  run_id uuid NOT NULL,
  game_id uuid NOT NULL,
  card_id uuid NOT NULL,
  series_id uuid NOT NULL,
  PRIMARY KEY(run_id,card_id),
  FOREIGN KEY(run_id,game_id) REFERENCES pubquiz.bingo_live_runs(id,game_id) ON DELETE RESTRICT,
  FOREIGN KEY(series_id,game_id) REFERENCES pubquiz.bingo_card_series(id,game_id) ON DELETE RESTRICT,
  FOREIGN KEY(card_id,series_id) REFERENCES pubquiz.bingo_cards(id,series_id) ON DELETE RESTRICT
);
CREATE TABLE pubquiz.bingo_live_events (
  run_id uuid NOT NULL REFERENCES pubquiz.bingo_live_runs(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK(revision > 0),
  request_id uuid NOT NULL,
  request_hash char(64) NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  actor_id integer NOT NULL REFERENCES pubquiz.users(id) ON DELETE RESTRICT,
  occurred_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  command jsonb NOT NULL CHECK(jsonb_typeof(command)='object'),
  PRIMARY KEY(run_id,revision),
  UNIQUE(run_id,request_id)
);
-- Reuse the already reviewed immutable-record function; no new executable body.
CREATE TRIGGER bingo_live_cards_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_live_cards
  FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_live_events_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_live_events
  FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_live_run_identity BEFORE UPDATE OF id,game_id,round_id,eventreihe_id,started_at,created_by,round_snapshot,design_snapshot,visual_assets,audience_key,start_request_id,start_request_hash
  ON pubquiz.bingo_live_runs FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_live_run_delete BEFORE DELETE ON pubquiz.bingo_live_runs
  FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
COMMIT;
