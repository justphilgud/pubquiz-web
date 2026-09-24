import assert from "node:assert/strict";
import test from "node:test";

import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { resolveParticipantInteractionFromSnapshot } from "@/app/quiz/interaction/interactionStoredAnswer";
import { buildQuestionTemplateRuntimeModel } from "@/app/fragen/editor/templates/questionTemplateRuntime";
import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";
import {
  resolveQuizAnswerInteraction,
  type QuizAnswerInteractionInput,
} from "./answerInteraction";
import { resolveQuizSpecificOrderingParticipantItems } from "./orderingQuestionOrder";

function resolve(
  input: Partial<QuizAnswerInteractionInput> &
    Pick<QuizAnswerInteractionInput, "templateId">,
) {
  return resolveQuizAnswerInteraction({
    originalAnswerMode: "OPEN",
    effectiveAnswerMode: "OPEN",
    answerFields: [],
    answerOptions: [],
    ...input,
  });
}

test("resolves open and closed standard questions from the executable contract", () => {
  assert.equal(resolve({ templateId: null }).type, "TEXT");

  const closed = resolve({
    templateId: "standard",
    originalAnswerMode: "CLOSED",
    effectiveAnswerMode: "CLOSED",
    answerOptions: [
      { id: 1, label: "Berlin" },
      { id: 2, label: "Bonn" },
    ],
  });
  assert.equal(closed.type, "SINGLE_CHOICE");
  assert.deepEqual(
    closed.type === "SINGLE_CHOICE" ? closed.options : [],
    [
      { id: 1, label: "Berlin" },
      { id: 2, label: "Bonn" },
    ],
  );
});

test("keeps legacy multiple_choice as MULTI_CHOICE", () => {
  const interaction = resolve({
    templateId: "multiple_choice",
    originalAnswerMode: "CLOSED",
    effectiveAnswerMode: "CLOSED",
    answerOptions: [
      { id: 1, label: "A" },
      { id: 2, label: "B" },
      { id: 3, label: "C" },
    ],
  });

  assert.equal(interaction.type, "MULTI_CHOICE");
  assert.equal(
    interaction.type === "MULTI_CHOICE"
      ? interaction.selectionMode
      : null,
    "MULTIPLE",
  );
});

test("FaceMorph keeps both named answer fields in the team interaction", () => {
  const interaction = resolve({
    templateId: questionTemplateIds.faceMorph,
    answerFields: [
      { id: 11, label: "Person A", required: true },
      { id: 12, label: "Person B", required: true },
    ],
  });

  assert.equal(interaction.type, "STRUCTURED_TEXT");
  assert.deepEqual(
    interaction.type === "STRUCTURED_TEXT"
      ? interaction.fields.map(({ id, label, required }) => ({ id, label, required }))
      : [],
    [
      { id: 11, label: "Person A", required: true },
      { id: 12, label: "Person B", required: true },
    ],
  );
});

test("resolves true/false and estimate inputs without template-specific UI logic", () => {
  assert.equal(
    resolve({
      templateId: questionTemplateIds.trueFalse,
      originalAnswerMode: "CLOSED",
      effectiveAnswerMode: "CLOSED",
      answerOptions: [
        { id: 1, label: "Wahr" },
        { id: 2, label: "Falsch" },
      ],
    }).type,
    "SINGLE_CHOICE",
  );

  const estimate = resolve({
    templateId: questionTemplateIds.estimate,
    templateData: {
      kind: "ESTIMATE",
      correctValue: 1989,
      unit: "Jahr",
      numberFormat: "YEAR",
      explanation: "",
      tolerance: null,
    },
  });
  assert.deepEqual(estimate, {
    type: "NUMBER",
    inputMode: "decimal",
    step: 1,
    unit: "Jahr",
  });
});

test("copies structured fields and falls back to text when legacy fields are absent", () => {
  const structured = resolve({
    templateId: questionTemplateIds.musicReverse,
    answerFields: [
      { id: 11, label: "Interpret", required: true },
      { id: 12, label: "Titel", required: true },
    ],
  });
  assert.equal(structured.type, "STRUCTURED_TEXT");
  assert.deepEqual(
    structured.type === "STRUCTURED_TEXT"
      ? structured.fields.map(({ id, label, required }) => ({
          id,
          label,
          required,
        }))
      : [],
    [
      { id: 11, label: "Interpret", required: true },
      { id: 12, label: "Titel", required: true },
    ],
  );
  assert.equal(
    resolve({ templateId: questionTemplateIds.musicReverse }).type,
    "TEXT",
  );
});

test("describes ordering as positional and keeps the stored item identifiers", () => {
  const templateConfig = {
    templateData: {
      kind: "ORDERING" as const,
      scoring: "EXACT" as const,
      items: [
        { id: "first", text: "Zuerst", explanation: "" },
        { id: "second", text: "Danach", explanation: "" },
      ],
    },
  } as QuestionTemplateConfig;
  const presentationItems = resolveQuizSpecificOrderingParticipantItems(
    [
      { antwort_id: 201, antwort: "Zuerst" },
      { antwort_id: 202, antwort: "Danach" },
    ],
    [202, 201],
  );
  const interaction = resolve({
    templateId: questionTemplateIds.ordering,
    originalAnswerMode: "CLOSED",
    effectiveAnswerMode: "CLOSED",
    templateData: templateConfig.templateData,
    orderingItems: presentationItems ?? [],
  });

  assert.deepEqual(interaction, {
    type: "ORDER",
    scoringPolicy: "POSITION",
    items: [
      { id: "202", text: "Danach" },
      { id: "201", text: "Zuerst" },
    ],
  });
  assert.deepEqual(
    interaction.type === "ORDER" ? interaction.items : [],
    presentationItems,
  );
  assert.deepEqual(
    buildQuestionTemplateRuntimeModel({
      templateId: questionTemplateIds.ordering,
      questionText: "Sortieren",
      templateConfig,
      correctAnswers: [],
    }).solutionLines,
    ["1. Zuerst", "2. Danach"],
  );
});

