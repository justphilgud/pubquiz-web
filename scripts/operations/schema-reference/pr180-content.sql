-- Independent expected catalog, used only inside a rolled-back disposable probe.
CREATE TABLE pubquiz.bingo_round_templates (
 id uuid PRIMARY KEY,
 eventreihe_id integer NOT NULL REFERENCES pubquiz.eventreihen(eventreihe_id) ON DELETE RESTRICT,
 name varchar(80) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
 planned_draws integer NOT NULL DEFAULT 30 CHECK (planned_draws BETWEEN 1 AND 75),
 config jsonb,
 source_game_id uuid REFERENCES pubquiz.game_drafts(id) ON DELETE RESTRICT,
 revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
 created_by integer NOT NULL REFERENCES pubquiz.users(id) ON DELETE RESTRICT,
 created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
 CHECK (config IS NULL OR (jsonb_typeof(config)='object' AND config->>'version' IN ('1','2')))
);
CREATE INDEX bingo_round_templates_series ON pubquiz.bingo_round_templates(eventreihe_id,created_at,id);
CREATE TABLE pubquiz.bingo_print_jobs (
 id uuid PRIMARY KEY,
 game_id uuid NOT NULL REFERENCES pubquiz.game_drafts(id) ON DELETE RESTRICT,
 request_hash char(64) NOT NULL,
 cards_per_round integer NOT NULL CHECK (cards_per_round BETWEEN 1 AND 1000),
 created_by integer NOT NULL REFERENCES pubquiz.users(id) ON DELETE RESTRICT,
 created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,game_id)
);
CREATE TABLE pubquiz.bingo_print_job_items (
 job_id uuid NOT NULL,
 game_id uuid NOT NULL,
 round_id uuid NOT NULL,
 series_id uuid NOT NULL,
 round_position integer NOT NULL CHECK(round_position>0),
 round_label varchar(80) NOT NULL,
 PRIMARY KEY(job_id,series_id),
 FOREIGN KEY(job_id,game_id) REFERENCES pubquiz.bingo_print_jobs(id,game_id) ON DELETE RESTRICT,
 FOREIGN KEY(round_id,game_id) REFERENCES pubquiz.bingo_rounds(id,game_id) ON DELETE RESTRICT,
 FOREIGN KEY(series_id,game_id) REFERENCES pubquiz.bingo_card_series(id,game_id) ON DELETE RESTRICT
);
