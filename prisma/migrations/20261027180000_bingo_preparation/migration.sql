BEGIN;
SET LOCAL search_path TO pubquiz, public;
-- CreateTable
CREATE TABLE "bingo_preparations" (
    "game_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bingo_preparations_pkey" PRIMARY KEY ("game_id")
);

-- CreateTable
CREATE TABLE "bingo_rounds" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "planned_draws" INTEGER NOT NULL DEFAULT 30,
    "strategy" VARCHAR(16) NOT NULL DEFAULT 'NEW',
    "issued_count" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bingo_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bingo_card_series" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "origin_round_id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "card_count" INTEGER NOT NULL,
    "request_id" UUID NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "print_snapshot" JSONB NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bingo_card_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bingo_cards" (
    "id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "printed_code" VARCHAR(24) NOT NULL,
    "cells" JSONB NOT NULL,
    "layout_hash" CHAR(64) NOT NULL,

    CONSTRAINT "bingo_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bingo_round_series" (
    "round_id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,

    CONSTRAINT "bingo_round_series_pkey" PRIMARY KEY ("round_id","series_id")
);

-- CreateTable
CREATE TABLE "bingo_issuance_changes" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "previous_count" INTEGER,
    "new_count" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bingo_issuance_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bingo_rounds_id_game_id_key" ON "bingo_rounds"("id", "game_id");

