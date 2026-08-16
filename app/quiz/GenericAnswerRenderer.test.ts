import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import GenericAnswerRenderer, {
  type TeamAnswerDraft,
} from "./[quizId]/antworten/GenericAnswerRenderer";
import type { ResolvedQuizAnswerInteraction } from "@/app/quiz/answerInteraction";

const emptyDraft: TeamAnswerDraft = {
  antwortText: null,
  antwortId: null,
  antwortIds: [],
  antwortfelder: {},
};

function render(
  interaction: ResolvedQuizAnswerInteraction,
  value: TeamAnswerDraft | undefined = emptyDraft,
) {
  return renderToStaticMarkup(
    createElement(GenericAnswerRenderer, {
      questionAssignmentId: 42,
      interaction,
      value,
      disabled: false,
      onChange: () => undefined,
    }),
  );
}

test("TEXT renders the generic multiline text input", () => {
  const html = render({
    type: "TEXT",
    multiline: true,
    inputMode: "text",
    placeholder: "Antwort eintragen...",
  });

  assert.match(html, /data-answer-interaction="TEXT"/);
  assert.match(html, /<textarea/);
  assert.match(html, /placeholder="Antwort eintragen\.\.\."/);
});

test("NUMBER renders a decimal-friendly numeric input and its unit", () => {
  const html = render({
    type: "NUMBER",
    inputMode: "decimal",
    step: 1,
    unit: "km",
  });

  assert.match(html, /data-answer-interaction="NUMBER"/);
  assert.match(html, /type="number"/);
  assert.match(html, /inputMode="decimal"/);
  assert.match(html, /step="1"/);
  assert.match(html, />km</);
});

test("SINGLE_CHOICE renders one radio group", () => {
  const html = render(
    {
      type: "SINGLE_CHOICE",
      selectionMode: "SINGLE",
      options: [
        { id: 1, label: "Wahr" },
        { id: 2, label: "Falsch" },
      ],
    },
    { ...emptyDraft, antwortId: 2, antwortIds: [2] },
  );

  assert.match(html, /data-answer-interaction="SINGLE_CHOICE"/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
  assert.equal((html.match(/name="frage-42"/g) ?? []).length, 2);
  assert.equal((html.match(/checked=""/g) ?? []).length, 1);
});

test("MULTI_CHOICE renders independent checkboxes and preserves multiple selections", () => {
  const html = render(
    {
      type: "MULTI_CHOICE",
      selectionMode: "MULTIPLE",
      options: [
        { id: 1, label: "A" },
        { id: 2, label: "B" },
        { id: 3, label: "C" },
      ],
    },
    { ...emptyDraft, antwortIds: [1, 3] },
  );

  assert.match(html, /data-answer-interaction="MULTI_CHOICE"/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 3);
  assert.equal((html.match(/checked=""/g) ?? []).length, 2);
});

test("STRUCTURED_TEXT renders every named field with required metadata", () => {
  const html = render({
    type: "STRUCTURED_TEXT",
    multiline: false,
    inputMode: "text",
    fields: [
      {
        id: 11,
        key: "11",
        label: "Interpret",
        required: true,
        placeholder: "Interpret eintragen...",
      },
      {
        id: 12,
        key: "12",
        label: "Titel",
        required: false,
        placeholder: "Titel eintragen...",
      },
    ],
  });

  assert.match(html, /data-answer-interaction="STRUCTURED_TEXT"/);
  assert.equal((html.match(/type="text"/g) ?? []).length, 2);
  assert.match(html, /Interpret \*/);
  assert.match(html, /Titel/);
  assert.equal((html.match(/required=""/g) ?? []).length, 1);
});

test("ORDER renders the sortable list in the stored identifier order", () => {
  const html = render(
    {
      type: "ORDER",
      scoringPolicy: "POSITION",
      items: [
        { id: "first", text: "Zuerst" },
        { id: "second", text: "Danach" },
      ],
    },
    {
      ...emptyDraft,
      antwortText: JSON.stringify(["second", "first"]),
    },
  );

  assert.match(html, /data-answer-interaction="ORDER"/);
  assert.ok(html.indexOf("Danach") < html.indexOf("Zuerst"));
  assert.match(html, /Danach nach oben/);
  assert.match(html, /Zuerst nach unten/);
});

test("NO_ANSWER and not-yet-implemented future interactions render no form", () => {
  assert.equal(render({ type: "NO_ANSWER" }), "");
  assert.equal(render({ type: "POLL_SCALE", supported: false }), "");
});
