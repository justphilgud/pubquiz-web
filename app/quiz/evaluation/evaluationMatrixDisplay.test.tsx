import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import TeamQuestionEvaluationMatrix from "./TeamQuestionEvaluationMatrix";
import { EvaluationMatrixDetailContent } from "./EvaluationMatrixDetailModal";
import type { EvaluationMatrix } from "./evaluationMatrix";
import {
  evaluationMatrixStatusPresentation,
  questionMatchesEvaluationMatrixFilter,
} from "./evaluationMatrixDisplay";

const matrix: EvaluationMatrix = {
  questions: [
    { id: 11, number: 1, text: "Eine bewusst sehr lange Frage, die den kompakten Tabellenkopf nicht verbreitern darf", sectionTitle: "Runde 1", maximumPointsLabel: "max. 1 Punkt", answered: 1, correct: 1, wrong: 0, partial: 0, reviewRequired: 0, pending: 0, unanswered: 0, successRate: 100, averagePoints: 1 },
    { id: 12, number: 2, text: "Teilantwort", sectionTitle: "Runde 1", maximumPointsLabel: "max. 2 Punkte", answered: 1, correct: 0, wrong: 0, partial: 1, reviewRequired: 0, pending: 0, unanswered: 0, successRate: 0, averagePoints: 1 },
    { id: 13, number: 3, text: "Manuell prüfen", sectionTitle: "Runde 2", maximumPointsLabel: "max. 1 Punkt", answered: 1, correct: 0, wrong: 0, partial: 0, reviewRequired: 1, pending: 0, unanswered: 0, successRate: 0, averagePoints: 0 },
  ],
  teams: [{
    name: "Das Team mit einem außergewöhnlich langen Namen", rank: 1, totalPoints: 2,
    cells: {
      11: { status: "CORRECT", answerText: "Berlin", correctAnswer: "Berlin", awardedPoints: 1, maximumPointsLabel: "max. 1 Punkt" },
      12: { status: "PARTIAL", answerText: "Eine von zwei Antworten", correctAnswer: "Beide Antworten", awardedPoints: 1, maximumPointsLabel: "max. 2 Punkte" },
      13: { status: "REVIEW_REQUIRED", answerText: "Freitext", correctAnswer: "Musterlösung", awardedPoints: 0, maximumPointsLabel: "max. 1 Punkt" },
    },
  }],
};

test("maps every evaluation status to a compact symbol and accessible label", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(evaluationMatrixStatusPresentation).map(([status, value]) => [status, [value.symbol, value.label]])),
    { PENDING: ["…", "Wird berechnet"], CORRECT: ["✓", "Richtig"], WRONG: ["×", "Falsch"], PARTIAL: ["½", "Teilweise"], REVIEW_REQUIRED: ["?", "Prüfen"], UNANSWERED: ["–", "Nicht beantwortet"] },
  );
});

test("filters review and problematic questions without changing matrix data", () => {
  assert.deepEqual(matrix.questions.filter((question) => questionMatchesEvaluationMatrixFilter(question, "REVIEW")).map((question) => question.id), [13]);
  assert.deepEqual(matrix.questions.filter((question) => questionMatchesEvaluationMatrixFilter(question, "PROBLEMATIC")).map((question) => question.id), [12, 13]);
  assert.equal(matrix.questions.every((question) => questionMatchesEvaluationMatrixFilter(question, "ALL")), true);
});

test("renders compact sticky headers, truncated teams and accessible status controls", () => {
  const html = renderToStaticMarkup(<TeamQuestionEvaluationMatrix matrix={matrix} />);
  assert.match(html, /sticky left-0 top-0/);
  assert.match(html, /w-10 min-w-10 max-w-10/);
  assert.match(html, /truncate font-black/);
  assert.match(html, /title="Das Team mit einem außergewöhnlich langen Namen"/);
  assert.match(html, /aria-label="Das Team mit einem außergewöhnlich langen Namen, Frage 1: Richtig\. Details anzeigen"/);
  assert.match(html, /aria-label="Frage 1: Eine bewusst sehr lange Frage/);
  assert.match(html, /aria-pressed="true"/);
});

test("renders complete cell details for the selected team and question", () => {
  const team = matrix.teams[0];
  const question = matrix.questions[0];
  const html = renderToStaticMarkup(<EvaluationMatrixDetailContent selection={{ kind: "cell", team, question, cell: team.cells[question.id] }} />);
  assert.match(html, /Das Team mit einem außergewöhnlich langen Namen/);
  assert.match(html, /Berlin/);
  assert.match(html, /Vergeben: 1/);
  assert.match(html, /max\. 1 Punkt/);
  assert.match(html, /Richtig/);
});
