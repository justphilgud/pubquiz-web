BEGIN;
-- Additive only. Existing cards, print jobs, runs and codes are not rewritten.
CREATE TABLE pubquiz.bingo_card_set_settings (
 game_id uuid PRIMARY KEY REFERENCES pubquiz.game_drafts(id) ON DELETE RESTRICT,
 config jsonb NOT NULL CHECK (jsonb_typeof(config)='object')
);
CREATE TABLE pubquiz.bingo_evening_card_sets (
 id uuid PRIMARY KEY,
 game_id uuid NOT NULL REFERENCES pubquiz.game_drafts(id) ON DELETE RESTRICT,
 request_hash char(64) NOT NULL,
 manifest jsonb NOT NULL CHECK (jsonb_typeof(manifest)='object'),
 created_by integer NOT NULL REFERENCES pubquiz.users(id) ON DELETE RESTRICT,
 created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,game_id)
);
CREATE TABLE pubquiz.bingo_wildcard_series (
 series_id uuid PRIMARY KEY,
 game_id uuid NOT NULL,
 round_id uuid NOT NULL,
 UNIQUE(series_id,game_id),
 FOREIGN KEY(series_id,game_id) REFERENCES pubquiz.bingo_card_series(id,game_id) ON DELETE RESTRICT,
 FOREIGN KEY(round_id,game_id) REFERENCES pubquiz.bingo_rounds(id,game_id) ON DELETE RESTRICT
);
CREATE TRIGGER bingo_card_sets_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_evening_card_sets FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_wildcards_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_wildcard_series FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
-- A wildcard can never be attached to an earlier/different round, including through legacy UI.
CREATE FUNCTION pubquiz.bingo_wildcard_target() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM pubquiz.bingo_wildcard_series w WHERE w.series_id=NEW.series_id AND (w.round_id<>NEW.round_id OR w.game_id<>NEW.game_id)) THEN
  RAISE EXCEPTION 'Wildcard belongs to the final round only';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bingo_wildcard_target BEFORE INSERT OR UPDATE ON pubquiz.bingo_round_series FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_wildcard_target();
-- Do not silently turn previously printed wildcards into cards for an earlier round.
-- Deferred to allow the existing two-step round reordering transaction.
CREATE FUNCTION pubquiz.bingo_wildcard_final_round() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM pubquiz.bingo_wildcard_series w WHERE w.game_id=NEW.game_id AND w.round_id<>(SELECT id FROM pubquiz.bingo_rounds WHERE game_id=NEW.game_id ORDER BY position DESC LIMIT 1)) THEN
  RAISE EXCEPTION 'Printed wildcards freeze the final round; its position must remain last';
 END IF;
 IF EXISTS(SELECT 1 FROM pubquiz.bingo_wildcard_series w JOIN pubquiz.bingo_round_series rs ON rs.series_id=w.series_id WHERE w.game_id=NEW.game_id AND rs.round_id<>w.round_id) THEN
  RAISE EXCEPTION 'Wildcard has a foreign round assignment';
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER bingo_wildcard_final_round AFTER INSERT OR UPDATE ON pubquiz.bingo_rounds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_wildcard_final_round();
CREATE CONSTRAINT TRIGGER bingo_wildcard_created AFTER INSERT ON pubquiz.bingo_wildcard_series DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_wildcard_final_round();
COMMIT;
