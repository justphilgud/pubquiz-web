BEGIN;
-- CreateTable
CREATE TABLE "pubquiz"."eventarten" (
    "kennung" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,

    CONSTRAINT "eventarten_pkey" PRIMARY KEY ("kennung")
);

-- CreateTable
CREATE TABLE "pubquiz"."eventreihe_eventarten" (
    "eventreihe_id" INTEGER NOT NULL,
    "eventart" VARCHAR(64) NOT NULL,
    "ist_freigeschaltet" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventreihe_eventarten_pkey" PRIMARY KEY ("eventreihe_id","eventart")
);

-- CreateTable
CREATE TABLE "pubquiz"."benutzer_eventartrollen" (
    "benutzer_id" INTEGER NOT NULL,
    "eventreihe_id" INTEGER NOT NULL,
    "eventart" VARCHAR(64) NOT NULL,
    "rolle" "pubquiz"."RoleAssignmentRole" NOT NULL,
    "zugewiesen_von_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benutzer_eventartrollen_pkey" PRIMARY KEY ("benutzer_id","eventreihe_id","eventart")
);

-- CreateTable
CREATE TABLE "pubquiz"."eventreihe_verwaltung" (
    "benutzer_id" INTEGER NOT NULL,
    "eventreihe_id" INTEGER NOT NULL,
    "zugewiesen_von_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventreihe_verwaltung_pkey" PRIMARY KEY ("benutzer_id","eventreihe_id")
);

-- CreateIndex
CREATE INDEX "benutzer_eventartrollen_eventreihe_id_eventart_idx" ON "pubquiz"."benutzer_eventartrollen"("eventreihe_id", "eventart");

-- CreateIndex
CREATE INDEX "eventreihe_verwaltung_eventreihe_id_idx" ON "pubquiz"."eventreihe_verwaltung"("eventreihe_id");

-- AddForeignKey
ALTER TABLE "pubquiz"."eventreihe_eventarten" ADD CONSTRAINT "eventreihe_eventarten_eventreihe_id_fkey" FOREIGN KEY ("eventreihe_id") REFERENCES "pubquiz"."eventreihen"("eventreihe_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."eventreihe_eventarten" ADD CONSTRAINT "eventreihe_eventarten_eventart_fkey" FOREIGN KEY ("eventart") REFERENCES "pubquiz"."eventarten"("kennung") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."benutzer_eventartrollen" ADD CONSTRAINT "benutzer_eventartrollen_benutzer_id_fkey" FOREIGN KEY ("benutzer_id") REFERENCES "pubquiz"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."benutzer_eventartrollen" ADD CONSTRAINT "benutzer_eventartrollen_eventreihe_id_fkey" FOREIGN KEY ("eventreihe_id") REFERENCES "pubquiz"."eventreihen"("eventreihe_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."benutzer_eventartrollen" ADD CONSTRAINT "benutzer_eventartrollen_eventart_fkey" FOREIGN KEY ("eventart") REFERENCES "pubquiz"."eventarten"("kennung") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."eventreihe_verwaltung" ADD CONSTRAINT "eventreihe_verwaltung_benutzer_id_fkey" FOREIGN KEY ("benutzer_id") REFERENCES "pubquiz"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pubquiz"."eventreihe_verwaltung" ADD CONSTRAINT "eventreihe_verwaltung_eventreihe_id_fkey" FOREIGN KEY ("eventreihe_id") REFERENCES "pubquiz"."eventreihen"("eventreihe_id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE pubquiz.benutzer_eventartrollen ADD CONSTRAINT eventartrolle_editor_manager CHECK (rolle IN ('EDITOR', 'EVENT_MANAGER'));
INSERT INTO pubquiz.eventarten (kennung, name) VALUES ('QUIZ', 'Quiz'), ('BINGO', 'Bingo'), ('POWERPOINT_KARAOKE', 'PowerPoint-Karaoke');
-- Only existing series get Quiz. Newly created series are fail-closed by default.
INSERT INTO pubquiz.eventreihe_eventarten (eventreihe_id, eventart, ist_freigeschaltet)
SELECT eventreihe_id, 'QUIZ', true FROM pubquiz.eventreihen;
-- Assignments are authoritative; no fallback from users.role or legacy memberships.
INSERT INTO pubquiz.benutzer_eventartrollen (benutzer_id,eventreihe_id,eventart,rolle,zugewiesen_von_user_id,created_at,updated_at)
SELECT benutzer_id,eventreihe_id,'QUIZ',rolle,zugewiesen_von_user_id,created_at,updated_at
FROM pubquiz.benutzer_rollenzuweisungen WHERE scope_typ='EVENT_SERIES';
INSERT INTO pubquiz.eventreihe_verwaltung (benutzer_id,eventreihe_id,zugewiesen_von_user_id,created_at,updated_at)
SELECT benutzer_id,eventreihe_id,zugewiesen_von_user_id,created_at,updated_at
FROM pubquiz.benutzer_rollenzuweisungen WHERE scope_typ='EVENT_SERIES' AND rolle='EVENT_MANAGER';
-- Old application instances must not mutate obsolete sources after the backfill.
-- Only the new transactional compatibility projector may write series mirrors.
CREATE FUNCTION pubquiz.guard_legacy_event_roles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'benutzer_rollenzuweisungen' THEN
    IF TG_OP = 'DELETE' AND OLD.scope_typ = 'GLOBAL' THEN RETURN OLD; END IF;
    IF TG_OP = 'INSERT' AND NEW.scope_typ = 'GLOBAL' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.scope_typ = 'GLOBAL' AND NEW.scope_typ = 'GLOBAL' THEN RETURN NEW; END IF;
  END IF;
  IF current_setting('pubquiz.event_type_projection', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Eventartrechte-Matrix erforderlich; Legacy-Reihenschreibzugriff gesperrt' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_legacy_scope_roles BEFORE INSERT OR UPDATE OR DELETE ON pubquiz.benutzer_rollenzuweisungen
FOR EACH ROW EXECUTE FUNCTION pubquiz.guard_legacy_event_roles();
CREATE TRIGGER guard_legacy_memberships BEFORE INSERT OR UPDATE OR DELETE ON pubquiz.eventreihe_benutzerrollen
FOR EACH ROW EXECUTE FUNCTION pubquiz.guard_legacy_event_roles();
COMMIT;
