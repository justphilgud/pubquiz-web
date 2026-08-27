import {
  resolveQuizAnswerInteraction,
  type QuizAnswerInteractionInput,
  type ResolvedQuizAnswerInteraction,
} from "@/app/quiz/answerInteraction";

export const QUIZ_RESULT_DISPLAY_MODES = ["STANDARD", "LIVE"] as const;
export type QuizResultDisplayMode = (typeof QUIZ_RESULT_DISPLAY_MODES)[number];

const LIVE_INTERACTION_TYPES = new Set<ResolvedQuizAnswerInteraction["type"]>([
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "POLL_SINGLE",
  "POLL_MULTI",
  "POLL_SCALE",
  "TEXT",
]);

const EXCLUDED_TEXT_TEMPLATES = new Set([
  "pixelbild",
  "image_pixel",
  "facemorph",
  "face_morph",
]);

export function isQuizResultDisplayMode(value: unknown): value is QuizResultDisplayMode {
  return QUIZ_RESULT_DISPLAY_MODES.some((mode) => mode === value);
}

export function supportsLiveResultInteraction(input: {
  interactionType: ResolvedQuizAnswerInteraction["type"];
  templateId?: string | null;
}) {
  if (!LIVE_INTERACTION_TYPES.has(input.interactionType)) return false;
  return input.interactionType !== "TEXT" ||
    !EXCLUDED_TEXT_TEMPLATES.has(input.templateId?.trim().toLocaleLowerCase("de-DE") ?? "");
}

export function supportsLiveResultQuestion(
  input: QuizAnswerInteractionInput,
) {
  const interaction = resolveQuizAnswerInteraction(input);
  return supportsLiveResultInteraction({
    interactionType: interaction.type,
    templateId: input.templateId,
  });
}
