import type { QuizInteractionState } from "@/app/quiz/interaction/interactionStateMachine";

export function canToggleLiveResultVisibility(state: QuizInteractionState) {
  return state === "OPEN" || state === "COUNTDOWN" || state === "CLOSED";
}

export function canCloseLiveResultAnswerPhase(state: QuizInteractionState) {
  return state === "OPEN" || state === "COUNTDOWN";
}
