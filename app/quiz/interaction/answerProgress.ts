import type { Prisma } from "@/app/generated/prisma/client";
import { hasAnswerContentChanged } from "../evaluation/answerContent";
import { selectEffectiveLiveSubmissions } from "../liveResults/effectiveLiveSubmissions";
import { interactionPayloadToDraft, validateInteractionPayload, type QuizInteractionPayload } from "./interactionPayload";
import { draftInputFromStored, readInteractionSnapshot } from "./interactionStoredAnswer";

export type ProgressAnswer = Parameters<typeof draftInputFromStored>[0] & {
  quiz_team_session_id: number;
  interaction_run_id: number | null;
  draft_updated_at: Date | null;
  aktualisiert_am: Date;
  submissions: {
    team_answer_submission_id: number;
    interaction_run_id: number;
    submission_version: number;
    submitted_at: Date;
    payload: Prisma.JsonValue;
  }[];
};

// Read projection only: persisted live content and effective final snapshots are
// two stages of the existing interaction, never extra submissions or evaluations.
export function resolveAnswerProgress(input: {
  teamSessionIds: readonly number[];
  run: { interaction_run_id: number; config_snapshot: Prisma.JsonValue } | null;
  answers: readonly ProgressAnswer[];
}) {
  const activeTeams = new Set(input.teamSessionIds);
  const answered = new Set<number>();
  const finalized = new Set<number>();
  let letzteAntwortAt: Date | null = null;
  const interaction = input.run ? readInteractionSnapshot(input.run.config_snapshot) : null;
  for (const answer of input.answers) {
    if (!activeTeams.has(answer.quiz_team_session_id)) continue;
    if (answer.interaction_run_id !== (input.run?.interaction_run_id ?? null)) continue;
    const draft = draftInputFromStored(answer);
    const final = input.run
      ? selectEffectiveLiveSubmissions({ interactionRunId: input.run.interaction_run_id, answers: [answer] })[0]
      : undefined;
    const hasDraft = interaction
      ? validateInteractionPayload(interaction, draft).hasContent
      : hasAnswerContentChanged({ answerText: null, selectedAnswerIds: [], structuredAnswers: [] }, draft);
    const finalDraft = final && interaction
      ? interactionPayloadToDraft(interaction, final.payload as QuizInteractionPayload) : null;
    const hasFinal = Boolean(finalDraft && interaction && validateInteractionPayload(interaction, {
      answerText: finalDraft.antwortText,
      selectedAnswerIds: "antwortIds" in finalDraft ? finalDraft.antwortIds ?? [] : [],
      structuredAnswers: Object.entries(finalDraft.antwortfelder).map(([id, value]) => ({ fieldId: Number(id), answerText: value })),
    }).hasContent);
    if (hasFinal) finalized.add(answer.quiz_team_session_id);
    if (!hasDraft && !hasFinal) continue;
    answered.add(answer.quiz_team_session_id);
    const date = hasDraft ? answer.draft_updated_at ?? answer.aktualisiert_am : final!.submitted_at;
    if (!letzteAntwortAt || date > letzteAntwortAt) letzteAntwortAt = date;
  }
  return {
    teamsAngemeldet: activeTeams.size,
    antwortenEingegangen: answered.size,
    finaleAntworten: finalized.size,
    prozent: activeTeams.size ? Math.round(answered.size / activeTeams.size * 100) : 0,
    letzteAntwortAt,
  };
}