test("free-answer overrides and text-oriented reveal templates resolve to TEXT", () => {
  assert.equal(
    resolve({
      templateId: questionTemplateIds.trueFalse,
      originalAnswerMode: "CLOSED",
      effectiveAnswerMode: "OPEN",
    }).type,
    "TEXT",
  );
  assert.equal(
    resolve({ templateId: questionTemplateIds.pixelImage }).type,
    "TEXT",
  );
  assert.equal(
    resolve({ templateId: questionTemplateIds.musicEightBit }).type,
    "TEXT",
  );
});

test("NO_ANSWER and future text templates require no new renderer branch", () => {
  assert.equal(resolve({ templateId: "podium" }).type, "NO_ANSWER");
  assert.equal(resolve({ templateId: "future-country-flags" }).type, "TEXT");
});

test("resolves all poll contracts without falling back to question interactions", () => {
  const options = [{ id: 1, label: "A" }, { id: 2, label: "B" }];
  assert.equal(resolve({ templateId: questionTemplateIds.pollSingle, answerOptions: options }).type, "POLL_SINGLE");
  assert.equal(resolve({ templateId: questionTemplateIds.pollMulti, answerOptions: options }).type, "POLL_MULTI");
  assert.deepEqual(resolve({
    templateId: questionTemplateIds.pollScale,
    templateData: { kind: "POLL_SCALE", min: 1, max: 5, step: 1, minLabel: "Nein", maxLabel: "Ja" },
  }), {
    type: "POLL_SCALE",
    inputMode: "decimal",
    min: 1,
    max: 5,
    step: 1,
    minLabel: "Nein",
    maxLabel: "Ja",
    values: [1, 2, 3, 4, 5],
  });
});

test("resolves the meme contract with the existing question image", () => {
  assert.deepEqual(resolve({
    templateId: questionTemplateIds.memeCaption,
    memeImageUrl: "meme/base.webp",
  }), {
    type: "MEME_CAPTION",
    imageUrl: "meme/base.webp",
    maxLength: 80,
    layout: {
      version: 1,
      mode: "STANDARD",
      zones: [
        { id: "top", label: "Text oben", placement: "EXTERNAL_TOP", x: 0, y: 0, width: 100, height: 21, order: 1, maxLines: 3, required: false },
        { id: "bottom", label: "Text unten", placement: "EXTERNAL_BOTTOM", x: 0, y: 79, width: 100, height: 21, order: 2, maxLines: 3, required: false },
      ],
    },
  });
});

test("resolves custom caption zones into the immutable interaction contract", () => {
  const interaction = resolve({
    templateId: questionTemplateIds.memeCaption,
    memeImageUrl: "meme/base.webp",
    memeCaptionLayout: {
      version: 1,
      mode: "CUSTOM",
      zones: [{ id: "bubble", label: "Sprechblase", placement: "IMAGE", x: 50, y: 5, width: 40, height: 30, order: 1, maxLines: 2, required: true }],
    },
  });
  assert.equal(interaction.type, "MEME_CAPTION");
  assert.equal(interaction.type === "MEME_CAPTION" ? interaction.layout?.zones[0].id : null, "bubble");
});

test("participant meme forms keep the run snapshot after the question layout changes", () => {
  const currentInteraction = resolve({
    templateId: questionTemplateIds.memeCaption,
    memeImageUrl: "meme/base.webp",
  });
  const snapshottedInteraction = resolve({
    templateId: questionTemplateIds.memeCaption,
    memeImageUrl: "meme/base.webp",
    memeCaptionLayout: {
      version: 1,
      mode: "CUSTOM",
      zones: [{ id: "left", label: "Person links", placement: "IMAGE", x: 5, y: 5, width: 40, height: 35, order: 1, maxLines: 2, required: true }],
    },
  });

  const resolved = resolveParticipantInteractionFromSnapshot(
    { interaction: snapshottedInteraction },
    currentInteraction,
  );
  assert.equal(resolved.type, "MEME_CAPTION");
  assert.equal(resolved.type === "MEME_CAPTION" ? resolved.layout?.mode : null, "CUSTOM");
  assert.equal(resolved.type === "MEME_CAPTION" ? resolved.layout?.zones[0].label : null, "Person links");
});

test("participant non-meme forms keep the current read model", () => {
  const currentInteraction = resolve({ templateId: null });
  const resolved = resolveParticipantInteractionFromSnapshot(
    { interaction: { type: "TEXT", multiline: true, inputMode: "text", placeholder: "Veraltet" } },
    currentInteraction,
  );
  assert.deepEqual(resolved, currentInteraction);
});
