export const quizInteractionStates = [
  "LOCKED",
  "OPEN",
  "COUNTDOWN",
  "CLOSED",
  "REVEALED",
] as const;

export type QuizInteractionState = (typeof quizInteractionStates)[number];

const allowedTransitions: Readonly<
  Record<QuizInteractionState, readonly QuizInteractionState[]>
> = {
  LOCKED: ["OPEN"],
  OPEN: ["COUNTDOWN", "CLOSED"],
  COUNTDOWN: ["OPEN", "CLOSED"],
  CLOSED: ["REVEALED"],
  REVEALED: [],
};

export function canTransitionQuizInteraction(
  from: QuizInteractionState,
  to: QuizInteractionState,
) {
  return from === to || allowedTransitions[from].includes(to);
}

export function assertQuizInteractionTransition(
  from: QuizInteractionState,
  to: QuizInteractionState,
) {
  if (!canTransitionQuizInteraction(from, to)) {
    throw new Error(`Ung\u00fcltiger Interaction-\u00dcbergang: ${from} \u2192 ${to}.`);
  }
}

export function isQuizInteractionWritable(
  state: QuizInteractionState,
  deadlineAt: Date | null,
  serverNow: Date,
) {
  if (state === "OPEN") return true;
  return state === "COUNTDOWN" && Boolean(deadlineAt && deadlineAt > serverNow);
}
