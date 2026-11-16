BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE meme_preparation_quizzes (quiz_id integer PRIMARY KEY) ON COMMIT DROP;

-- Use the same parent lock as the lifecycle. Recheck status and runs in the
-- next statement so it sees any start that committed while acquiring locks.
INSERT INTO meme_preparation_quizzes (quiz_id)
SELECT q.quiz_id
FROM pubquiz.quiz AS q
WHERE NOT q.ist_archiviert
  AND EXISTS (
    SELECT 1 FROM pubquiz.quiz_fragen AS f
    WHERE f.quiz_id = q.quiz_id
      AND (
        f.meme_config_json -> 'maxPresentedMemes' = '5'::jsonb
        OR f.meme_config_json -> 'responseDurationSeconds' = '90'::jsonb
      )
  )
ORDER BY q.quiz_id
FOR UPDATE OF q;

UPDATE pubquiz.quiz_fragen AS f
SET meme_config_json = f.meme_config_json
    || CASE WHEN f.meme_config_json -> 'maxPresentedMemes' = '5'::jsonb
            THEN '{"maxPresentedMemes":4}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN f.meme_config_json -> 'responseDurationSeconds' = '90'::jsonb
            THEN '{"responseDurationSeconds":120}'::jsonb ELSE '{}'::jsonb END
FROM meme_preparation_quizzes AS locked
WHERE f.quiz_id = locked.quiz_id
  AND NOT EXISTS (
    SELECT 1 FROM pubquiz.quiz_praesentation_status AS s
    WHERE s.quiz_id = f.quiz_id
      AND (s.quiz_started_at IS NOT NULL OR s.quiz_stopped_at IS NOT NULL)
  )
  AND NOT EXISTS (
    SELECT 1 FROM pubquiz.quiz_interaction_runs AS r WHERE r.quiz_id = f.quiz_id
  )
  AND jsonb_typeof(f.meme_config_json) = 'object'
  AND f.meme_config_json -> 'version' = '1'::jsonb
  AND CASE jsonb_typeof(f.meme_config_json -> 'maxPresentedMemes')
    WHEN 'null' THEN true
    WHEN 'number' THEN (f.meme_config_json ->> 'maxPresentedMemes')::numeric BETWEEN 1 AND 100
      AND mod((f.meme_config_json ->> 'maxPresentedMemes')::numeric, 1) = 0
    ELSE false
  END
  AND CASE COALESCE(f.meme_config_json -> 'timerEnabled', 'true'::jsonb)
    WHEN 'false'::jsonb THEN f.meme_config_json -> 'responseDurationSeconds' = 'null'::jsonb
    WHEN 'true'::jsonb THEN CASE jsonb_typeof(f.meme_config_json -> 'responseDurationSeconds')
      WHEN 'number' THEN (f.meme_config_json ->> 'responseDurationSeconds')::numeric BETWEEN 60 AND 600
        AND mod((f.meme_config_json ->> 'responseDurationSeconds')::numeric, 1) = 0
      ELSE false
    END
    ELSE false
  END
  AND (
    f.meme_config_json -> 'maxPresentedMemes' = '5'::jsonb
    OR f.meme_config_json -> 'responseDurationSeconds' = '90'::jsonb
  );

COMMIT;
