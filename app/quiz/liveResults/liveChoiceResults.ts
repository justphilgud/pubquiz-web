import type { ResolvedQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import type { QuizInteractionPayload } from "@/app/quiz/interaction/interactionPayload";
import type { QuizInteractionState } from "@/app/quiz/interaction/interactionStateMachine";

export type LiveChoiceInteraction = Extract<
  ResolvedQuizAnswerInteraction,
  { type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "POLL_SINGLE" | "POLL_MULTI" | "POLL_SCALE" }
>;

export type LiveChoiceResultState = {
  kind: "CHOICE";
  visible: boolean;
  state: QuizInteractionState;
  finalAnswers: number;
  totalTeams: number;
  options: Array<{ id: number; label: string; count: number; share: number }>;
  scale: {
    values: Array<{ value: number; count: number; share: number }>;
    average: number | null;
  } | null;
  moderationResponses?: Array<{
    responseKey: string;
    teamId: number;
    teamName: string;
    avatarCode: import("@/app/teams/teamProfile").TeamAvatarCode;
    photoUrl: string | null;
    labels: string[];
    status: "DRAFT" | "FINAL";
  }>;
};

export function isLiveChoiceInteraction(
  interaction: ResolvedQuizAnswerInteraction,
): interaction is LiveChoiceInteraction {
  return ["SINGLE_CHOICE", "MULTI_CHOICE", "POLL_SINGLE", "POLL_MULTI", "POLL_SCALE"].includes(
    interaction.type,
  );
}

function share(count: number, finalAnswers: number) {
  return finalAnswers > 0 ? Math.round((count / finalAnswers) * 1_000) / 10 : 0;
}

export function aggregateLiveChoiceResults(input: {
  interaction: LiveChoiceInteraction;
  visible: boolean;
  state: QuizInteractionState;
  totalTeams: number;
  payloads: readonly QuizInteractionPayload[];
  moderationResponses?: LiveChoiceResultState["moderationResponses"];
}): LiveChoiceResultState {
  const finalAnswers = input.payloads.length;
  if (input.interaction.type === "POLL_SCALE") {
    const values = input.payloads.flatMap((payload) =>
      "value" in payload && typeof payload.value === "number" ? [payload.value] : [],
    );
    return {
      kind: "CHOICE",
      visible: input.visible,
      state: input.state,
      finalAnswers,
      totalTeams: input.totalTeams,
      options: [],
      scale: {
        values: input.interaction.values.map((value) => {
          const count = values.filter((candidate) => candidate === value).length;
          return { value, count, share: share(count, finalAnswers) };
        }),
        average: values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null,
      },
      ...(input.moderationResponses ? { moderationResponses: input.moderationResponses } : {}),
    };
  }

  const selectedIds = input.payloads.flatMap((payload) => {
    if ("optionId" in payload) return payload.optionId === null ? [] : [payload.optionId];
    if ("optionIds" in payload) return payload.optionIds;
    return [];
  });
  return {
    kind: "CHOICE",
    visible: input.visible,
    state: input.state,
    finalAnswers,
    totalTeams: input.totalTeams,
    options: input.interaction.options.map((option) => {
      const count = selectedIds.filter((id) => id === option.id).length;
      return { ...option, count, share: share(count, finalAnswers) };
    }),
    scale: null,
    ...(input.moderationResponses ? { moderationResponses: input.moderationResponses } : {}),
  };
}
