"use server";

import { prisma } from "@/app/lib/prisma";
import { requireQuizLiveController } from "./quizAccess.server";
import { verifiedState, tiebreakJson as json } from "./estimationTiebreakStore.server";
import { resolveParticipantSession } from "./participantSession.server";
import { validateInteractionPayload } from "./interaction/interactionPayload";
import { buildQuestionEligibilityWhere } from "@/app/fragen/editor/questionEligibility.server";
import { getBerlinDate } from "@/app/lib/berlinDate";
import { projectTiebreak, readTiebreakState, revealTiebreakRound, saveTiebreakAnswer, startTiebreakRound, unresolvedTiebreakGroups } from "./estimationTiebreak";

export async function getModeratorTiebreak(quizId: number) {
  await requireQuizLiveController(quizId);
  return prisma.$transaction(async tx => projectTiebreak(await verifiedState(tx, quizId)));
}

export async function startEstimationTiebreak(quizId: number) {
  const access = await requireQuizLiveController(quizId);
  return prisma.$transaction(async tx => {
    let state = await verifiedState(tx, quizId);
    if (!unresolvedTiebreakGroups(state).length) throw new Error("Kein offener Punktgleichstand vorhanden.");
    if (!state.rounds.some(round => round.state === "OPEN")) {
      const used = await tx.quiz_fragen.findMany({ where: { quiz_id: quizId }, select: { fragen_id: true } });
      const excluded = [...used.map(question => question.fragen_id), ...state.rounds.map(round => round.questionId)];
      const candidates = await tx.fragen.findMany({ where: { ...buildQuestionEligibilityWhere(access.ownership.eventSeriesId!, getBerlinDate()), review_status: "APPROVED", fragen_id: { notIn: excluded }, vorlage: { code: "schaetzfrage" } }, select: { fragen_id: true, frage: true, template_config_json: true }, orderBy: { fragen_id: "asc" } });
      const selected = candidates.flatMap(question => {
        const config = question.template_config_json as { templateData?: { kind?: string; correctValue?: number; unit?: string } } | null;
        const data = config?.templateData;
        return data?.kind === "ESTIMATE" && typeof data.correctValue === "number" && Number.isFinite(data.correctValue) && typeof data.unit === "string" && data.unit.trim() && question.frage
          ? [{ questionId: question.fragen_id, question: question.frage, correctValue: data.correctValue, unit: data.unit }] : [];
      })[0];
      if (!selected) throw new Error("Keine freigegebene, unbenutzte Schätzfrage mit Zahlenlösung und Einheit verfügbar. Bitte im Frageneditor anlegen oder freigeben.");
      state = startTiebreakRound(state, selected);
    }
    const round = state.rounds.at(-1)!;
    await tx.quiz_praesentation_status.update({ where: { quiz_id: quizId }, data: { stichentscheid_json: json(state), show_schaetzfrage: true, zeige_schaetzantwort: false, schaetzfrage_id: round.questionId } });
    return projectTiebreak(state);
  });
}

export async function revealEstimationTiebreak(quizId: number, roundId: number) {
  await requireQuizLiveController(quizId);
  return prisma.$transaction(async tx => {
    const current = await verifiedState(tx, quizId);
    if (current.rounds.at(-1)?.id !== roundId) throw new Error("Veraltete Stichrunde. Bitte neu laden.");
    const state = revealTiebreakRound(current, roundId);
    await tx.quiz_praesentation_status.update({ where: { quiz_id: quizId }, data: { stichentscheid_json: json(state), show_schaetzfrage: true, zeige_schaetzantwort: true, schaetzfrage_id: state.rounds.at(-1)!.questionId } });
    return projectTiebreak(state);
  });
}

export async function hideEstimationTiebreak(quizId: number) {
  await requireQuizLiveController(quizId);
  return prisma.$transaction(async tx => {
    const state = await verifiedState(tx, quizId);
    if (state.rounds.at(-1)?.state !== "REVEALED") throw new Error("Offene Stichrunde zuerst schließen und auflösen.");
    await tx.quiz_praesentation_status.update({ where: { quiz_id: quizId }, data: { show_schaetzfrage: false, zeige_schaetzantwort: false } });
    return projectTiebreak(state);
  });
}

export async function getParticipantTiebreak(quizId: number, token: string) {
  const session = await resolveParticipantSession(quizId, token);
  if (!session) throw new Error("Team-Sitzung nicht autorisiert.");
  const status = await prisma.quiz_praesentation_status.findUnique({ where: { quiz_id: quizId }, select: { stichentscheid_json: true, show_schaetzfrage: true } });
  const state = readTiebreakState(status?.stichentscheid_json);
  return state && status?.show_schaetzfrage ? projectTiebreak(state, session.quiz_team_session_id) : null;
}

export async function submitEstimationTiebreak(input: { quizId: number; token: string; roundId: number; answerText: string; expectedRevision: number }) {
  const session = await resolveParticipantSession(input.quizId, input.token);
  if (!session) throw new Error("Team-Sitzung nicht autorisiert.");
  return prisma.$transaction(async tx => {
    const state = await verifiedState(tx, input.quizId);
    const round = state.rounds.at(-1);
    if (!round) throw new Error("Keine Stichrunde geöffnet.");
    const validated = validateInteractionPayload({ type: "NUMBER", inputMode: "decimal", step: "any", unit: round.unit }, { answerText: input.answerText, selectedAnswerIds: [], structuredAnswers: [] });
    const value = "value" in validated.payload ? validated.payload.value : null;
    if (!validated.hasContent || value === null || value === "") throw new Error("Bitte eine gültige Schätzung eingeben.");
    const next = saveTiebreakAnswer(state, { roundId: input.roundId, sessionId: session.quiz_team_session_id, value: Number(value), expectedRevision: input.expectedRevision });
    await tx.quiz_praesentation_status.update({ where: { quiz_id: input.quizId }, data: { stichentscheid_json: json(next) } });
    return projectTiebreak(next, session.quiz_team_session_id);
  });
}
