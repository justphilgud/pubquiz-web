import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatGermanPoints,
  getQuizQuestionPointsDisplay,
} from "./quizQuestionPointsDisplay";

test("standard question shows its maximum base points", () => {
  assert.deepEqual(
    getQuizQuestionPointsDisplay({
      templateId: null,
      pointsMode: "standard",
      basePoints: 1,
    }),
    {
      pointsLabel: "max. 1 Punkt",
      modeLabel: null,
      isDynamic: false,
    },
  );
});

test("partial-point maxima use German decimal formatting", () => {
  assert.equal(
    getQuizQuestionPointsDisplay({
      templateId: "face_morph",
      pointsMode: "standard",
      basePoints: 1.5,
    }).pointsLabel,
    "max. 1,5 Punkte",
  );
  assert.equal(
    getQuizQuestionPointsDisplay({
      templateId: "reihenfolge",
      pointsMode: "standard",
      basePoints: 1.25,
    }).pointsLabel,
    "max. 1,25 Punkte",
  );
});

test("expert question shows doubled maximum end points", () => {
  assert.deepEqual(
    getQuizQuestionPointsDisplay({
      templateId: "face_morph",
      pointsMode: "expertenbonus",
      basePoints: 1,
    }),
    {
      pointsLabel: "max. 2 Punkte",
      modeLabel: "Expertenfrage",
      isDynamic: false,
    },
  );
});

test("expert question doubles decimal base maxima without float arithmetic", () => {
  assert.equal(
    getQuizQuestionPointsDisplay({
      templateId: null,
      pointsMode: "expertenbonus",
      basePoints: "0.75",
    }).pointsLabel,
    "max. 1,5 Punkte",
  );
  assert.equal(
    getQuizQuestionPointsDisplay({
      templateId: "face_morph",
      pointsMode: "expertenbonus",
      basePoints: "1.5",
    }).pointsLabel,
    "max. 3 Punkte",
  );
});

test("risk question does not expose a fixed maximum", () => {
  assert.deepEqual(
    getQuizQuestionPointsDisplay({
      templateId: null,
      pointsMode: "risikofrage",
      basePoints: 1,
    }),
    {
      pointsLabel: "Dynamische Punkte",
      modeLabel: "Risikofrage",
      isDynamic: true,
    },
  );
});

test("pixel question shows reveal range and suppresses invalid mode chips", () => {
  for (const pointsMode of ["standard", "expertenbonus", "risikofrage"]) {
    assert.deepEqual(
      getQuizQuestionPointsDisplay({
        templateId: "pixelbild",
        pointsMode,
        basePoints: 1,
      }),
      {
        pointsLabel: "1–3 Punkte",
        modeLabel: null,
        isDynamic: false,
      },
    );
  }
});

test("singular, plural and insignificant zeroes are correct", () => {
  assert.equal(formatGermanPoints(1), "1 Punkt");
  assert.equal(formatGermanPoints(2), "2 Punkte");
  assert.equal(formatGermanPoints(1.5), "1,5 Punkte");
});

test("question card keeps template, points, mode and answer mode separate", () => {
  const source = readFileSync(
    "app/quiz/[quizId]/QuizQuestionItem.tsx",
    "utf8",
  );
  assert.match(source, /\{frage\.vorlagenname\}/);
  assert.match(source, /\{pointsDisplay\.pointsLabel\}/);
  assert.match(source, /\{pointsDisplay\.modeLabel\}/);
  assert.match(source, /\{getAnswerModeLabel\(frage\)\}/);
});
