import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PILOT_COUNTRIES,
  buildOutlineQuestionPlan,
  validateCountryCatalogue,
} from "./country-policy.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`MISSING_ARGUMENT:${name}`);
  return path.resolve(process.argv[index + 1]);
}

const cataloguePath = argument("--catalogue");
const assetManifestPath = argument("--asset-manifest");
const existingPlanPath = argument("--existing-plan");
const outputPlanPath = argument("--output-plan");
const outputImportPlanPath = argument("--output-import-plan");

const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
const assetManifest = JSON.parse(await readFile(assetManifestPath, "utf8"));
const existingPlan = JSON.parse(await readFile(existingPlanPath, "utf8"));
validateCountryCatalogue(catalogue.members);
if (assetManifest.assets.length !== 193) {
  throw new Error(`OUTLINE_ASSET_COUNT:${assetManifest.assets.length}`);
}

const outlineQuestions = buildOutlineQuestionPlan(catalogue.members, assetManifest.assets);
const pilotIso2 = new Set(PILOT_COUNTRIES.map((country) => country.iso2));
const questionByIso2 = new Map(outlineQuestions.map((question) => [question.iso2, question]));
const outlinePilot = PILOT_COUNTRIES.map((country) => questionByIso2.get(country.iso2));
const plan = {
  version: 2,
  flagQuestions: existingPlan.flagQuestions,
  outlinePilot,
  outlineQuestions,
};
const importPlan = {
  version: 1,
  target: "Preview only",
  idempotency: "sourceMarker",
  expectedTotal: 193,
  expectedExistingPilot: 5,
  expectedNew: 188,
  questions: outlineQuestions.map((question) => ({
    ...question,
    category: "Geografie",
    templateId: "standard",
    source: `Natural Earth Admin 0 – Countries v5.1.1 (Public Domain); ${question.sourceMarker}`,
    expectedStateBeforePhase2: pilotIso2.has(question.iso2) ? "existing-pilot" : "missing",
  })),
};

await writeFile(outputPlanPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(outputImportPlanPath, `${JSON.stringify(importPlan, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outlineQuestions: outlineQuestions.length, pilot: outlinePilot.length, newQuestions: outlineQuestions.length - outlinePilot.length }));
