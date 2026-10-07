import type { Client, PoolClient } from "pg";
import { resolveCanonicalQuestionTemplateId } from "../../fragen/editor/templates/questionTemplateRegistry";
import { normalizeQuestionTemplateConfig } from "../../fragen/editor/pixelTemplateConfig";
import { buildQuestionTemplateRuntimeModel } from "../../fragen/editor/templates/questionTemplateRuntime";

export type AnalysisTemplate = {
  id: number; code: string; name: string; kind: string; status: string;
  active: boolean; baseCode: string | null;
};
export type AnalysisMedium = {
  id: number; file: string; type: string; slot: string | null;
  owner: "QUESTION" | "ANSWER" | "ANSWER_FIELD";
  answerId: number | null; answerFieldId: number | null; position: number;
};
export type AnalysisQuestion = {
  id: number; text: string; source: string | null;
  reviewStatus: "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";
  archived: boolean; approved: boolean; incomplete: boolean;
  template: AnalysisTemplate | null; sourceTemplate: AnalysisTemplate | null;
  canonicalTemplate: string;
  solutions: string[];
  categories: { id: number; name: string; status: string }[];
  media: AnalysisMedium[];
  answers: { id: number; text: string; correct: boolean; explanation: string | null }[];
  answerFields: { id: number; label: string; position: number;
    solutions: { text: string; accepted: boolean; position: number }[] }[];
  scope: "GLOBAL" | "EVENT_SERIES"; eventSeriesIds: number[];
  difficulty: string | null; validUntil: string | null; reviewFrom: string | null;
  templateConfig: unknown;
  quizUsages: { quizId: number; title: string | null; archived: boolean;
    eventSeriesId: number; assignmentId: number; sectionId: number | null; position: number | null }[];
};
export type AnalysisQuiz = {
  id: number; title: string | null; eventSeriesId: number; date: string | null;
  archived: boolean;
  sections: { id: number; title: string; type: string; position: number }[];
  assignments: { id: number; questionId: number; sectionId: number | null;
    position: number | null; storedAnswerOrder: number[] }[];
};
export type QuizAnalysisSnapshot = {
  capturedAt: string; questions: AnalysisQuestion[]; quizzes: AnalysisQuiz[];
  templates: AnalysisTemplate[]; categories: { id: number; name: string; status: string }[];
  eventSeries: { id: number; name: string; archived: boolean }[];
};

const templateJson = (alias: string) => `CASE WHEN ${alias}.vorlage_id IS NULL THEN NULL ELSE
 jsonb_build_object('id',${alias}.vorlage_id,'code',${alias}.code,'name',${alias}.name,
 'kind',${alias}.art,'status',${alias}.status,'active',${alias}.ist_aktiv,'baseCode',${alias}.basis_code) END`;

// Static SQL reads only editorial content. No users, teams, responses, runs,
// presentation status or repair services participate in this projection.
export const ANALYSIS_QUESTIONS_SQL = `SELECT jsonb_build_object(
 'id',q.fragen_id,'text',q.frage,'source',q.quelle,'reviewStatus',q.review_status,
 'archived',q.ist_archiviert,'approved',q.freigegeben,'incomplete',q.ist_unfertig,
 'template',${templateJson("t")},'sourceTemplate',${templateJson("st")},
 'scope',q.geltungsbereich,'difficulty',q.schwierigkeitslevel::text,
 'validUntil',q.gueltig_bis::text,'reviewFrom',q.pruefen_ab::text,'templateConfig',q.template_config_json,
 'eventSeriesIds',COALESCE((SELECT jsonb_agg(e.eventreihe_id ORDER BY e.eventreihe_id)
   FROM pubquiz.fragen_eventreihen e WHERE e.fragen_id=q.fragen_id),'[]'::jsonb),
 'categories',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.fragenkategorie_id,
   'name',c.kategorie,'status',c.status) ORDER BY c.fragenkategorie_id)
   FROM pubquiz.fragen_kategorien qc JOIN pubquiz.fragenkategorie c USING(fragenkategorie_id)
   WHERE qc.fragen_id=q.fragen_id),'[]'::jsonb),
 'answers',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.antwort_id,'text',a.antwort,
   'correct',a.ist_richtig,'explanation',a.zusatzinformation) ORDER BY a.antwort_id)
   FROM pubquiz.antworten a WHERE a.fragen_id=q.fragen_id),'[]'::jsonb),
 'answerFields',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.antwortfeld_id,
   'label',f.label,'position',f.sortierung,'solutions',COALESCE((SELECT jsonb_agg(
   jsonb_build_object('text',s.loesung_text,'accepted',s.ist_akzeptiert,'position',s.sortierung)
   ORDER BY s.sortierung,s.loesung_id) FROM pubquiz.frage_antwortfeld_loesungen s
   WHERE s.antwortfeld_id=f.antwortfeld_id),'[]'::jsonb)) ORDER BY f.sortierung,f.antwortfeld_id)
   FROM pubquiz.frage_antwortfelder f WHERE f.fragen_id=q.fragen_id),'[]'::jsonb),
 'media',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.medien_id,'file',m.datei,
   'type',mt.medientyp,'slot',m.slot_key,'answerId',m.antwort_id,'answerFieldId',m.antwortfeld_id,
   'position',m.sortierung,'owner',CASE WHEN m.antwort_id IS NOT NULL THEN 'ANSWER'
   WHEN m.antwortfeld_id IS NOT NULL THEN 'ANSWER_FIELD' ELSE 'QUESTION' END)
   ORDER BY m.sortierung,m.medien_id) FROM pubquiz.medien m JOIN pubquiz.medientyp mt USING(medientyp_id)
   WHERE m.fragen_id=q.fragen_id OR m.antwort_id IN (SELECT a.antwort_id FROM pubquiz.antworten a WHERE a.fragen_id=q.fragen_id)
   OR m.antwortfeld_id IN (SELECT f.antwortfeld_id FROM pubquiz.frage_antwortfelder f WHERE f.fragen_id=q.fragen_id)), '[]'::jsonb)
 ) AS value FROM pubquiz.fragen q LEFT JOIN pubquiz.frage_vorlagen t ON t.vorlage_id=q.vorlage_id
 LEFT JOIN pubquiz.frage_vorlagen st ON st.vorlage_id=q.source_vorlage_id ORDER BY q.fragen_id`;

