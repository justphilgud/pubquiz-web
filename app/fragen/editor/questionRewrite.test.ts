import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  addQuestionRewriteUsage,
  createQuestionRewriteSessionState,
  discardQuestionRewriteProposal,
  editQuestionRewriteProposal,
  parseQuestionRewriteInput,
  recordQuestionRewriteResult,
} from "./questionRewrite";
import { canUseQuestionRewrite, isQuestionRewriteEnabled } from "./questionRewriteFeature.server";
import { diffQuestionText } from "./questionTextDiff";
import { applyQuestionRewriteToDraft } from "./questionDraftState";
import type { QuestionEditorDraft } from "./types";

function draft(): QuestionEditorDraft {
  return {
    scope: "GLOBAL", eventSeriesIds: [], templateId: null,
    questionText: "Wie heisst die Hauptstadt von Frankreich?",
    questionMedia: [],
    templateConfig: { stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 }, createPixelQuestionByAnswer: { answer1: false, answer2: false } },
    answers: [{ id: "answer-1", text: "Paris", isCorrect: true, additionalInfo: "Bleibt unverändert", media: null }],
    categoryIds: [1], sourceOrRemark: "Quelle", moderationNotes: "Notiz", categoryRequest: "", approvalRemark: "",
    isIncomplete: false, validUntil: null, status: "DRAFT",
  };
}

test("question rewrite feature is fail-closed and enabled only by exact true", () => {
  assert.equal(isQuestionRewriteEnabled(undefined), false);
  assert.equal(isQuestionRewriteEnabled("false"), false);
  assert.equal(isQuestionRewriteEnabled("TRUE"), true);
});

test("only explicit editor assignments and administrators may use rewriting", () => {
  assert.equal(canUseQuestionRewrite({ userId: 1, assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }] }), true);
  assert.equal(canUseQuestionRewrite({ userId: 2, assignments: [{ role: "EDITOR", scopeType: "EVENT_SERIES", eventSeriesId: 9 }] }), true);
  assert.equal(canUseQuestionRewrite({ userId: 3, assignments: [{ role: "EVENT_MANAGER", scopeType: "EVENT_SERIES", eventSeriesId: 9 }] }), false);
});

test("rewrite input accepts only a non-empty question within the editor limit", () => {
  assert.deepEqual(parseQuestionRewriteInput({ questionText: "  Wer war Ada Lovelace?  " }), { ok: true, questionText: "Wer war Ada Lovelace?" });
  assert.deepEqual(parseQuestionRewriteInput({ questionText: "" }), { ok: false });
  assert.deepEqual(parseQuestionRewriteInput({ questionText: "x".repeat(301) }), { ok: false });
});

test("accepting a proposal changes only questionText in the editor draft", () => {
  const original = draft();
  const changed = applyQuestionRewriteToDraft(original, "Wie lautet die Hauptstadt Frankreichs?");
  assert.equal(changed.questionText, "Wie lautet die Hauptstadt Frankreichs?");
  assert.deepEqual({ ...changed, questionText: original.questionText }, original);
  assert.equal(original.questionText, "Wie heisst die Hauptstadt von Frankreich?");
});

test("token usage is accumulated only when reliable usage is available", () => {
  const current = { promptTokens: 10, completionTokens: 4, totalTokens: 14 };
  assert.deepEqual(addQuestionRewriteUsage(current, null), current);
  assert.deepEqual(addQuestionRewriteUsage(current, { promptTokens: 8, completionTokens: 3, totalTokens: 11 }), { promptTokens: 18, completionTokens: 7, totalTokens: 25 });
});

test("proposal display, editing, retry history and discard stay session-only", () => {
  const first = recordQuestionRewriteResult(createQuestionRewriteSessionState(), {
    id: "first",
    original: "Alte Frage?",
    proposal: "Bessere Frage?",
    usage: { promptTokens: 8, completionTokens: 3, totalTokens: 11 },
    cost: null,
  });
  assert.equal(first.active?.proposal, "Bessere Frage?");
  assert.equal(first.history.length, 1);

  const edited = editQuestionRewriteProposal(first, "Eigener Vorschlag?");
  assert.equal(edited.active?.proposal, "Eigener Vorschlag?");
  assert.equal(edited.history[0].proposal, "Bessere Frage?");

  const retried = recordQuestionRewriteResult(edited, {
    id: "second",
    original: "Alte Frage?",
    proposal: "Noch eine Fassung?",
    usage: { promptTokens: 9, completionTokens: 4, totalTokens: 13 },
    cost: null,
  });
  assert.equal(retried.active?.proposal, "Noch eine Fassung?");
  assert.deepEqual(retried.history.map((entry) => entry.id), ["second", "first"]);
  assert.equal(retried.cumulativeUsage.totalTokens, 24);

  const discarded = discardQuestionRewriteProposal(retried);
  assert.equal(discarded.active, null);
  assert.equal(discarded.history.length, 2);
});

test("word diff keeps stable text and marks changed wording", () => {
  const diff = diffQuestionText("Wie heisst die Stadt?", "Wie heißt diese Stadt?");
  assert.ok(diff.some((part) => part.kind === "removed" && part.text.includes("heisst")));
  assert.ok(diff.some((part) => part.kind === "added" && part.text.includes("heißt")));
  assert.ok(diff.some((part) => part.kind === "same" && part.text.includes("Wie")));
});

test("editor integration exposes rewrite UI only behind the server flag", () => {
  const editor = readFileSync(new URL("./components/QuestionEditor.tsx", import.meta.url), "utf8");
  assert.match(editor, /questionRewriteEnabled && !isReadOnly/);
  assert.match(editor, /applyQuestionRewriteToDraft\(current, questionText\)/);
  assert.doesNotMatch(editor, /NEXT_PUBLIC_OPENAI/);
});
