BEGIN;

-- Different former format roles cannot be collapsed without a deliberate decision.

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM pubquiz.benutzer_eventartrollen GROUP BY benutzer_id,eventreihe_id HAVING COUNT(DISTINCT rolle)>1) THEN

    RAISE EXCEPTION 'Widersprüchliche Eventartrollen: vor Übernahme fachlich auflösen';

  END IF;

END $$;

CREATE TABLE pubquiz.benutzer_reihenrollen (

  benutzer_id INTEGER NOT NULL REFERENCES pubquiz.users(id) ON DELETE CASCADE,

  eventreihe_id INTEGER NOT NULL REFERENCES pubquiz.eventreihen(eventreihe_id) ON DELETE CASCADE,

  rolle pubquiz."RoleAssignmentRole" NOT NULL CHECK (rolle IN ('EDITOR','EVENT_MANAGER')),

  zugewiesen_von_user_id INTEGER,

  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT benutzer_reihenrollen_pkey PRIMARY KEY (benutzer_id,eventreihe_id)

);

CREATE INDEX benutzer_reihenrollen_eventreihe_id_idx ON pubquiz.benutzer_reihenrollen(eventreihe_id);

-- Old rows remain as historical evidence; source/audit information is preserved.

INSERT INTO pubquiz.benutzer_reihenrollen

SELECT DISTINCT ON (benutzer_id,eventreihe_id) benutzer_id,eventreihe_id,rolle,zugewiesen_von_user_id,created_at,updated_at

FROM pubquiz.benutzer_eventartrollen ORDER BY benutzer_id,eventreihe_id,created_at,eventart;

CREATE FUNCTION pubquiz.reject_obsolete_format_role_write() RETURNS trigger LANGUAGE plpgsql AS $$

BEGIN

  -- New canonical writer may maintain compatibility mirrors; old matrix writers may not.
  IF current_setting('pubquiz.event_type_projection', true)='on' THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  -- Parent deletion may still cascade; never block ordinary user/series cleanup.

  IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;

  RAISE EXCEPTION 'Rollen werden je Eventreihe beim Benutzer gepflegt' USING ERRCODE='42501';

END $$;

CREATE TRIGGER reject_obsolete_format_roles BEFORE INSERT OR UPDATE OR DELETE ON pubquiz.benutzer_eventartrollen

FOR EACH ROW EXECUTE FUNCTION pubquiz.reject_obsolete_format_role_write();

COMMIT;

