import type { ResolvedQuizAnswerInteraction } from "@/app/quiz/answerInteraction";

export type TeamAnswerDraftInput = {
  answerText: string | null;
  selectedAnswerIds: readonly number[];
  structuredAnswers: readonly {
    fieldId: number;
    answerText: string | null;
  }[];
};

export type QuizInteractionPayload =
  | { text: string }
  | { fields: Record<string, string> }
  | { value: string | number | null }
  | { optionId: number | null }
  | { optionIds: number[] }
  | { itemIds: string[] };

export type ValidatedInteractionPayload = {
  payload: QuizInteractionPayload;
  hasContent: boolean;
};

function assertNoDuplicateNumbers(values: readonly number[]) {
  if (new Set(values).size !== values.length) {
    throw new Error("Antwortoptionen d\u00fcrfen nicht doppelt vorkommen.");
  }
}

function assertAllowedAnswerIds(
  requested: readonly number[],
  allowed: readonly number[],
) {
  assertNoDuplicateNumbers(requested);
  const allowedIds = new Set(allowed);
  if (requested.some((id) => !allowedIds.has(id))) {
    throw new Error("Die \u00fcbermittelten Antwortoptionen sind ung\u00fcltig.");
  }
}

export function validateInteractionPayload(
  interaction: ResolvedQuizAnswerInteraction,
  draft: TeamAnswerDraftInput,
): ValidatedInteractionPayload {
  if (interaction.type === "NO_ANSWER" || "supported" in interaction) {
    throw new Error("Diese Interaktion nimmt keine Teamantwort entgegen.");
  }

  if (interaction.type === "TEXT") {
    const text = draft.answerText ?? "";
    return { payload: { text }, hasContent: text.trim().length > 0 };
  }

  if (interaction.type === "NUMBER") {
    const value = draft.answerText?.trim() ?? "";
    if (value && !Number.isFinite(Number(value))) {
      throw new Error("Der Sch\u00e4tzwert ist keine g\u00fcltige Zahl.");
    }
    return { payload: { value }, hasContent: value.length > 0 };
  }
  if (interaction.type === "POLL_SCALE") {
    const rawValue = draft.answerText?.trim() ?? "";
    if (!rawValue) return { payload: { value: null }, hasContent: false };
    const value = Number(rawValue);
    const stepPosition = (value - interaction.min) / interaction.step;
    if (
      !Number.isFinite(value) ||
      value < interaction.min ||
      value > interaction.max ||
      !Number.isInteger(Math.round(stepPosition * 1_000_000) / 1_000_000)
    ) {
      throw new Error("Der Skalenwert ist ungültig.");
    }
    return { payload: { value }, hasContent: true };
  }

  if (interaction.type === "STRUCTURED_TEXT") {
    const allowedFields = new Set(interaction.fields.map((field) => field.id));
    const fields: Record<string, string> = {};
    for (const field of draft.structuredAnswers) {
      if (!allowedFields.has(field.fieldId)) {
        throw new Error("Die \u00fcbermittelten Antwortfelder sind ung\u00fcltig.");
      }
      fields[String(field.fieldId)] = field.answerText?.trim() ?? "";
    }
    return {
      payload: { fields },
      hasContent: Object.values(fields).some((value) => value.length > 0),
    };
  }

  if (
    interaction.type === "SINGLE_CHOICE" ||
    interaction.type === "POLL_SINGLE"
  ) {
    assertAllowedAnswerIds(
      draft.selectedAnswerIds,
      interaction.options.map((option) => option.id),
    );
    if (draft.selectedAnswerIds.length > 1) {
      throw new Error("Es darf nur eine Antwortoption ausgew\u00e4hlt werden.");
    }
    const optionId = draft.selectedAnswerIds[0] ?? null;
    return { payload: { optionId }, hasContent: optionId !== null };
  }

  if (
    interaction.type === "MULTI_CHOICE" ||
    interaction.type === "POLL_MULTI"
  ) {
    assertAllowedAnswerIds(
      draft.selectedAnswerIds,
      interaction.options.map((option) => option.id),
    );
    return {
      payload: { optionIds: [...draft.selectedAnswerIds] },
      hasContent: draft.selectedAnswerIds.length > 0,
    };
  }

  const expectedIds = interaction.items.map((item) => item.id);
  let itemIds: string[] = [];
  if (draft.answerText) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft.answerText);
    } catch {
      throw new Error("Die Reihenfolge ist kein g\u00fcltiges JSON.");
    }
    if (
      !Array.isArray(parsed) ||
      parsed.length !== expectedIds.length ||
      !parsed.every((entry) => typeof entry === "string") ||
      new Set(parsed).size !== parsed.length ||
      parsed.some((entry) => !expectedIds.includes(entry))
    ) {
      throw new Error("Die \u00fcbermittelte Reihenfolge ist ung\u00fcltig.");
    }
    itemIds = parsed;
  }
  return {
    payload: { itemIds },
    hasContent: itemIds.length > 0,
  };
}

export function interactionPayloadToDraft(
  interaction: ResolvedQuizAnswerInteraction,
  payload: QuizInteractionPayload,
) {
  if (interaction.type === "TEXT" && "text" in payload) {
    return { antwortText: payload.text, antwortId: null, antwortfelder: {} };
  }
  if (interaction.type === "NUMBER" && "value" in payload) {
    return { antwortText: String(payload.value ?? ""), antwortId: null, antwortfelder: {} };
  }
  if (interaction.type === "POLL_SCALE" && "value" in payload) {
    return { antwortText: payload.value === null ? "" : String(payload.value), antwortId: null, antwortfelder: {} };
  }
  if (interaction.type === "STRUCTURED_TEXT" && "fields" in payload) {
    return {
      antwortText: null,
      antwortId: null,
      antwortfelder: Object.fromEntries(
        Object.entries(payload.fields).map(([key, value]) => [Number(key), value]),
      ),
    };
  }
  if ((interaction.type === "SINGLE_CHOICE" || interaction.type === "POLL_SINGLE") && "optionId" in payload) {
    return {
      antwortText: null,
      antwortId: payload.optionId,
      antwortIds: payload.optionId === null ? [] : [payload.optionId],
      antwortfelder: {},
    };
  }
  if ((interaction.type === "MULTI_CHOICE" || interaction.type === "POLL_MULTI") && "optionIds" in payload) {
    return {
      antwortText: null,
      antwortId: null,
      antwortIds: payload.optionIds,
      antwortfelder: {},
    };
  }
  if (interaction.type === "ORDER" && "itemIds" in payload) {
    return {
      antwortText: JSON.stringify(payload.itemIds),
      antwortId: null,
      antwortfelder: {},
    };
  }
  throw new Error("Interaction Payload und Interaction Contract passen nicht zusammen.");
}
