import assert from "node:assert/strict";
import test from "node:test";
import { getQuizProductActions } from "./quizProductActions";

test("liefert alle produktiven Quizaktionen mit demselben Quizkontext", () => {
  const actions = getQuizProductActions(42);
  assert.deepEqual(actions.map((action) => action.id), [
    "MODERATION",
    "PRESENTATION",
    "ANSWER_FORM",
    "EVALUATION",
  ]);
  assert.ok(actions.every((action) => action.href.startsWith("/quiz/42/")));
  assert.equal(actions.some((action) => action.href.includes("storybook-experience")), false);
  assert.ok(actions.every((action) => action.opensNewTab));
});
