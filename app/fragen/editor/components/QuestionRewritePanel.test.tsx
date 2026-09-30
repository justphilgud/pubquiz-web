import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { deQuestionEditorMessages } from "@/app/i18n/messages/de/questionEditor";
import { QuestionRewritePanel } from "./QuestionRewritePanel";

test("rewrite panel starts with one explicit action and no proposal or automatic request", () => {
  const html = renderToStaticMarkup(createElement(QuestionRewritePanel, { questionText: "Wer erfand das Telefon?", disabled: false, messages: deQuestionEditorMessages.question.rewrite, onAccept: () => undefined }));
  assert.match(html, /data-question-rewrite/);
  assert.match(html, /Frage umformulieren/);
  assert.match(html, /OpenAI erhält ausschließlich den Fragetext/);
  assert.doesNotMatch(html, /id="questionRewriteProposal"/);
  assert.doesNotMatch(html, /Übernehmen/);
});

test("rewrite action is disabled for empty text and disabled editor state", () => {
  const empty = renderToStaticMarkup(createElement(QuestionRewritePanel, { questionText: "", disabled: false, messages: deQuestionEditorMessages.question.rewrite, onAccept: () => undefined }));
  const disabled = renderToStaticMarkup(createElement(QuestionRewritePanel, { questionText: "Frage?", disabled: true, messages: deQuestionEditorMessages.question.rewrite, onAccept: () => undefined }));
  assert.match(empty, /<button[^>]*disabled/);
  assert.match(disabled, /<button[^>]*disabled/);
});
