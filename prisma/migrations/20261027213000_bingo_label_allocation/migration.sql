BEGIN;
SET LOCAL search_path TO pubquiz,public;
-- Keep the game-before-series lock order, including callers on the older AP2 code.
LOCK TABLE pubquiz.game_drafts IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE pubquiz.bingo_card_series IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO pubquiz.bingo_series_labels(series_id,game_id,prefix)
SELECT s.id,s.game_id,coalesce((SELECT max(l.prefix) FROM pubquiz.bingo_series_labels l WHERE l.game_id=s.game_id),0)+row_number() OVER(PARTITION BY s.game_id ORDER BY s.created_at,s.id)::integer
FROM pubquiz.bingo_card_series s WHERE NOT EXISTS(SELECT 1 FROM pubquiz.bingo_series_labels l WHERE l.series_id=s.id);
CREATE FUNCTION pubquiz.bingo_allocate_label() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM pubquiz.game_drafts WHERE id=NEW.game_id FOR UPDATE;
  INSERT INTO pubquiz.bingo_series_labels(series_id,game_id,prefix)
  SELECT NEW.id,NEW.game_id,coalesce(max(prefix),0)+1 FROM pubquiz.bingo_series_labels WHERE game_id=NEW.game_id;
  RETURN NEW;
END $$;
CREATE TRIGGER bingo_allocate_label AFTER INSERT ON pubquiz.bingo_card_series FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_allocate_label();
COMMIT;
