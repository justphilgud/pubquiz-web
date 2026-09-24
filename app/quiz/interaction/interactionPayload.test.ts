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

test("validates poll payloads with the productive payload shapes", () => {
  const options = [{ id: 1, label: "A" }, { id: 2, label: "B" }];
  assert.deepEqual(validate({ type: "POLL_SINGLE", selectionMode: "SINGLE", options }, { selectedAnswerIds: [2] }), {
    payload: { optionId: 2 }, hasContent: true,
  });
  assert.deepEqual(validate({ type: "POLL_MULTI", selectionMode: "MULTIPLE", options }, { selectedAnswerIds: [1, 2] }), {
    payload: { optionIds: [1, 2] }, hasContent: true,
  });
  const scale = { type: "POLL_SCALE" as const, inputMode: "decimal" as const, min: 1, max: 5, step: 1, minLabel: "", maxLabel: "", values: [1, 2, 3, 4, 5] };
  assert.deepEqual(validate(scale, { answerText: "4" }), { payload: { value: 4 }, hasContent: true });
  assert.throws(() => validate(scale, { answerText: "4.5" }), /Skalenwert/);
  assert.deepEqual(interactionPayloadToDraft(scale, { value: 3 }), {
    antwortText: "3", antwortId: null, antwortfelder: {},
  });
});

test("validates structured meme captions and rejects malformed or overlong fields", () => {
  const meme = {
    type: "MEME_CAPTION" as const,
    imageUrl: "/medien/base.webp",
    maxLength: 80,
  };
  const result = validate(meme, {
    answerText: JSON.stringify({ topText: " Oben ", bottomText: "Unten" }),
  });
  assert.deepEqual(result, {
    payload: { topText: "Oben", bottomText: "Unten" },
    hasContent: true,
  });
  assert.equal(validate(meme, {
    answerText: JSON.stringify({ topText: " ", bottomText: "" }),
  }).hasContent, false);
  assert.throws(() => validate(meme, { answerText: "kein-json" }), /kein gültiges JSON/);
  assert.throws(() => validate(meme, {
    answerText: JSON.stringify({ topText: "x".repeat(81), bottomText: "" }),
  }), /höchstens 80 Zeichen/);
  assert.deepEqual(interactionPayloadToDraft(meme, result.payload), {
    antwortText: JSON.stringify({ topText: "Oben", bottomText: "Unten" }),
    antwortId: null,
    antwortfelder: {},
  });

  for (const field of ["topText", "bottomText"] as const) {
    for (const length of [79, 80]) {
      const payload = { topText: "", bottomText: "", [field]: "x".repeat(length) };
      assert.equal(validate(meme, { answerText: JSON.stringify(payload) }).hasContent, true);
    }
    const payload = { topText: "", bottomText: "", [field]: "x".repeat(81) };
    assert.throws(
      () => validate(meme, { answerText: JSON.stringify(payload) }),
      /höchstens 80 Zeichen/,
    );
  }
});

test("validates custom caption maps against the snapshotted zone contract", () => {
  const meme = {
    type: "MEME_CAPTION" as const,
    imageUrl: "/medien/base.webp",
    maxLength: 80,
    layout: {
      version: 1 as const,
      mode: "CUSTOM" as const,
      zones: [{ id: "bubble", label: "Sprechblase", placement: "IMAGE" as const, x: 50, y: 5, width: 40, height: 30, order: 1, maxLines: 2 as const, required: true }],
    },
  };
  const result = validate(meme, { answerText: JSON.stringify({ captions: { bubble: " Hallo " } }) });
  assert.deepEqual(result, { payload: { captions: { bubble: "Hallo" } }, hasContent: true });
  assert.throws(() => validate(meme, { answerText: JSON.stringify({ captions: { unknown: "Text" } }) }), /Caption-Zonen/);
  assert.throws(() => validate(meme, { answerText: JSON.stringify({ captions: { bubble: "" } }) }), /erforderlichen/);
  assert.deepEqual(interactionPayloadToDraft(meme, result.payload), {
    antwortText: JSON.stringify({ captions: { bubble: "Hallo" } }),
    antwortId: null,
    antwortfelder: {},
  });
});
