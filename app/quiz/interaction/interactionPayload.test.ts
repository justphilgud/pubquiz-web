import assert from "node:assert/strict";
import test from "node:test";

import type { ResolvedQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import {
  interactionPayloadToDraft,
  type TeamAnswerDraftInput,
  validateInteractionPayload,
} from "./interactionPayload";

const emptyDraft: TeamAnswerDraftInput = {
  answerText: null,
  selectedAnswerIds: [] as number[],
  structuredAnswers: [] as { fieldId: number; answerText: string | null }[],
};

function validate(
  interaction: ResolvedQuizAnswerInteraction,
  draft: Partial<TeamAnswerDraftInput>,
) {
  return validateInteractionPayload(interaction, { ...emptyDraft, ...draft });
}

test("normalizes text, number and structured text snapshots", () => {
  assert.deepEqual(
    validate(
      { type: "TEXT", multiline: true, inputMode: "text", placeholder: "" },
      { answerText: "Berlin" },
    ),
    { payload: { text: "Berlin" }, hasContent: true },
  );
  assert.deepEqual(
    validate(
      { type: "NUMBER", inputMode: "decimal", step: "any", unit: "km" },
      { answerText: " 12.5 " },
    ),
    { payload: { value: "12.5" }, hasContent: true },
  );
  const structured = {
    type: "STRUCTURED_TEXT" as const,
    multiline: false as const,
    inputMode: "text" as const,
    fields: [
      { id: 10, key: "artist", label: "Interpret", required: true, placeholder: "" },
      { id: 11, key: "title", label: "Titel", required: true, placeholder: "" },
    ],
  };
  const result = validate(structured, {
    structuredAnswers: [
      { fieldId: 10, answerText: " Queen " },
      { fieldId: 11, answerText: "Radio Ga Ga" },
    ],
  });
  assert.deepEqual(result.payload, {
    fields: { "10": "Queen", "11": "Radio Ga Ga" },
  });
  assert.deepEqual(interactionPayloadToDraft(structured, result.payload), {
    antwortText: null,
    antwortId: null,
    antwortfelder: { 10: "Queen", 11: "Radio Ga Ga" },
  });
});

test("validates single and multiple choice against the contract", () => {
  const single = {
    type: "SINGLE_CHOICE" as const,
    selectionMode: "SINGLE" as const,
    options: [{ id: 1, label: "A" }, { id: 2, label: "B" }],
  };
  assert.deepEqual(validate(single, { selectedAnswerIds: [2] }), {
    payload: { optionId: 2 },
    hasContent: true,
  });
  assert.throws(
    () => validate(single, { selectedAnswerIds: [1, 2] }),
    /nur eine Antwortoption/,
  );
  const multi = {
    type: "MULTI_CHOICE" as const,
    selectionMode: "MULTIPLE" as const,
    options: single.options,
  };
  assert.deepEqual(validate(multi, { selectedAnswerIds: [1, 2] }), {
    payload: { optionIds: [1, 2] },
    hasContent: true,
  });
  assert.throws(
    () => validate(multi, { selectedAnswerIds: [3] }),
    /ung\u00fcltig/,
  );
});

test("accepts only a complete ordering permutation", () => {
  const order = {
    type: "ORDER" as const,
    scoringPolicy: "POSITION" as const,
    items: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
  };
  assert.deepEqual(validate(order, { answerText: '["b","a"]' }), {
    payload: { itemIds: ["b", "a"] },
    hasContent: true,
  });
  assert.throws(
    () => validate(order, { answerText: '["a","a"]' }),
    /Reihenfolge.*ung\u00fcltig/,
  );
});

test("keeps empty drafts distinguishable from finalizable answers", () => {
  const text = {
    type: "TEXT" as const,
    multiline: true as const,
    inputMode: "text" as const,
    placeholder: "",
  };
  assert.equal(validate(text, { answerText: "   " }).hasContent, false);
});
