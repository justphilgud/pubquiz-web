import type { QuizInteractionState } from "@/app/quiz/interaction/interactionStateMachine";

export function canToggleLiveResultVisibility(state: QuizInteractionState) {
  return state === "CLOSED";
}

export function canCloseLiveResultAnswerPhase(state: QuizInteractionState) {
  return state === "OPEN" || state === "COUNTDOWN";
}

export function isLiveResultVisibleToAudience(
  state: QuizInteractionState,
  requestedVisibility: boolean,
) {
  return state === "CLOSED" && requestedVisibility;
}

export function canIncludeLiveResultAggregates(input: {
  state: QuizInteractionState;
  requestedVisibility: boolean;
  includeModeration: boolean;
}) {
  return input.includeModeration ||
    isLiveResultVisibleToAudience(input.state, input.requestedVisibility) ||
    input.state === "REVEALED";
}
