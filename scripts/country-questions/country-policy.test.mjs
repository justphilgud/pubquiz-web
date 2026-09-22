import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import sharp from "sharp";
import {
  FLAG_QUESTION,
  MANUAL_OUTLINE_DISTRACTORS,
  OUTLINE_QUESTION,
  PILOT_COUNTRIES,
  buildOutlineQuestionPlan,
  selectFlagDistractors,
  validateCountryCatalogue,
  validateQuestionAnswers,
} from "./country-policy.mjs";

const catalogue = JSON.parse(
  readFileSync("data/countries/un-member-states.de.json", "utf8"),
);
const plan = JSON.parse(
  readFileSync("data/countries/country-question-plan.json", "utf8"),
);
const importPlan = JSON.parse(
  readFileSync("data/countries/country-outline-import-plan.json", "utf8"),
);
const outlineManifest = JSON.parse(
  readFileSync("data/countries/country-outline-assets.json", "utf8"),
);
const qualityReport = JSON.parse(
  readFileSync("data/countries/country-outline-qc.json", "utf8"),
);

function fileSha256(filename) {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

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
    assert.equal(
      question.answers
        .slice(1)
        .every((answer) => !answer.isCorrect && answer.iso2 !== question.iso2),
      true,
    );
  }
});

test("all 193 outline questions map one-to-one to UN members and owned assets", () => {
  assert.equal(plan.outlineQuestions.length, 193);
  const members = new Set(catalogue.members.map((country) => country.iso2));
  assert.deepEqual(
    new Set(plan.outlineQuestions.map((question) => question.iso2)),
    members,
  );
  assert.equal(
    new Set(plan.outlineQuestions.map((question) => question.sourceMarker)).size,
    193,
  );
  for (const question of plan.outlineQuestions) {
    assert.equal(question.question, OUTLINE_QUESTION);
    assert.equal(validateQuestionAnswers(question), true, question.iso2);
    assert.equal(question.answers[0].iso2, question.iso2);
    assert.equal(question.answers[0].isCorrect, true);
    assert.equal(
      question.answers
        .slice(1)
        .every(
          (answer) =>
            !answer.isCorrect &&
            answer.iso2 !== question.iso2 &&
            members.has(answer.iso2),
        ),
      true,
      question.iso2,
    );
    assert.equal(
      question.assetPath,
      `public/country-outlines/${question.iso2.toLowerCase()}.webp`,
    );
  }
});

test("the five accepted pilot distractor sets remain unchanged", () => {
  assert.deepEqual(
    plan.outlinePilot.map((question) => question.iso2),
    PILOT_COUNTRIES.map((country) => country.iso2),
  );
  for (const question of plan.outlinePilot) {
    assert.equal(question.distractorMethod, "pilot-preserved");
    assert.deepEqual(
      question.answers.slice(1).map((answer) => answer.iso2),
      MANUAL_OUTLINE_DISTRACTORS[question.iso2],
    );
  }
});

test("outline plan rebuild is deterministic", () => {
  const rebuilt = buildOutlineQuestionPlan(
    catalogue.members,
    outlineManifest.assets,
  );
  assert.deepEqual(plan.outlineQuestions, rebuilt);
});

