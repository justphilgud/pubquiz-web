import { prisma } from "@/app/lib/prisma";
import { resolveAnswerProgress } from "./answerProgress";

// One consistent database snapshot, including across a concurrent AP1 reset.
// This reader must never call run synchronization or assignment repair.
export async function getQuizAnswerProgress(quizId: number, quizFragenId: number | null) {
  return prisma.$transaction(async (db) => {
    const teams = await db.quiz_team_sessions.findMany({
      where: { quiz_id: quizId }, select: { quiz_team_session_id: true },
    });
    const run = quizFragenId === null ? null : await db.quiz_interaction_runs.findFirst({
      where: { quiz_id: quizId, quiz_fragen_id: quizFragenId },
      orderBy: { interaction_run_id: "desc" },
      select: { interaction_run_id: true, config_snapshot: true },
    });
    const answers = quizFragenId === null ? [] : await db.team_antworten.findMany({
      where: { quiz_id: quizId, quiz_fragen_id: quizFragenId, interaction_run_id: run?.interaction_run_id ?? null },
      select: {
        quiz_team_session_id: true, interaction_run_id: true,
        antwort_text: true, antwort_id: true, draft_updated_at: true, aktualisiert_am: true,
        antwortauswahlen: { select: { antwort_id: true } },
        antwortfelder: { select: { antwortfeld_id: true, antwort_text: true } },
        submissions: {
          where: { interaction_run_id: run?.interaction_run_id ?? -1 },
          orderBy: [{ submission_version: "desc" }, { team_answer_submission_id: "desc" }],
          take: 1,
          select: { team_answer_submission_id: true, interaction_run_id: true,
            submission_version: true, submitted_at: true, payload: true },
        },
      },
    });
    return resolveAnswerProgress({ teamSessionIds: teams.map((team) => team.quiz_team_session_id), run, answers });
  }, { isolationLevel: "RepeatableRead" });
}
