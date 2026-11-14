DO $migration$
BEGIN
  -- Serialize the planned updates with quiz start and interaction writes.
  PERFORM quiz_id
  FROM pubquiz.quiz
  WHERE quiz_id IN (37, 39)
  ORDER BY quiz_id
  FOR UPDATE;

  UPDATE pubquiz.frage_vorlagen
  SET konfiguration_json = konfiguration_json || '{"scoringTemplateId":"eight_bit"}'::jsonb,
      updated_at = CURRENT_TIMESTAMP
  WHERE code = 'dynamic_58391516-ff5b-4694-995f-f5b8d58d0785'
    AND art = 'DYNAMIC'
    AND basis_code = 'musik'
    AND konfiguration_json->>'version' = '1'
    AND konfiguration_json->>'scoringTemplateId' IS NULL;

  UPDATE pubquiz.quiz_fragen AS assignment
  SET punkte_basis = 1
  FROM (VALUES (466, 39, 1821), (469, 37, 1819), (470, 39, 1818))
    AS target(assignment_id, quiz_id, question_id)
  JOIN pubquiz.quiz AS quiz ON quiz.quiz_id = target.quiz_id
  JOIN pubquiz.fragen AS question ON question.fragen_id = target.question_id
  JOIN pubquiz.frage_vorlagen AS base ON base.vorlage_id = question.vorlage_id
  JOIN pubquiz.frage_vorlagen AS source ON source.vorlage_id = question.source_vorlage_id
  WHERE assignment.quiz_fragen_id = target.assignment_id
    AND assignment.quiz_id = target.quiz_id
    AND assignment.fragen_id = target.question_id
    AND assignment.punkte_basis = 0.5
    AND NOT quiz.ist_archiviert
    AND base.code = 'musik'
    AND source.code = 'dynamic_58391516-ff5b-4694-995f-f5b8d58d0785'
    AND source.art = 'DYNAMIC'
    AND source.basis_code = 'musik'
    AND source.konfiguration_json->>'version' = '1'
    AND source.konfiguration_json->>'scoringTemplateId' = 'eight_bit'
    AND NOT EXISTS (
      SELECT 1 FROM pubquiz.quiz_praesentation_status AS status
      WHERE status.quiz_id = assignment.quiz_id
        AND (status.quiz_started_at IS NOT NULL OR status.quiz_stopped_at IS NOT NULL)
    )
    AND NOT EXISTS (
      SELECT 1 FROM pubquiz.quiz_interaction_runs AS run
      WHERE run.quiz_fragen_id = assignment.quiz_fragen_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM pubquiz.team_antworten AS answer
      WHERE answer.quiz_fragen_id = assignment.quiz_fragen_id
    );
END;
$migration$;