export const ANALYSIS_QUIZZES_SQL = `SELECT jsonb_build_object('id',q.quiz_id,'title',q.titel,
 'eventSeriesId',q.eventreihe_id,'date',q.quiz_datum::text,'archived',q.ist_archiviert,
 'sections',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.quiz_abschnitt_id,'title',s.titel,
 'type',s.abschnitt_typ,'position',s.sortierung) ORDER BY s.sortierung,s.quiz_abschnitt_id)
 FROM pubquiz.quiz_abschnitte s WHERE s.quiz_id=q.quiz_id),'[]'::jsonb),
 'assignments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.quiz_fragen_id,'questionId',a.fragen_id,
 'sectionId',a.quiz_abschnitt_id,'position',a.sortierung,'storedAnswerOrder',a.antwort_reihenfolge)
 ORDER BY a.sortierung NULLS LAST,a.quiz_fragen_id) FROM pubquiz.quiz_fragen a WHERE a.quiz_id=q.quiz_id),'[]'::jsonb)
 ) AS value FROM pubquiz.quiz q ORDER BY q.quiz_id`;

export function canonicalAnalysisTemplate(template: AnalysisTemplate | null): string {
  const id = resolveCanonicalQuestionTemplateId(template?.baseCode ?? template?.code ?? null);
  return id === "multiple_choice" ? "standard" : id ?? "standard";
}

/** The caller supplies an exclusively checked-out connection, never a Pool. */
export async function readQuizAnalysis(client: Pick<Client | PoolClient, "query">): Promise<QuizAnalysisSnapshot> {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const state = await client.query<{ capturedAt: string; readOnly: string }>(
      `SELECT transaction_timestamp()::text AS "capturedAt", current_setting('transaction_read_only') AS "readOnly"`,
    );
    if (state.rows[0]?.readOnly !== "on") throw new Error("ANALYSIS_TRANSACTION_NOT_READ_ONLY");
    const questions = (await client.query<{ value: Omit<AnalysisQuestion, "canonicalTemplate" | "solutions" | "quizUsages"> }>(ANALYSIS_QUESTIONS_SQL)).rows
      .map(({ value }) => {
        const canonicalTemplate = canonicalAnalysisTemplate(value.template);
        const runtime = buildQuestionTemplateRuntimeModel({ templateId: canonicalTemplate,
          questionText: value.text, templateConfig: normalizeQuestionTemplateConfig(value.templateConfig, canonicalTemplate),
          correctAnswers: value.answers.filter(answer => answer.correct).map(answer => ({ text: answer.text, additionalInfo: answer.explanation })) });
        const solutions = [...new Set([...runtime.solutionLines,
          ...value.answerFields.flatMap(field => field.solutions.filter(solution => solution.accepted)
            .map(solution => `${field.label}: ${solution.text}`))].filter(Boolean))];
        return { ...value, canonicalTemplate, solutions, quizUsages: [] as AnalysisQuestion["quizUsages"] };
      });
    const quizzes = (await client.query<{ value: AnalysisQuiz }>(ANALYSIS_QUIZZES_SQL)).rows.map(({ value }) => value);
    const usages = new Map<number, AnalysisQuestion["quizUsages"]>();
    for (const quiz of quizzes) for (const assignment of quiz.assignments) {
      const entries = usages.get(assignment.questionId) ?? [];
      entries.push({ quizId: quiz.id, title: quiz.title, archived: quiz.archived,
        eventSeriesId: quiz.eventSeriesId, assignmentId: assignment.id,
        sectionId: assignment.sectionId, position: assignment.position });
      usages.set(assignment.questionId, entries);
    }
    for (const question of questions) question.quizUsages = usages.get(question.id) ?? [];
    const templates = (await client.query<{ value: AnalysisTemplate }>(
      `SELECT ${templateJson("t")} AS value FROM pubquiz.frage_vorlagen t ORDER BY t.vorlage_id`,
    )).rows.map(({ value }) => value);
    const categories = (await client.query<{ id: number; name: string; status: string }>(
      `SELECT fragenkategorie_id AS id,kategorie AS name,status::text AS status FROM pubquiz.fragenkategorie ORDER BY fragenkategorie_id`,
    )).rows;
    const eventSeries = (await client.query<{ id: number; name: string; archived: boolean }>(
      `SELECT eventreihe_id AS id,name,ist_archiviert AS archived FROM pubquiz.eventreihen ORDER BY eventreihe_id`,
    )).rows;
    return { capturedAt: state.rows[0].capturedAt, questions, quizzes, templates, categories, eventSeries };
  } finally {
    // Never commit: the snapshot is an observation, not an editorial operation.
    await client.query("ROLLBACK");
  }
}
