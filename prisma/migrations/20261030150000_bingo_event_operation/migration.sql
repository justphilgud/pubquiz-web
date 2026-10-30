-- Versioned opt-in event runs. Historical AP3 rows and initial snapshots unchanged.
BEGIN;
CREATE TABLE pubquiz.bingo_event_creation_requests (
 request_id uuid PRIMARY KEY, game_id uuid NOT NULL UNIQUE REFERENCES pubquiz.game_drafts(id) ON DELETE RESTRICT,
 created_by integer NOT NULL REFERENCES pubquiz.users(id) ON DELETE RESTRICT,
 request_hash char(64) NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$')
);
CREATE TABLE pubquiz.bingo_event_runs (
 run_id uuid PRIMARY KEY REFERENCES pubquiz.bingo_live_runs(id) ON DELETE RESTRICT,
 version smallint NOT NULL CHECK(version=2)
);
CREATE TABLE pubquiz.bingo_event_round_plan (
 run_id uuid NOT NULL, game_id uuid NOT NULL, round_id uuid NOT NULL, position integer NOT NULL CHECK(position>0),
 PRIMARY KEY(run_id,round_id), UNIQUE(run_id,position), UNIQUE(run_id,round_id,game_id),
 FOREIGN KEY(run_id,game_id) REFERENCES pubquiz.bingo_live_runs(id,game_id) ON DELETE RESTRICT,
 FOREIGN KEY(round_id,game_id) REFERENCES pubquiz.bingo_rounds(id,game_id) ON DELETE RESTRICT,
 FOREIGN KEY(run_id) REFERENCES pubquiz.bingo_event_runs(run_id) ON DELETE RESTRICT
);
CREATE TABLE pubquiz.bingo_event_rounds (
 run_id uuid NOT NULL, round_id uuid NOT NULL, game_id uuid NOT NULL,
 round_snapshot jsonb NOT NULL CHECK(jsonb_typeof(round_snapshot)='object'),
 opened_at timestamptz(3) NOT NULL,
 PRIMARY KEY(run_id,round_id), UNIQUE(run_id,round_id,game_id),
 FOREIGN KEY(run_id,round_id,game_id) REFERENCES pubquiz.bingo_event_round_plan(run_id,round_id,game_id) ON DELETE RESTRICT
);
CREATE TABLE pubquiz.bingo_event_round_cards (
 run_id uuid NOT NULL, round_id uuid NOT NULL, game_id uuid NOT NULL, card_id uuid NOT NULL, series_id uuid NOT NULL,
 PRIMARY KEY(run_id,round_id,card_id),
 FOREIGN KEY(run_id,round_id,game_id) REFERENCES pubquiz.bingo_event_rounds(run_id,round_id,game_id) ON DELETE RESTRICT,
 FOREIGN KEY(series_id,game_id) REFERENCES pubquiz.bingo_card_series(id,game_id) ON DELETE RESTRICT,
 FOREIGN KEY(card_id,series_id) REFERENCES pubquiz.bingo_cards(id,series_id) ON DELETE RESTRICT
);
ALTER TABLE pubquiz.bingo_live_events ADD COLUMN event_round_id uuid;
ALTER TABLE pubquiz.bingo_live_events ADD CONSTRAINT bingo_event_round_reference FOREIGN KEY(run_id,event_round_id) REFERENCES pubquiz.bingo_event_rounds(run_id,round_id) ON DELETE RESTRICT;
ALTER TABLE pubquiz.bingo_live_events ADD CONSTRAINT bingo_event_version_reference CHECK((coalesce(command->>'version','1')='2')=(event_round_id IS NOT NULL));
CREATE TRIGGER bingo_event_creation_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_event_creation_requests FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_event_runs_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_event_runs FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_event_plan_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_event_round_plan FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_event_rounds_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_event_rounds FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_event_cards_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_event_round_cards FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
COMMIT;
