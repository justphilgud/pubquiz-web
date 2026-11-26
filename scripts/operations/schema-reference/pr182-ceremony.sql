-- Independent expected addition, used only in rolled-back disposable catalog probes.
CREATE TABLE pubquiz.game_ceremonies (
 game_id uuid NOT NULL,
 state jsonb NOT NULL,
 updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT game_ceremonies_pkey PRIMARY KEY (game_id),
 CONSTRAINT game_ceremonies_game_fkey FOREIGN KEY (game_id)
   REFERENCES pubquiz.game_drafts(id) ON DELETE RESTRICT,
 CONSTRAINT game_ceremonies_state_object CHECK (jsonb_typeof(state) = 'object')
);
