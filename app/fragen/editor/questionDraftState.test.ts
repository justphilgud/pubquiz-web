import assert from "node:assert/strict";
import test from "node:test";
import { applySavedAnswerState, getQuestionDraftFingerprint, removeAnswerById } from "./questionDraftState";
import type { QuestionEditorDraft, SaveQuestionResult } from "./types";

function draft(): QuestionEditorDraft {
  return {
    templateId: null,
    questionText: "Frage",
    questionMedia: [],
    templateConfig: { stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 }, createPixelQuestionByAnswer: { answer1: false, answer2: false } },
    answers: [{ id: "temporary-1", text: "Antwort", isCorrect: true, additionalInfo: "", media: null }],
    categoryIds: [],
    sourceOrRemark: "",
    moderationNotes: "",
    categoryRequest: "",
    approvalRemark: "",
    isIncomplete: true,
    validUntil: null,
    status: "DRAFT",
  };
}

test("the draft fingerprint is stable for an unchanged draft", () => {
  const current = draft();
  assert.equal(getQuestionDraftFingerprint(current), getQuestionDraftFingerprint(structuredClone(current)));
});

test("the draft fingerprint detects answer changes", () => {
  const current = draft();
  const changed = structuredClone(current);
  changed.answers[0].text = "Geändert";
  assert.notEqual(getQuestionDraftFingerprint(current), getQuestionDraftFingerprint(changed));
});

test("the draft fingerprint detects a FaceMorph pixel option change", () => {
  const current = draft();
  const changed = {
    ...current,
    templateId: "face_morph",
    templateConfig: {
      ...current.templateConfig,
      createPixelQuestionByAnswer: { answer1: true, answer2: false },
    },
  };

  assert.notEqual(
    getQuestionDraftFingerprint(current),
    getQuestionDraftFingerprint(changed),
  );
});

test("saved answer IDs are assigned by stable client identity", () => {
  const result = {
    success: true,
    questionId: 12,
    messageCode: "draftCreated",
    messageParams: { id: 12 },
    fallbackMessage: "gespeichert",
    questionMedia: [],
    answers: [{ clientId: "temporary-1", answerId: 44, media: null }],
  } satisfies Extract<SaveQuestionResult, { success: true }>;
  const saved = applySavedAnswerState(draft().answers, result);
  assert.equal(saved[0].id, "temporary-1");
  assert.equal(saved[0].answerId, 44);
});

test("answer removal affects only the requested stable identity", () => {
  const answers = [
    ...draft().answers,
    { ...draft().answers[0], id: "temporary-2", text: "Zweite Antwort" },
  ];
  const remaining = removeAnswerById(answers, "temporary-1");
  assert.deepEqual(remaining.map((answer) => answer.id), ["temporary-2"]);
});
