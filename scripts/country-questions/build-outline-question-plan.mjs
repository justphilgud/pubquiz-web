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
  version: 2,
  target: "Production pending explicit approval",
  writeAuthorized: false,
  idempotency: {
    key: "sourceMarker",
    preflight: "Enumerate every exact-question match, load all result pages, and reconcile the unique COUNTRY_OUTLINE_V1 source marker before creating anything.",
    conflictPolicy: "Stop on duplicate, unexpected, or semantically mismatching markers.",
    resumePolicy: "Skip only an existing row whose marker, question, ordered answers, correct-answer flag, category, template, and media count all match the plan.",
  },
  expectedTotal: 193,
  productionInventoryReadOnly: {
    observedAt: "2026-09-22T08:40:00+02:00",
    matchingQuestionCount: 0,
  },
  expectedExisting: 0,
  expectedNew: 193,
  previewPilotIsNotProductionEvidence: true,
  questions: outlineQuestions.map((question) => ({
    ...question,
    category: "Geografie",
    templateId: "standard",
    source: `Natural Earth Admin 0 – Countries v5.1.1 (Public Domain); ${question.sourceMarker}`,
    pilotInPreview: pilotIso2.has(question.iso2),
    expectedStateBeforeProductionImport: "missing",
  })),
};

await writeFile(outputPlanPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(outputImportPlanPath, `${JSON.stringify(importPlan, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  outlineQuestions: outlineQuestions.length,
  pilotAssetsPreserved: outlinePilot.length,
  nonPilotAssets: outlineQuestions.length - outlinePilot.length,
  expectedNewProductionQuestions: importPlan.expectedNew,
}));
