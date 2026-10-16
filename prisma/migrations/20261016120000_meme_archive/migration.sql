-- Additive only. No historical backfill and no runtime cascade into this archive.
CREATE TABLE pubquiz.meme_archive_sources (
  source_id integer PRIMARY KEY,
  quiz_id integer NOT NULL REFERENCES pubquiz.quiz(quiz_id) ON DELETE RESTRICT,
  lifecycle_revision integer NOT NULL,
  quiz_question_id integer,
  quiz_title text NOT NULL,
  question_text text NOT NULL,
  image_url text NOT NULL,
  layout jsonb NOT NULL,
  image_bytes bytea
);
CREATE INDEX meme_archive_sources_quiz_id_lifecycle_revision_idx ON pubquiz.meme_archive_sources(quiz_id,lifecycle_revision);
CREATE TABLE pubquiz.meme_archive_entries (
  entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id integer NOT NULL REFERENCES pubquiz.meme_archive_sources(source_id) ON DELETE CASCADE,
  submission_id integer NOT NULL UNIQUE,
  session_id integer NOT NULL,
  team_id integer NOT NULL,
  team_name text NOT NULL,
  submission_version integer NOT NULL,
  payload jsonb NOT NULL,
  submitted_at timestamp(3) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','READY','ERROR','DELETING','DELETED')),
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  blob_url text,
  encryption_key bytea,
  png_sha256 text,
  png_size integer,
  pending_file bytea,
  UNIQUE(source_id,session_id,submission_version)
);
CREATE INDEX meme_archive_entries_source_id_session_id_idx ON pubquiz.meme_archive_entries(source_id,session_id);

CREATE FUNCTION pubquiz.archive_meme_submission(candidate pubquiz.team_answer_submissions) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r pubquiz.quiz_interaction_runs%ROWTYPE;
BEGIN
  IF candidate.interaction_type <> 'MEME_CAPTION' OR candidate.status::text NOT IN ('SUBMITTED','AUTO_FINALIZED') THEN RETURN false; END IF;
  SELECT * INTO STRICT r FROM pubquiz.quiz_interaction_runs WHERE interaction_run_id=candidate.interaction_run_id;
  -- Same lock order as answer finalization and reset. No media I/O in this transaction.
  PERFORM quiz_id FROM pubquiz.quiz WHERE quiz_id=r.quiz_id FOR UPDATE;
  INSERT INTO pubquiz.meme_archive_sources(source_id,quiz_id,lifecycle_revision,quiz_question_id,quiz_title,question_text,image_url,layout)
  SELECT r.interaction_run_id,r.quiz_id,COALESCE(s.lifecycle_revision,0),r.quiz_fragen_id,q.titel,
    COALESCE(f.frage,'Meme'),r.config_snapshot->'interaction'->>'imageUrl',
    COALESCE(r.config_snapshot->'interaction'->'layout','{"version":1,"mode":"STANDARD"}'::jsonb)
  FROM pubquiz.quiz q
  LEFT JOIN pubquiz.quiz_praesentation_status s ON s.quiz_id=q.quiz_id
  LEFT JOIN pubquiz.quiz_fragen qf ON qf.quiz_fragen_id=r.quiz_fragen_id
  LEFT JOIN pubquiz.fragen f ON f.fragen_id=qf.fragen_id
  WHERE q.quiz_id=r.quiz_id
  ON CONFLICT(source_id) DO NOTHING;
  INSERT INTO pubquiz.meme_archive_entries(source_id,submission_id,session_id,team_id,team_name,submission_version,payload,submitted_at)
  SELECT r.interaction_run_id,candidate.team_answer_submission_id,candidate.quiz_team_session_id,s.team_id,s.teamname,candidate.submission_version,candidate.payload,candidate.submitted_at
  FROM pubquiz.quiz_team_sessions s WHERE s.quiz_team_session_id=candidate.quiz_team_session_id
  ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
CREATE FUNCTION pubquiz.capture_confirmed_meme() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pubquiz.archive_meme_submission(NEW);
  RETURN NEW;
END $$;
CREATE TRIGGER capture_confirmed_meme AFTER INSERT ON pubquiz.team_answer_submissions
FOR EACH ROW EXECUTE FUNCTION pubquiz.capture_confirmed_meme();

CREATE FUNCTION pubquiz.assert_meme_archive_reset_safe(target_quiz integer) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  PERFORM quiz_id FROM pubquiz.quiz WHERE quiz_id=target_quiz FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM pubquiz.team_answer_submissions a JOIN pubquiz.quiz_interaction_runs r USING(interaction_run_id)
    LEFT JOIN pubquiz.meme_archive_entries e ON e.submission_id=a.team_answer_submission_id
    WHERE r.quiz_id=target_quiz AND a.interaction_type='MEME_CAPTION' AND e.entry_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM pubquiz.meme_archive_sources s JOIN pubquiz.meme_archive_entries e USING(source_id)
    WHERE s.quiz_id=target_quiz AND s.image_bytes IS NULL AND e.status NOT IN ('DELETED')
  ) THEN RAISE EXCEPTION 'Meme-Archiv noch nicht gesichert. Bitte Meme-Archiv öffnen und Bildsicherung wiederholen; der Durchlauf bleibt erhalten.'; END IF;
  RETURN true;
END $$;
