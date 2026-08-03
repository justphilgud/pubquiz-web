import assert from "node:assert/strict";
import test from "node:test";
import { getQuizProductActions } from "./quizProductActions";

test("liefert alle produktiven Quizaktionen mit demselben Quizkontext", () => {
  const actions = getQuizProductActions(42);
  assert.deepEqual(actions.map((action) => action.id), [
    "FLOW",
    "MODERATION",
    "PRESENTATION",
    "ANSWER_FORM",
    "EVALUATION",
  ]);
  assert.ok(actions.every((action) => action.href.startsWith("/quiz/42/")));
  assert.equal(actions.some((action) => action.href.includes("storybook-experience")), false);
  assert.equal(actions.find((action) => action.id === "FLOW")?.opensNewTab, false);
  assert.ok(actions.filter((action) => action.id !== "FLOW").every((action) => action.opensNewTab));
});
