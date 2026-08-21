import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEvaluationMatrix,
  type EvaluationMatrixAnswerInput,
} from "./evaluationMatrix";

function answer(
  overrides: Partial<EvaluationMatrixAnswerInput> = {},
): EvaluationMatrixAnswerInput {
  return {
    quizQuestionId: 11,
    questionNumber: 1,
    questionText: "Welche Stadt ist die Hauptstadt?",
    sectionTitle: "Runde 1",
    maximumPointsLabel: "max. 1 Punkt",
    teamName: "Team A",
    isUnanswered: false,
    evaluationStatus: "CORRECT",
    answerText: "Berlin",
    correctAnswer: "Berlin",
    awardedPoints: 1,
    ...overrides,
  };
}

test("builds correct, wrong, unanswered, partial and review cells without changing ranking", () => {
  const answers = [
    answer(),
    answer({ teamName: "Team B", evaluationStatus: "WRONG", answerText: "Bonn", awardedPoints: 0 }),
    answer({ teamName: "Team C", isUnanswered: true, evaluationStatus: "UNANSWERED", answerText: null, awardedPoints: 0 }),
    answer({ quizQuestionId: 12, questionNumber: 2, questionText: "Zwei Bestandteile", maximumPointsLabel: "max. 0 Punkte", evaluationStatus: "PARTIAL", awardedPoints: 0.5 }),
    answer({ quizQuestionId: 12, questionNumber: 2, questionText: "Zwei Bestandteile", maximumPointsLabel: "max. 0 Punkte", teamName: "Team B", evaluationStatus: "REVIEW_REQUIRED", awardedPoints: 0 }),
    answer({ quizQuestionId: 12, questionNumber: 2, questionText: "Zwei Bestandteile", maximumPointsLabel: "max. 0 Punkte", teamName: "Team C", isUnanswered: true, evaluationStatus: "UNANSWERED", answerText: null, awardedPoints: 0 }),
  ];
  const ranking = [
    { teamname: "Team B", punkte: 8 },
    { teamname: "Team A", punkte: 7.5 },
    { teamname: "Team C", punkte: 0 },
  ];
  const before = JSON.stringify({ answers, ranking });
  const matrix = buildEvaluationMatrix({ answers, ranking });

  assert.deepEqual(matrix.teams.map((team) => [team.name, team.rank, team.totalPoints]), [
    ["Team B", 1, 8],
    ["Team A", 2, 7.5],
    ["Team C", 3, 0],
  ]);
  assert.equal(matrix.teams[0].cells[11].status, "WRONG");
  assert.equal(matrix.teams[1].cells[11].status, "CORRECT");
  assert.equal(matrix.teams[2].cells[11].status, "UNANSWERED");
  assert.equal(matrix.teams[1].cells[12].status, "PARTIAL");
  assert.equal(matrix.teams[0].cells[12].status, "REVIEW_REQUIRED");
  assert.equal(matrix.teams[1].cells[11].answerText, "Berlin");
  assert.equal(matrix.teams[1].cells[11].correctAnswer, "Berlin");
  assert.equal(matrix.questions[1].maximumPointsLabel, "max. 0 Punkte");
  assert.equal(JSON.stringify({ answers, ranking }), before);
});

test("calculates transparent per-question metrics", () => {
  const matrix = buildEvaluationMatrix({
    answers: [
      answer(),
      answer({ teamName: "Team B", evaluationStatus: "WRONG", awardedPoints: 0 }),
      answer({ teamName: "Team C", evaluationStatus: "PARTIAL", awardedPoints: 0.5 }),
      answer({ teamName: "Team D", evaluationStatus: "REVIEW_REQUIRED", awardedPoints: 0 }),
      answer({ teamName: "Team E", isUnanswered: true, evaluationStatus: "UNANSWERED", awardedPoints: 0 }),
    ],
    ranking: [],
  });
  assert.deepEqual(matrix.questions[0], {
    id: 11,
    number: 1,
    text: "Welche Stadt ist die Hauptstadt?",
    sectionTitle: "Runde 1",
    maximumPointsLabel: "max. 1 Punkt",
    answered: 4,
    correct: 1,
    wrong: 1,
    partial: 1,
    reviewRequired: 1,
    pending: 0,
    unanswered: 1,
    successRate: 25,
    averagePoints: 0.375,
  });
});

test("keeps submitted answers visible while their evaluation is pending", () => {
  const matrix = buildEvaluationMatrix({
    answers: [
      answer({
        evaluationStatus: "PENDING",
        answerText: "7",
        awardedPoints: 0,
      }),
    ],
    ranking: [{ teamname: "Team A", punkte: 0 }],
  });

  assert.equal(matrix.teams[0].cells[11].status, "PENDING");
  assert.equal(matrix.teams[0].cells[11].answerText, "7");
  assert.equal(matrix.questions[0].answered, 1);
  assert.equal(matrix.questions[0].pending, 1);
  assert.equal(matrix.questions[0].unanswered, 0);
  assert.equal(matrix.questions[0].successRate, null);
  assert.equal(matrix.questions[0].averagePoints, null);
});

test("excludes polls from the evaluated matrix", () => {
  const matrix = buildEvaluationMatrix({
    answers: [
      answer(),
      answer({
        quizQuestionId: 99,
        questionNumber: 2,
        questionText: "Wie war der Abend?",
        isPoll: true,
        evaluationStatus: "UNANSWERED",
        awardedPoints: 0,
      }),
    ],
    ranking: [{ teamname: "Team A", punkte: 1 }],
  });
  assert.deepEqual(matrix.questions.map((question) => question.id), [11]);
  assert.equal(matrix.teams[0].cells[99], undefined);
});

test("builds a 50 by 50 matrix without backend fan-out", () => {
  const answers = Array.from({ length: 50 }, (_, questionIndex) =>
    Array.from({ length: 50 }, (_, teamIndex) => answer({
      quizQuestionId: questionIndex + 1,
      questionNumber: questionIndex + 1,
      questionText: `Frage ${questionIndex + 1}`,
      sectionTitle: `Runde ${Math.floor(questionIndex / 10) + 1}`,
      teamName: `Team ${String(teamIndex + 1).padStart(2, "0")}`,
      evaluationStatus: teamIndex % 2 === 0 ? "CORRECT" : "WRONG",
      awardedPoints: teamIndex % 2 === 0 ? 1 : 0,
    })),
  ).flat();
  const ranking = Array.from({ length: 50 }, (_, index) => ({
    teamname: `Team ${String(index + 1).padStart(2, "0")}`,
    punkte: 50 - index,
  }));
  const matrix = buildEvaluationMatrix({ answers, ranking });
  assert.equal(matrix.questions.length, 50);
  assert.equal(matrix.teams.length, 50);
  assert.equal(Object.keys(matrix.teams[0].cells).length, 50);
  assert.equal(matrix.questions[0].answered, 50);
});
