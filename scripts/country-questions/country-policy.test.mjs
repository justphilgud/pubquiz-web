import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FLAG_QUESTION,
  OUTLINE_QUESTION,
  buildOutlinePilotPlan,
  selectFlagDistractors,
  validateCountryCatalogue,
  validateQuestionAnswers,
} from "./country-policy.mjs";

const catalogue = JSON.parse(readFileSync("data/countries/un-member-states.de.json", "utf8"));
const plan = JSON.parse(readFileSync("data/countries/country-question-plan.json", "utf8"));
const outlineManifest = JSON.parse(readFileSync("data/countries/country-outline-assets.json", "utf8"));

test("country catalogue contains exactly the 193 distinct UN members", () => {
  assert.doesNotThrow(() => validateCountryCatalogue(catalogue.members));
});

test("all flag questions have one correct and three distinct wrong answers", () => {
  assert.equal(plan.flagQuestions.length, 193);
  for (const question of plan.flagQuestions) {
    assert.equal(question.question, FLAG_QUESTION);
    assert.equal(validateQuestionAnswers(question), true, question.iso2);
    assert.equal(question.answers[0].nameDe, question.nameDe);
    assert.equal(question.answers[0].isCorrect, true);
    assert.equal(question.answers.slice(1).every((answer) => !answer.isCorrect && answer.iso2 !== question.iso2), true);
  }
});

test("the five outline pilots use the agreed countries and four-answer structure", () => {
  const rebuilt = buildOutlinePilotPlan(catalogue.members);
  assert.deepEqual(plan.outlinePilot, rebuilt);
  assert.deepEqual(plan.outlinePilot.map((question) => question.iso2), ["DE", "IT", "CL", "AU", "GM"]);
  assert.equal(plan.outlinePilot.every((question) => question.question === OUTLINE_QUESTION && validateQuestionAnswers(question)), true);
});

test("outline assets share a fixed canvas, retain safe padding and have source and output hashes", () => {
  assert.equal(outlineManifest.source.version, "5.1.1");
  assert.match(outlineManifest.source.sha256, /^[a-f0-9]{64}$/);
  assert.equal(outlineManifest.assets.length, 5);
  for (const asset of outlineManifest.assets) {
    assert.deepEqual(asset.canvas, { width: 1200, height: 900, padding: 72 });
    assert.ok(asset.renderedBounds.minX >= 71.9, asset.iso2);
    assert.ok(asset.renderedBounds.minY >= 71.9, asset.iso2);
    assert.ok(asset.renderedBounds.maxX <= 1128.1, asset.iso2);
    assert.ok(asset.renderedBounds.maxY <= 828.1, asset.iso2);
    assert.match(asset.svg.sha256, /^[a-f0-9]{64}$/);
    assert.match(asset.webp.sha256, /^[a-f0-9]{64}$/);
    assert.ok(asset.retainedPolygonParts >= 1);
    assert.ok(asset.omittedAreaRatio < 0.01);
  }
});

test("flag selection prevents duplicate near-identical distractors", () => {
  const country = { iso2: "AA", region: "X", subregion: "Y", flagAspectRatio: 1.5, flagDescriptor: [0, 0, 0] };
  const candidates = [
    { iso2: "AB", region: "X", subregion: "Y", flagAspectRatio: 1.5, flagDescriptor: [0.01, 0.01, 0.01] },
    { iso2: "AC", region: "X", subregion: "Y", flagAspectRatio: 1.5, flagDescriptor: [0.011, 0.011, 0.011] },
    { iso2: "AD", region: "X", subregion: "Y", flagAspectRatio: 1.5, flagDescriptor: [0.2, 0.2, 0.2] },
    { iso2: "AE", region: "X", subregion: "Y", flagAspectRatio: 1.5, flagDescriptor: [0.4, 0.4, 0.4] },
  ];
  const selected = selectFlagDistractors(country, [country, ...candidates]);
  assert.deepEqual(selected.map((entry) => entry.iso2), ["AB", "AD", "AE"]);
});
