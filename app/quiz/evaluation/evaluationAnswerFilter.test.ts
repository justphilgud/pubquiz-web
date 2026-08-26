import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_EVALUATION_ANSWER_FILTERS,
  filterEvaluationAnswers,
} from "./evaluationAnswerFilter";

const answers = [
  { id: "block-1-question-1-team-a", teamname: "A", abschnittId: 1, istGespielt: true, istOffeneFrage: false, istAutomatischRichtig: true, istUnbeantwortet: false },
  { id: "block-1-question-2-team-a", teamname: "A", abschnittId: 1, istGespielt: true, istOffeneFrage: true, istAutomatischRichtig: false, istUnbeantwortet: false },
  { id: "block-2-question-1-team-a", teamname: "A", abschnittId: 2, istGespielt: false, istOffeneFrage: false, istAutomatischRichtig: false, istUnbeantwortet: false },
  { id: "block-1-question-1-team-b", teamname: "B", abschnittId: 1, istGespielt: true, istOffeneFrage: false, istAutomatischRichtig: true, istUnbeantwortet: false },
  { id: "block-1-question-2-team-b", teamname: "B", abschnittId: 1, istGespielt: true, istOffeneFrage: true, istAutomatischRichtig: false, istUnbeantwortet: false },
  { id: "block-2-question-1-team-b", teamname: "B", abschnittId: 2, istGespielt: false, istOffeneFrage: false, istAutomatischRichtig: false, istUnbeantwortet: false },
];

test("default evaluation view includes every played block but hides future questions", () => {
  assert.deepEqual(
    filterEvaluationAnswers(answers, DEFAULT_EVALUATION_ANSWER_FILTERS).map(
      (answer) => answer.id,
    ),
    answers.filter((answer) => answer.istGespielt).map((answer) => answer.id),
  );
});

test("optional filters remain explicit user choices", () => {
  assert.deepEqual(
    filterEvaluationAnswers(answers, {
      scope: "PLAYED",
      selectedTeam: "A",
      openQuestionsOnly: true,
      incorrectAnswersOnly: true,
      includeUnanswered: false,
    }).map((answer) => answer.id),
    ["block-1-question-2-team-a"],
  );
});

test("all and section scopes expose future questions without classifying them as wrong", () => {
  assert.equal(
    filterEvaluationAnswers(answers, {
      ...DEFAULT_EVALUATION_ANSWER_FILTERS,
      scope: "ALL",
    }).length,
    6,
  );
  assert.deepEqual(
    filterEvaluationAnswers(answers, {
      ...DEFAULT_EVALUATION_ANSWER_FILTERS,
      scope: "SECTION:2",
    }).map((answer) => answer.id),
    ["block-2-question-1-team-a", "block-2-question-1-team-b"],
  );
  assert.equal(
    filterEvaluationAnswers(answers, {
      ...DEFAULT_EVALUATION_ANSWER_FILTERS,
      scope: "ALL",
      incorrectAnswersOnly: true,
    }).some((answer) => !answer.istGespielt),
    false,
  );
});
