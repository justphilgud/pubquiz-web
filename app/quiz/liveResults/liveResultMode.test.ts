import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isQuizResultDisplayMode,
  supportsLiveResultInteraction,
  supportsLiveResultQuestion,
} from "./liveResultMode";

function question(input: {
  templateId?: string | null;
  originalAnswerMode?: "OPEN" | "CLOSED" | "UNCLASSIFIED";
  effectiveAnswerMode?: "OPEN" | "CLOSED" | "UNCLASSIFIED";
  answerFields?: Array<{ id: number; label: string; required: boolean }>;
  answerOptions?: Array<{ id: number; label: string }>;
}) {
  return {
    templateId: input.templateId ?? null,
    originalAnswerMode: input.originalAnswerMode ?? "OPEN",
    effectiveAnswerMode: input.effectiveAnswerMode ?? "OPEN",
    answerFields: input.answerFields ?? [],
    answerOptions: input.answerOptions ?? [{ id: 1, label: "Lösung" }],
  };
}

test("live result mode is quiz-assignment configuration with a safe default", () => {
  assert.equal(isQuizResultDisplayMode("STANDARD"), true);
  assert.equal(isQuizResultDisplayMode("LIVE"), true);
  assert.equal(isQuizResultDisplayMode("AUTO"), false);
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /ergebnisdarstellung\s+QuizResultDisplayMode\s+@default\(STANDARD\)/);
  assert.match(schema, /live_results_visible\s+Boolean\s+@default\(false\)/);
});

test("eligible choice, poll and genuine text interactions support live results", () => {
  for (const interactionType of ["SINGLE_CHOICE", "MULTI_CHOICE", "POLL_SINGLE", "POLL_MULTI", "POLL_SCALE", "TEXT"] as const) {
    assert.equal(supportsLiveResultInteraction({ interactionType }), true, interactionType);
  }
});

test("ordering, structured, pixel and FaceMorph stay outside live V1", () => {
  for (const interactionType of ["ORDER", "STRUCTURED_TEXT", "NUMBER", "NO_ANSWER"] as const) {
    assert.equal(supportsLiveResultInteraction({ interactionType }), false, interactionType);
  }
  assert.equal(supportsLiveResultInteraction({ interactionType: "TEXT", templateId: "pixelbild" }), false);
  assert.equal(supportsLiveResultInteraction({ interactionType: "TEXT", templateId: "face_morph" }), false);
});

test("editor eligibility resolves the same executable interaction as runtime", () => {
  assert.equal(supportsLiveResultQuestion(question({})), true);
  assert.equal(supportsLiveResultQuestion(question({
    originalAnswerMode: "CLOSED",
    effectiveAnswerMode: "CLOSED",
    answerOptions: [{ id: 1, label: "A" }, { id: 2, label: "B" }],
  })), true);
  assert.equal(supportsLiveResultQuestion(question({
    templateId: "wahr_falsch",
    originalAnswerMode: "CLOSED",
    effectiveAnswerMode: "CLOSED",
    answerOptions: [{ id: 1, label: "Wahr" }, { id: 2, label: "Falsch" }],
  })), true);
  assert.equal(supportsLiveResultQuestion(question({
    templateId: "umfrage_skala",
    originalAnswerMode: "UNCLASSIFIED",
    effectiveAnswerMode: "UNCLASSIFIED",
    answerOptions: [],
  })), true);
});

test("unsupported special interactions are hidden in editor and rejected by runtime", () => {
  assert.equal(supportsLiveResultQuestion(question({
    templateId: "face_morph",
    answerFields: [
      { id: 1, label: "Person A", required: true },
      { id: 2, label: "Person B", required: true },
    ],
    answerOptions: [],
  })), false);
  assert.equal(supportsLiveResultQuestion(question({
    templateId: "reihenfolge",
    originalAnswerMode: "CLOSED",
    effectiveAnswerMode: "CLOSED",
    answerOptions: [{ id: 1, label: "A" }, { id: 2, label: "B" }],
  })), false);
  assert.equal(supportsLiveResultQuestion(question({
    templateId: "schaetzfrage",
    answerOptions: [],
  })), false);
});
