-- Additive: no existing event, card, quiz or evaluation rows are rewritten.
CREATE TABLE "pubquiz"."game_ceremonies" (
  "game_id" UUID PRIMARY KEY,
  "state" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_ceremonies_game_fkey" FOREIGN KEY ("game_id") REFERENCES "pubquiz"."game_drafts"("id") ON DELETE RESTRICT,
  CONSTRAINT "game_ceremonies_state_object" CHECK (jsonb_typeof("state") = 'object')
);
