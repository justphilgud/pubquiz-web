import type { ResolvedQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import type { QuizInteractionPayload } from "./interactionPayload";

export type PollInteraction = Extract<
  ResolvedQuizAnswerInteraction,
  { type: "POLL_SINGLE" | "POLL_MULTI" | "POLL_SCALE" }
>;

export type PollLiveState = {
  interactionType: PollInteraction["type"];
  state: "LOCKED" | "OPEN" | "COUNTDOWN" | "CLOSED" | "REVEALED";
  finalAnswers: number;
  totalTeams: number;
  options: Array<{ id: number; label: string; count: number; share: number }>;
  scale: {
    values: Array<{ value: number; count: number; share: number }>;
    average: number | null;
  } | null;
};

export function isPollInteractionType(value: string): value is PollInteraction["type"] {
  return value === "POLL_SINGLE" || value === "POLL_MULTI" || value === "POLL_SCALE";
}

function percentage(count: number, totalTeams: number) {
  return totalTeams > 0 ? Math.round((count / totalTeams) * 1_000) / 10 : 0;
}

export function aggregatePollSubmissions(input: {
  interaction: PollInteraction;
  state: PollLiveState["state"];
  totalTeams: number;
  payloads: readonly QuizInteractionPayload[];
}): PollLiveState {
  const { interaction, state, totalTeams, payloads } = input;
  if (interaction.type === "POLL_SCALE") {
    const submittedValues = payloads.flatMap((payload) =>
      "value" in payload && typeof payload.value === "number"
        ? [payload.value]
        : [],
    );
    return {
      interactionType: interaction.type,
      state,
      finalAnswers: submittedValues.length,
      totalTeams,
      options: [],
      scale: {
        values: interaction.values.map((value) => {
          const count = submittedValues.filter((candidate) => candidate === value).length;
          return { value, count, share: percentage(count, totalTeams) };
        }),
        average: submittedValues.length > 0
          ? submittedValues.reduce((sum, value) => sum + value, 0) / submittedValues.length
          : null,
      },
    };
  }

  const selectedIds = payloads.flatMap((payload) => {
    if (interaction.type === "POLL_SINGLE" && "optionId" in payload) {
      return payload.optionId === null ? [] : [payload.optionId];
    }
    if (interaction.type === "POLL_MULTI" && "optionIds" in payload) {
      return payload.optionIds;
    }
    return [];
  });
  return {
    interactionType: interaction.type,
    state,
    finalAnswers: payloads.length,
    totalTeams,
    options: interaction.options.map((option) => {
      const count = selectedIds.filter((id) => id === option.id).length;
      return { ...option, count, share: percentage(count, totalTeams) };
    }),
    scale: null,
  };
}
