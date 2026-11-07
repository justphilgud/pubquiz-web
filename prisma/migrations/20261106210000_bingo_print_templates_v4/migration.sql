-- Additive contract extension; no existing row or historic migration is changed.
BEGIN;
ALTER TABLE pubquiz.bingo_card_series DROP CONSTRAINT bingo_card_series_print_snapshot_check;
ALTER TABLE pubquiz.bingo_card_series ADD CONSTRAINT bingo_card_series_print_snapshot_check CHECK(jsonb_typeof(print_snapshot)='object' AND print_snapshot->>'version' IN ('1','2','3','4'));
ALTER TABLE pubquiz.bingo_print_versions DROP CONSTRAINT bingo_print_versions_snapshot_check;
ALTER TABLE pubquiz.bingo_print_versions ADD CONSTRAINT bingo_print_versions_snapshot_check CHECK(jsonb_typeof(snapshot)='object' AND snapshot->>'version' IN ('2','3','4'));
ALTER TABLE pubquiz.eventreihen DROP CONSTRAINT bingo_series_print_config;
ALTER TABLE pubquiz.eventreihen ADD CONSTRAINT bingo_series_print_config CHECK(bingo_print_config IS NULL OR (jsonb_typeof(bingo_print_config)='object' AND bingo_print_config->>'version' IN ('1','2')));
ALTER TABLE pubquiz.game_drafts DROP CONSTRAINT bingo_game_print_config;
ALTER TABLE pubquiz.game_drafts ADD CONSTRAINT bingo_game_print_config CHECK(bingo_print_config IS NULL OR (eventart='BINGO' AND jsonb_typeof(bingo_print_config)='object' AND bingo_print_config->>'version' IN ('1','2')));
COMMIT;
