-- Additive: no historical row, card, journal or print snapshot is rewritten.
BEGIN;
ALTER TABLE pubquiz.bingo_rounds DROP CONSTRAINT bingo_round_terms_shape;
ALTER TABLE pubquiz.bingo_rounds ADD CONSTRAINT bingo_round_terms_shape CHECK (term_snapshot IS NULL OR (jsonb_typeof(term_snapshot)='object' AND term_snapshot->>'version' IN ('1','2')));
ALTER TABLE pubquiz.bingo_term_sets DROP CONSTRAINT bingo_term_sets_config_check;
ALTER TABLE pubquiz.bingo_term_sets ADD CONSTRAINT bingo_term_sets_config_check CHECK (jsonb_typeof(config)='object' AND config->>'version' IN ('1','2'));
ALTER TABLE pubquiz.bingo_term_sets ADD COLUMN config_hash varchar(64) CHECK(config_hash IS NULL OR config_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE pubquiz.bingo_term_sets ADD CONSTRAINT bingo_matching_config_hash CHECK(config->>'version'<>'2' OR config_hash IS NOT NULL);
CREATE TABLE pubquiz.bingo_matching_assets (
 id uuid PRIMARY KEY,
 game_id uuid NOT NULL REFERENCES pubquiz.bingo_preparations(game_id) ON DELETE RESTRICT,
 source_question_id integer NOT NULL CHECK(source_question_id>0),
 source_media_id integer NOT NULL CHECK(source_media_id>0),
 source_revision varchar(64) NOT NULL CHECK(source_revision ~ '^[a-f0-9]{64}$'),
 kind varchar(5) NOT NULL CHECK(kind IN ('AUDIO','IMAGE','VIDEO')),
 variant varchar(80) NOT NULL CHECK(variant ~ '^[a-z_]{1,80}$'),
 content_type varchar(80) NOT NULL CHECK(content_type::text IN ('audio/mpeg'::text,'audio/mp4'::text,'audio/wav'::text,'audio/ogg'::text,'video/mp4'::text,'video/webm'::text,'image/png'::text,'image/jpeg'::text,'image/webp'::text)),
 sha256 varchar(64) NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='array'),
 content bytea NOT NULL CHECK(octet_length(content)>0 AND octet_length(content)<=104857600),
 created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(game_id,source_media_id,source_revision)
);
CREATE INDEX bingo_matching_assets_game ON pubquiz.bingo_matching_assets(game_id);
CREATE TRIGGER bingo_matching_assets_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_matching_assets FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_term_sets_immutable BEFORE UPDATE OR DELETE ON pubquiz.bingo_term_sets FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
COMMIT;
