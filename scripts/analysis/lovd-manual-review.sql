-- Read-only, one MVCC statement. Change only the quiz id in target.
-- No participant names, identifiers, answer contents or reversible hashes leave SQL.
-- Equality classes are local ordinal numbers, scoped to the question assignment.
WITH target AS (SELECT 37 AS quiz_id), questions AS (
 SELECT q.quiz_fragen_id id,q.sortierung position,q.quiz_abschnitt_id section,
   q.punkte_modus points_mode,q.freie_antwort_erlaubt allow_free,
   COALESCE(v.code,'standard') template,
   EXISTS(SELECT 1 FROM pubquiz.quiz_interaction_runs r WHERE r.quiz_fragen_id=q.quiz_fragen_id) played,
   (SELECT count(*)::int FROM pubquiz.frage_antwortfelder f2 WHERE f2.fragen_id=f.fragen_id) field_count,
   COALESCE((SELECT jsonb_agg(jsonb_build_object('isCorrect',o.ist_richtig)) FROM pubquiz.antworten o WHERE o.fragen_id=f.fragen_id),'[]') options
 FROM pubquiz.quiz_fragen q JOIN target t USING(quiz_id)
 JOIN pubquiz.fragen f USING(fragen_id) LEFT JOIN pubquiz.frage_vorlagen v USING(vorlage_id)
), effective AS (
 SELECT q.*,a.team_antwort_id IS NOT NULL draft,
   a.interaction_run_id IS NULL AND a.team_antwort_id IS NOT NULL legacy,
   s.team_answer_submission_id IS NOT NULL OR (a.interaction_run_id IS NULL AND a.team_antwort_id IS NOT NULL) submitted,
   CASE WHEN a.interaction_run_id IS NULL THEN
     CASE WHEN EXISTS(SELECT 1 FROM pubquiz.team_antwortfelder af WHERE af.team_antwort_id=a.team_antwort_id)
       THEN 'STRUCTURED_TEXT' WHEN a.antwort_id IS NOT NULL THEN 'SINGLE_CHOICE' ELSE 'TEXT' END
     ELSE s.interaction_type END kind,
   CASE WHEN a.interaction_run_id IS NULL THEN
     CASE WHEN EXISTS(SELECT 1 FROM pubquiz.team_antwortfelder af WHERE af.team_antwort_id=a.team_antwort_id)
       THEN (SELECT jsonb_object_agg(af.antwortfeld_id::text,af.antwort_text) FROM pubquiz.team_antwortfelder af WHERE af.team_antwort_id=a.team_antwort_id)
       WHEN a.antwort_id IS NOT NULL THEN jsonb_build_object('optionId',a.antwort_id)
       ELSE jsonb_build_object('text',a.antwort_text) END
     ELSE CASE WHEN s.interaction_type='STRUCTURED_TEXT' THEN s.payload->'fields'
       WHEN s.interaction_type='TEXT' THEN jsonb_build_object('text',s.payload->'text')
       ELSE s.payload END END content,
   a.bewertungsstatus status,a.bewertungsquelle source,
   a.auto_basis_punkte::text auto_base,a.auto_endpunkte::text auto_points,
   a.vergebene_punkte::text points,a.bewertungs_version version,
   a.bewertungsdetails IS NOT NULL details_present
 FROM questions q CROSS JOIN pubquiz.quiz_team_sessions team
 JOIN target t ON team.quiz_id=t.quiz_id
 LEFT JOIN pubquiz.team_antworten a ON a.quiz_fragen_id=q.id AND a.quiz_team_session_id=team.quiz_team_session_id
 LEFT JOIN LATERAL (SELECT s.* FROM pubquiz.team_answer_submissions s
   WHERE s.team_antwort_id=a.team_antwort_id AND s.interaction_run_id=a.interaction_run_id
   ORDER BY s.submission_version DESC,s.team_answer_submission_id DESC LIMIT 1) s ON true
), variants AS (
 SELECT *,dense_rank() OVER(PARTITION BY id ORDER BY kind,content)::int variant,
   CASE WHEN kind='TEXT' THEN COALESCE(length(btrim(content->>'text'))>0,false)
     WHEN kind='STRUCTURED_TEXT' THEN EXISTS(SELECT 1 FROM jsonb_each_text(content) f WHERE length(btrim(f.value))>0)
     ELSE false END text_content
 FROM effective
), classified AS (
 SELECT *,submitted AND version=3 AND auto_base IS NOT NULL AND auto_points IS NOT NULL
   AND points IS NOT NULL AND status IS NOT NULL AND source IS NOT NULL
   AND (source<>'AUTO' OR details_present) complete
 FROM variants
), cohorts AS (
 SELECT *,played AND submitted AND NOT(complete AND source<>'MANUAL' AND status='CORRECT') visible,
   played AND submitted AND (source='MANUAL' OR (complete AND status='REVIEW_REQUIRED' AND source<>'MANUAL')) evidence
 FROM classified
), identical AS (
 SELECT id,kind,variant,count(*)::int members,
   count(*) FILTER(WHERE evidence)::int evidence_members,
   count(*) FILTER(WHERE complete AND status='REVIEW_REQUIRED' AND source<>'MANUAL')::int unresolved_members,
   count(DISTINCT (status,points)) FILTER(WHERE evidence)>1 conflict
 FROM cohorts WHERE visible AND text_content AND kind IN ('TEXT','STRUCTURED_TEXT')
 GROUP BY id,kind,variant
)
SELECT statement_timestamp() captured_at,q.id,q.position,q.section,q.template,q.points_mode,q.allow_free,q.field_count,q.options,q.played,
 count(*)::int cells,count(*) FILTER(WHERE c.submitted)::int answered,
 count(*) FILTER(WHERE c.draft AND NOT c.submitted)::int unsubmitted_drafts,
 count(*) FILTER(WHERE c.legacy)::int legacy,
 count(*) FILTER(WHERE q.played AND NOT c.submitted)::int unanswered,
 count(*) FILTER(WHERE q.played AND c.submitted AND NOT c.complete)::int pending,
 count(*) FILTER(WHERE q.played AND c.complete AND c.source<>'MANUAL' AND c.status='CORRECT')::int automatic_correct,
 count(*) FILTER(WHERE c.visible)::int filtered,
 count(*) FILTER(WHERE q.played AND c.submitted AND c.source='MANUAL')::int manual,
 count(*) FILTER(WHERE q.played AND c.complete AND c.source<>'MANUAL' AND c.status='REVIEW_REQUIRED')::int unresolved,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('members',i.members,'manualOrReview',i.evidence_members,'unresolved',i.unresolved_members,'conflict',i.conflict) ORDER BY i.members DESC,i.evidence_members DESC,i.unresolved_members DESC,i.conflict)
 FROM identical i WHERE i.id=q.id),'[]') groups
FROM questions q JOIN cohorts c USING(id)
GROUP BY q.id,q.position,q.section,q.template,q.points_mode,q.allow_free,q.field_count,q.options,q.played
ORDER BY q.position,q.id;

