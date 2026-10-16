import "server-only";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireQuizViewer } from "@/app/quiz/quizAccess.server";
import { compareDifficultyRow, type DifficultyAuditRow } from "./difficultyAudit";

export async function readQuizDifficultyAudit(quizId: number) {
  if (!Number.isSafeInteger(quizId) || quizId <= 0) throw new Error("Ungültige Quiz-ID.");
  await requireQuizViewer(quizId);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const quiz = await tx.quiz.findUniqueOrThrow({ where: { quiz_id: quizId }, select: { titel: true } });
    // Fixed, parameterized aggregate projection. No participant identifiers or answer contents leave the DB.
    const rows = await tx.$queryRaw<DifficultyAuditRow[]>`
      WITH counts AS (
        SELECT a.quiz_fragen_id,
          COUNT(*) FILTER (WHERE a.bewertungsstatus = 'CORRECT')::int raw_correct,
          COUNT(*) FILTER (WHERE a.bewertungsstatus IN ('WRONG','PARTIAL'))::int raw_wrong,
          COUNT(*) FILTER (WHERE a.bewertungsstatus = 'CORRECT' AND
            (a.interaction_run_id IS NULL OR EXISTS (SELECT 1 FROM pubquiz.team_answer_submissions s WHERE s.team_antwort_id=a.team_antwort_id AND s.interaction_run_id=a.interaction_run_id)))::int submitted_correct,
          COUNT(*) FILTER (WHERE a.bewertungsstatus IN ('WRONG','PARTIAL') AND
            (a.interaction_run_id IS NULL OR EXISTS (SELECT 1 FROM pubquiz.team_answer_submissions s WHERE s.team_antwort_id=a.team_antwort_id AND s.interaction_run_id=a.interaction_run_id)))::int submitted_wrong,
          COUNT(*) FILTER (WHERE a.bewertungsstatus='UNANSWERED')::int unanswered,
          COUNT(*) FILTER (WHERE a.bewertungsstatus='PARTIAL')::int partial,
          COUNT(*) FILTER (WHERE a.bewertungsstatus='REVIEW_REQUIRED')::int review_required
        FROM pubquiz.team_antworten a
        JOIN pubquiz.quiz_fragen q ON q.quiz_fragen_id=a.quiz_fragen_id
        JOIN pubquiz.quiz_team_sessions t ON t.quiz_team_session_id=a.quiz_team_session_id
        WHERE q.quiz_id=${quizId} AND (q.punkte_modus <> 'risikofrage' OR q.risiko_pool_fixiert_am IS NULL OR t.erstellt_am <= q.risiko_pool_fixiert_am)
        GROUP BY a.quiz_fragen_id
      )
      SELECT q.quiz_fragen_id assignment_id, f.fragen_id question_id, COALESCE(v.code,'standard') template,
        q.richtigeantworten stored_correct, q.falscheantworten stored_wrong, f.schwierigkeitslevel::text stored_difficulty,
        COALESCE(c.raw_correct,0) raw_correct, COALESCE(c.raw_wrong,0) raw_wrong,
        COALESCE(c.submitted_correct,0) submitted_correct, COALESCE(c.submitted_wrong,0) submitted_wrong,
        COALESCE(c.unanswered,0) unanswered, COALESCE(c.partial,0) partial, COALESCE(c.review_required,0) review_required,
        (SELECT COALESCE(SUM(x.richtigeantworten),0)::int FROM pubquiz.quiz_fragen x WHERE x.fragen_id=f.fragen_id) global_correct,
        (SELECT COALESCE(SUM(x.falscheantworten),0)::int FROM pubquiz.quiz_fragen x WHERE x.fragen_id=f.fragen_id) global_wrong,
        (SELECT COUNT(*)::int FROM pubquiz.quiz_fragen x WHERE x.fragen_id=f.fragen_id) usages
      FROM pubquiz.quiz_fragen q JOIN pubquiz.fragen f ON f.fragen_id=q.fragen_id
      LEFT JOIN pubquiz.frage_vorlagen v ON v.vorlage_id=f.vorlage_id LEFT JOIN counts c ON c.quiz_fragen_id=q.quiz_fragen_id
      WHERE q.quiz_id=${quizId} ORDER BY q.quiz_fragen_id`;
    return { title: quiz.titel, rows: rows.map(compareDifficultyRow), observedAt: new Date().toISOString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}
