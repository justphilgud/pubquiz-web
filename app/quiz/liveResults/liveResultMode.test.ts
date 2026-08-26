import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isQuizResultDisplayMode,
  supportsLiveResultEditorMode,
  supportsLiveResultInteraction,
} from "./liveResultMode";

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

test("editor eligibility mirrors the supported runtime surface", () => {
  assert.equal(supportsLiveResultEditorMode({ effectiveAnswerMode: "OPEN", templateId: null, structuredFieldCount: 0, answerOptionCount: 1, isPoll: false }), true);
  assert.equal(supportsLiveResultEditorMode({ effectiveAnswerMode: "CLOSED", templateId: "wahr_falsch", structuredFieldCount: 0, answerOptionCount: 2, isPoll: false }), true);
  assert.equal(supportsLiveResultEditorMode({ effectiveAnswerMode: "OPEN", templateId: "facemorph", structuredFieldCount: 2, answerOptionCount: 0, isPoll: false }), false);
});
