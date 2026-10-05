import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";

export type ParticipantRevealContext = {
  state: string | null | undefined;
  isHidden: boolean;
  openedAt: Date | null;
  releasedAt: Date | null;
};

// A finalized/evaluated answer is not a solution release. A prior run is not a
// release in a new block epoch, even when its stored state remains REVEALED.
export function isParticipantSolutionReleased(context: ParticipantRevealContext) {
  return context.state === "REVEALED" && !context.isHidden &&
    context.openedAt !== null && context.releasedAt !== null &&
    context.openedAt.getTime() >= context.releasedAt.getTime();
}

export function projectParticipantQuestionContent(
  config: QuestionTemplateConfig | null,
  answers: readonly { antwort_id: number; antwort: string; ist_richtig: boolean }[],
  context: ParticipantRevealContext,
) {
  const data = config?.templateData;
  // This is an allowlist, deliberately not a copy of the editorial config.
  // The form contract already carries every required non-facts input setting.
  const templateConfig = data?.kind === "FACTS"
    ? { templateData: {
        kind: "FACTS" as const,
        response: data.response,
        facts: data.facts.map(fact => ({ id: fact.id, text: fact.text })),
      } }
    : null;
  let resolution: { answers: string[]; correctOptionIds: number[] } | null = null;
  if (isParticipantSolutionReleased(context)) {
    const correct = answers.filter(answer => answer.ist_richtig);
    const canonical = data?.kind === "FACTS" ? data.solution
      : data?.kind === "TRUE_FALSE" ? data.correctAnswer ? "Wahr" : "Falsch"
      : data?.kind === "ESTIMATE" && data.correctValue !== null ? String(data.correctValue)
      : null;
    resolution = {
      answers: canonical !== null ? [canonical] : correct.map(answer => answer.antwort),
      correctOptionIds: correct.map(answer => answer.antwort_id),
    };
  }
  return { templateConfig, resolution };
}

const PARTICIPANT_HINT_MEDIA_SLOTS = new Set<string | null>([
  null, "question_image", "question_audio", "question_video", "face_morph_result",
  "pixel_result_image", "pixel_stage_1_image", "pixel_stage_2_image", "pixel_stage_3_image",
  "music_reverse_audio", "music_bitcrush_audio",
]);
const PARTICIPANT_SOLUTION_MEDIA_SLOTS = new Set([
  "answer_image", "pixel_original_image", "face_morph_person_a_original", "face_morph_person_b_original",
  "music_original_audio",
]);
export function canPublishParticipantMedium(slot: string | null, context: ParticipantRevealContext) {
  return PARTICIPANT_HINT_MEDIA_SLOTS.has(slot) ||
    (slot !== null && PARTICIPANT_SOLUTION_MEDIA_SLOTS.has(slot) && isParticipantSolutionReleased(context));
}
