-- Update planned assignments only; never rewrite played scores or active quizzes.
UPDATE pubquiz.quiz_fragen AS qf
SET punkte_basis = 1
FROM pubquiz.fragen AS f
JOIN pubquiz.frage_vorlagen AS v ON v.vorlage_id = f.vorlage_id
WHERE qf.fragen_id = f.fragen_id
  AND lower(trim(v.code)) IN ('eight_bit', 'music-8bit', 'musik_8bit')
  AND qf.punkte_basis <> 1
  AND NOT EXISTS (
    SELECT 1 FROM pubquiz.quiz_praesentation_status AS ps
    WHERE ps.quiz_id = qf.quiz_id
      AND (ps.quiz_started_at IS NOT NULL OR ps.quiz_stopped_at IS NOT NULL)
  )
  AND NOT EXISTS (
    SELECT 1 FROM pubquiz.quiz_interaction_runs AS r WHERE r.quiz_id = qf.quiz_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM pubquiz.team_antworten AS a
    JOIN pubquiz.quiz_fragen AS played ON played.quiz_fragen_id = a.quiz_fragen_id
    WHERE played.quiz_id = qf.quiz_id
  );
