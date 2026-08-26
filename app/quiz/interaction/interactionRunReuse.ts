import type { QuizInteractionState } from "./interactionStateMachine";

export function shouldReuseQuestionInteractionRun(input: {
  state: QuizInteractionState;
  liveResultsEnabled: boolean;
  stoppedPixelRunReusable: boolean;
}) {
  return input.state === "OPEN" ||
    input.state === "COUNTDOWN" ||
    input.stoppedPixelRunReusable ||
    (input.liveResultsEnabled && input.state === "CLOSED");
}