test("outline asset manifest maps every member to one valid local SVG and WebP", async () => {
  assert.equal(outlineManifest.version, 2);
  assert.equal(outlineManifest.source.version, "5.1.1");
  assert.equal(
    outlineManifest.source.sha256,
    "239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255",
  );
  assert.deepEqual(outlineManifest.mapping.aliases, { SSD: "SDS" });
  assert.equal(outlineManifest.assets.length, 193);
  assert.equal(new Set(outlineManifest.assets.map((asset) => asset.iso2)).size, 193);
  for (const asset of outlineManifest.assets) {
    assert.deepEqual(asset.canvas, { width: 1200, height: 900, padding: 72 });
    assert.ok(asset.renderedBounds.minX >= 71.9, asset.iso2);
    assert.ok(asset.renderedBounds.minY >= 71.9, asset.iso2);
    assert.ok(asset.renderedBounds.maxX <= 1128.1, asset.iso2);
    assert.ok(asset.renderedBounds.maxY <= 828.1, asset.iso2);
    assert.ok(asset.retainedPolygonParts >= 1, asset.iso2);
    assert.ok(asset.visiblePixelRatio >= 0.001, asset.iso2);
    assert.equal(asset.outlineDescriptor.length, 16 * 12, asset.iso2);
    for (const output of [asset.svg, asset.webp]) {
      assert.equal(existsSync(output.path), true, output.path);
      assert.match(output.sha256, /^[a-f0-9]{64}$/);
      assert.equal(readFileSync(output.path).length, output.bytes, output.path);
      assert.equal(fileSha256(output.path), output.sha256, output.path);
    }
    const metadata = await sharp(asset.webp.path).metadata();
    assert.equal(metadata.width, 1600, asset.iso2);
    assert.equal(metadata.height, 1200, asset.iso2);
    assert.equal(metadata.format, "webp", asset.iso2);
    const svg = readFileSync(asset.svg.path, "utf8");
    assert.doesNotMatch(svg, /<(text|image)\b/i, asset.iso2);
  }
});

test("Natural Earth member subset contains exactly the mapped 193 features", () => {
  const subset = JSON.parse(
    gunzipSync(
      readFileSync("data/countries/natural-earth-v5.1.1-un-members.geojson.gz"),
    ).toString("utf8"),
  );
  assert.equal(subset.features.length, 193);
  assert.equal(
    new Set(subset.features.map((feature) => feature.properties.ADM0_A3)).size,
    193,
  );
});

test("automatic QC has no unresolved critical assets and contact sheets are complete", () => {
  assert.equal(qualityReport.generatedAssets, 193);
  assert.equal(qualityReport.criticalCount, 0);
  assert.deepEqual(qualityReport.critical, []);
  assert.equal(qualityReport.contactSheets.length, 4);
  assert.equal(
    qualityReport.contactSheets.every(
      (filename) => existsSync(filename) && readFileSync(filename).length > 0,
    ),
    true,
  );
  for (const iso2 of ["DE", "AU", "CL", "GM", "SM", "ID", "PH", "JP", "NZ", "FJ", "KI"]) {
    assert.equal(
      outlineManifest.assets.some((asset) => asset.iso2 === iso2),
      true,
      iso2,
    );
  }
});

test("preview import plan is complete and repeat-safe by unique source marker", () => {
  assert.equal(importPlan.target, "Preview only");
  assert.equal(importPlan.idempotency, "sourceMarker");
  assert.equal(importPlan.expectedTotal, 193);
  assert.equal(importPlan.expectedExistingPilot, 5);
  assert.equal(importPlan.expectedNew, 188);
  assert.equal(importPlan.questions.length, 193);
  assert.equal(
    importPlan.questions.filter(
      (question) => question.expectedStateBeforePhase2 === "existing-pilot",
    ).length,
    5,
  );
  assert.equal(
    new Set(importPlan.questions.map((question) => question.sourceMarker)).size,
    193,
  );
});

test("flag selection prevents duplicate near-identical distractors", () => {
  const country = {
    iso2: "AA",
    region: "X",
    subregion: "Y",
    flagAspectRatio: 1.5,
    flagDescriptor: [0, 0, 0],
  };
  const candidates = [
    {
      iso2: "AB",
      region: "X",
      subregion: "Y",
      flagAspectRatio: 1.5,
      flagDescriptor: [0.01, 0.01, 0.01],
    },
    {
      iso2: "AC",
      region: "X",
      subregion: "Y",
      flagAspectRatio: 1.5,
      flagDescriptor: [0.011, 0.011, 0.011],
    },
    {
      iso2: "AD",
      region: "X",
      subregion: "Y",
      flagAspectRatio: 1.5,
      flagDescriptor: [0.2, 0.2, 0.2],
    },
    {
      iso2: "AE",
      region: "X",
      subregion: "Y",
      flagAspectRatio: 1.5,
      flagDescriptor: [0.4, 0.4, 0.4],
    },
  ];
  const selected = selectFlagDistractors(country, [country, ...candidates]);
  assert.deepEqual(
    selected.map((entry) => entry.iso2),
    ["AB", "AD", "AE"],
  );
});
