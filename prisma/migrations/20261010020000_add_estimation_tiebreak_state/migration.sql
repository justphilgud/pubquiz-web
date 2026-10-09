-- Independent rank refinement; no regular questions, answers or scores are modified.
ALTER TABLE pubquiz.quiz_praesentation_status ADD COLUMN stichentscheid_json JSONB;
