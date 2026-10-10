import { Prisma } from "@/app/generated/prisma/client";
import { lockQuizLifecycle } from "./quizLifecycle.server";
import { createTiebreakState, readTiebreakState, type TiebreakState } from "./estimationTiebreak";

/** Shared by the authorized actions and real PostgreSQL transaction tests. */
export async function verifiedState(tx: Prisma.TransactionClient, quizId: number) {
  const status = await lockQuizLifecycle(tx, quizId);
  if (!status.slide_key || !(/^(section:\d+:final)$/.test(status.slide_key) || /:FINAL_STANDINGS$/.test(status.slide_key))) throw new Error("Stichentscheid ist ausschließlich beim Endstand verfügbar.");
  const outstanding = await tx.team_antworten.count({ where: { quiz_id: quizId, bewertungsstatus: "REVIEW_REQUIRED" } });
  if (outstanding) throw new Error("Reguläre Bewertung zuerst abschließen.");
  const [sessions, totals] = await Promise.all([
    tx.quiz_team_sessions.findMany({ where: { quiz_id: quizId }, select: { quiz_team_session_id: true } }),
    tx.team_antworten.groupBy({ by: ["quiz_team_session_id"], where: { quiz_id: quizId }, _sum: { vergebene_punkte: true } }),
  ]);
  const standings = sessions.map(team => ({ sessionId: team.quiz_team_session_id, points: Number(totals.find(total => total.quiz_team_session_id === team.quiz_team_session_id)?._sum.vergebene_punkte ?? 0) })).sort((a, b) => a.sessionId - b.sessionId);
  const state = readTiebreakState(status.stichentscheid_json) ?? createTiebreakState(standings);
  const canonicalStandings = (rows: typeof standings) => rows.map(team => [team.sessionId, team.points]);
  if (JSON.stringify(canonicalStandings(state.standings)) !== JSON.stringify(canonicalStandings(standings))) throw new Error("Reguläre Punkte oder Teams wurden nach Beginn des Stichentscheids geändert.");
  return state;
}

export function tiebreakJson(state: TiebreakState): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
}