-- CreateIndex
CREATE UNIQUE INDEX "bingo_rounds_game_id_position_key" ON "bingo_rounds"("game_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "bingo_card_series_code_key" ON "bingo_card_series"("code");

-- CreateIndex
CREATE INDEX "bingo_card_series_game_id_created_at_id_idx" ON "bingo_card_series"("game_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bingo_card_series_id_game_id_key" ON "bingo_card_series"("id", "game_id");

-- CreateIndex
CREATE UNIQUE INDEX "bingo_card_series_game_id_request_id_key" ON "bingo_card_series"("game_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "bingo_cards_printed_code_key" ON "bingo_cards"("printed_code");

-- CreateIndex
CREATE UNIQUE INDEX "bingo_cards_series_id_ordinal_key" ON "bingo_cards"("series_id", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "bingo_cards_series_id_layout_hash_key" ON "bingo_cards"("series_id", "layout_hash");

-- CreateIndex
CREATE INDEX "bingo_round_series_series_id_idx" ON "bingo_round_series"("series_id");

-- CreateIndex
CREATE INDEX "bingo_issuance_changes_round_id_created_at_id_idx" ON "bingo_issuance_changes"("round_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "bingo_preparations" ADD CONSTRAINT "bingo_preparations_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game_drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingo_rounds" ADD CONSTRAINT "bingo_rounds_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game_drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingo_card_series" ADD CONSTRAINT "bingo_card_series_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game_drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingo_card_series" ADD CONSTRAINT "bingo_card_series_origin_round_id_game_id_fkey" FOREIGN KEY ("origin_round_id", "game_id") REFERENCES "bingo_rounds"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingo_card_series" ADD CONSTRAINT "bingo_card_series_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingo_cards" ADD CONSTRAINT "bingo_cards_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "bingo_card_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingo_round_series" ADD CONSTRAINT "bingo_round_series_round_id_game_id_fkey" FOREIGN KEY ("round_id", "game_id") REFERENCES "bingo_rounds"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingo_round_series" ADD CONSTRAINT "bingo_round_series_series_id_game_id_fkey" FOREIGN KEY ("series_id", "game_id") REFERENCES "bingo_card_series"("id", "game_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingo_issuance_changes" ADD CONSTRAINT "bingo_issuance_changes_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "bingo_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bingo_issuance_changes" ADD CONSTRAINT "bingo_issuance_changes_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE bingo_preparations ADD CHECK (revision >= 0);
ALTER TABLE bingo_rounds ADD CHECK (position > 0),
  ADD CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  ADD CHECK (planned_draws BETWEEN 1 AND 75),
  ADD CHECK (strategy IN ('NEW','EXISTING')),
  ADD CHECK (issued_count IS NULL OR issued_count >= 0);
ALTER TABLE bingo_card_series ADD CHECK (card_count BETWEEN 1 AND 500),
  ADD CHECK (code ~ '^BG-[0-9A-F]{12}$'), ADD CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  ADD CHECK (jsonb_typeof(print_snapshot)='object' AND print_snapshot->>'version'='1');
ALTER TABLE bingo_cards ADD CHECK (ordinal BETWEEN 1 AND 500),
  ADD CHECK (layout_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE bingo_issuance_changes ADD CHECK (previous_count IS NULL OR previous_count >= 0),
  ADD CHECK (new_count IS NULL OR new_count >= 0), ADD CHECK (previous_count IS DISTINCT FROM new_count);

CREATE FUNCTION pubquiz.bingo_valid_card(c jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r int; col int; v jsonb; n int; seen int[] := ARRAY[]::int[];
BEGIN
  IF jsonb_typeof(c)<>'array' OR jsonb_array_length(c)<>5 THEN RETURN false; END IF;
  FOR r IN 0..4 LOOP
    IF jsonb_typeof(c->r)<>'array' OR jsonb_array_length(c->r)<>5 THEN RETURN false; END IF;
    FOR col IN 0..4 LOOP
      v := c->r->col;
      IF r=2 AND col=2 THEN
        IF v IS DISTINCT FROM 'null'::jsonb THEN RETURN false; END IF;
      ELSE
        IF jsonb_typeof(v)<>'number' OR (v#>>'{}') !~ '^[0-9]{1,2}$' THEN RETURN false; END IF;
        n := (v#>>'{}')::int;
        IF n<col*15+1 OR n>(col+1)*15 OR n=ANY(seen) THEN RETURN false; END IF;
        seen := array_append(seen,n);
      END IF;
    END LOOP;
  END LOOP;
  RETURN true;
END $$;
ALTER TABLE bingo_cards ADD CHECK (pubquiz.bingo_valid_card(cells));
CREATE UNIQUE INDEX uq_bingo_cards_exact_layout ON bingo_cards(series_id,cells);

CREATE FUNCTION pubquiz.bingo_only_game() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pubquiz.game_drafts WHERE id=NEW.game_id AND eventart='BINGO') THEN
    RAISE EXCEPTION 'BINGO_GAME_REQUIRED' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bingo_preparations_game BEFORE INSERT OR UPDATE ON bingo_preparations FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_only_game();
CREATE TRIGGER bingo_rounds_game BEFORE INSERT OR UPDATE ON bingo_rounds FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_only_game();
CREATE TRIGGER bingo_series_game BEFORE INSERT ON bingo_card_series FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_only_game();

CREATE FUNCTION pubquiz.bingo_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'BINGO_RECORD_IMMUTABLE' USING ERRCODE='23514'; END $$;
CREATE TRIGGER bingo_cards_immutable BEFORE UPDATE OR DELETE ON bingo_cards FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_series_immutable BEFORE UPDATE OR DELETE ON bingo_card_series FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();
CREATE TRIGGER bingo_issuance_immutable BEFORE UPDATE OR DELETE ON bingo_issuance_changes FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_immutable_record();

CREATE FUNCTION pubquiz.bingo_card_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s pubquiz.bingo_card_series;
BEGIN
  SELECT * INTO s FROM pubquiz.bingo_card_series WHERE id=NEW.series_id;
  IF NOT FOUND OR NEW.ordinal>s.card_count OR NEW.printed_code<>s.code||'-'||lpad(NEW.ordinal::text,4,'0') THEN
    RAISE EXCEPTION 'BINGO_CARD_IDENTITY' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bingo_card_identity BEFORE INSERT ON bingo_cards FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_card_identity();

CREATE FUNCTION pubquiz.bingo_series_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; expected_count int; actual_count int;
BEGIN
  IF TG_TABLE_NAME='bingo_cards' THEN sid:=NEW.series_id; ELSE sid:=NEW.id; END IF;
  SELECT card_count INTO expected_count FROM pubquiz.bingo_card_series WHERE id=sid;
  SELECT count(*) INTO actual_count FROM pubquiz.bingo_cards WHERE series_id=sid;
  IF expected_count IS DISTINCT FROM actual_count THEN RAISE EXCEPTION 'BINGO_SERIES_INCOMPLETE' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER bingo_series_complete AFTER INSERT ON bingo_card_series DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_series_complete();
CREATE CONSTRAINT TRIGGER bingo_cards_complete AFTER INSERT ON bingo_cards DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_series_complete();

CREATE FUNCTION pubquiz.bingo_round_rules() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE available int;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.game_id<>OLD.game_id OR NEW.id<>OLD.id) THEN
    RAISE EXCEPTION 'BINGO_ROUND_IDENTITY_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  SELECT count(DISTINCT c.id) INTO available FROM pubquiz.bingo_round_series l
    JOIN pubquiz.bingo_cards c ON c.series_id=l.series_id WHERE l.round_id=NEW.id;
  IF NEW.issued_count IS NOT NULL AND NEW.issued_count>available THEN
    RAISE EXCEPTION 'BINGO_ISSUED_EXCEEDS_CARDS' USING ERRCODE='23514';
  END IF;
  IF NEW.strategy='NEW' AND EXISTS (SELECT 1 FROM pubquiz.bingo_round_series l
    JOIN pubquiz.bingo_card_series s ON s.id=l.series_id WHERE l.round_id=NEW.id AND s.origin_round_id<>NEW.id) THEN
    RAISE EXCEPTION 'BINGO_STRATEGY_CONFLICT' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bingo_round_rules BEFORE INSERT OR UPDATE ON bingo_rounds FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_round_rules();

CREATE FUNCTION pubquiz.bingo_assignment_rules() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r pubquiz.bingo_rounds; available int;
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'BINGO_ASSIGNMENT_IMMUTABLE' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN
    SELECT * INTO r FROM pubquiz.bingo_rounds WHERE id=OLD.round_id FOR UPDATE;
    SELECT count(DISTINCT c.id) INTO available FROM pubquiz.bingo_round_series l JOIN pubquiz.bingo_cards c ON c.series_id=l.series_id
      WHERE l.round_id=OLD.round_id AND l.series_id<>OLD.series_id;
    IF r.issued_count IS NOT NULL AND r.issued_count>available THEN RAISE EXCEPTION 'BINGO_ISSUED_EXCEEDS_CARDS' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  SELECT * INTO r FROM pubquiz.bingo_rounds WHERE id=NEW.round_id FOR UPDATE;
  IF r.strategy='NEW' AND NOT EXISTS (SELECT 1 FROM pubquiz.bingo_card_series WHERE id=NEW.series_id AND origin_round_id=NEW.round_id) THEN
    RAISE EXCEPTION 'BINGO_STRATEGY_CONFLICT' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bingo_assignment_rules BEFORE INSERT OR UPDATE OR DELETE ON bingo_round_series FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_assignment_rules();
CREATE FUNCTION pubquiz.bingo_game_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.eventart<>OLD.eventart AND (EXISTS(SELECT 1 FROM pubquiz.bingo_preparations WHERE game_id=OLD.id)
      OR EXISTS(SELECT 1 FROM pubquiz.bingo_rounds WHERE game_id=OLD.id)
      OR EXISTS(SELECT 1 FROM pubquiz.bingo_card_series WHERE game_id=OLD.id)) THEN
    RAISE EXCEPTION 'BINGO_GAME_TYPE_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF NEW.eventreihe_id<>OLD.eventreihe_id AND EXISTS(SELECT 1 FROM pubquiz.bingo_card_series WHERE game_id=OLD.id) THEN
    RAISE EXCEPTION 'BINGO_GAME_SERIES_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bingo_game_identity BEFORE UPDATE OF eventart,eventreihe_id ON game_drafts FOR EACH ROW EXECUTE FUNCTION pubquiz.bingo_game_identity();
COMMIT;

