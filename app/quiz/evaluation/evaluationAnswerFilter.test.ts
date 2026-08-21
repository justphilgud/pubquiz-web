import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_EVALUATION_ANSWER_FILTERS,
  filterEvaluationAnswers,
} from "./evaluationAnswerFilter";

const answers = [
  { id: "block-1-question-1-team-a", teamname: "A", istOffeneFrage: false, istAutomatischRichtig: true, istUnbeantwortet: false },
  { id: "block-1-question-2-team-a", teamname: "A", istOffeneFrage: true, istAutomatischRichtig: false, istUnbeantwortet: false },
  { id: "block-2-question-1-team-a", teamname: "A", istOffeneFrage: false, istAutomatischRichtig: false, istUnbeantwortet: false },
  { id: "block-1-question-1-team-b", teamname: "B", istOffeneFrage: false, istAutomatischRichtig: true, istUnbeantwortet: false },
  { id: "block-1-question-2-team-b", teamname: "B", istOffeneFrage: true, istAutomatischRichtig: false, istUnbeantwortet: false },
  { id: "block-2-question-1-team-b", teamname: "B", istOffeneFrage: false, istAutomatischRichtig: false, istUnbeantwortet: true },
];

test("default evaluation view preserves answers across blocks and teams", () => {
  assert.deepEqual(
    filterEvaluationAnswers(answers, DEFAULT_EVALUATION_ANSWER_FILTERS).map(
      (answer) => answer.id,
    ),
    answers.map((answer) => answer.id),
  );
});

test("optional filters remain explicit user choices", () => {
  assert.deepEqual(
    filterEvaluationAnswers(answers, {
      selectedTeam: "A",
      openQuestionsOnly: true,
      incorrectAnswersOnly: true,
      includeUnanswered: false,
    }).map((answer) => answer.id),
    ["block-1-question-2-team-a"],
  );
});
