import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assertRepairableConfig } from "./editorial-test-question-repair";

test("repair accepts only original config or the exact observed editor transformation", () => {
  const original = { templateData: { kind: "ANAGRAM", name: "Clint Eastwood", selectedSolution: "Old West Action", suggestions: ["Old West Action"], wordCountPreference: "3" } };
  const transformed = { templateData: { ...original.templateData, selectedSolution: "OLD WEST ACTION", suggestions: ["OLD WEST ACTION"] },
    stageDurationsSeconds: {stage1:15,stage2:15,stage3:15}, createPixelQuestionByAnswer: {answer1:false,answer2:false} };
  assert.doesNotThrow(()=>assertRepairableConfig(154,original,original));
  assert.doesNotThrow(()=>assertRepairableConfig(154,original,transformed));
  assert.throws(()=>assertRepairableConfig(154,original,{ ...transformed, sponsor: {name:"Changed"} }),/UNEXPECTED_CONTENT/);
  assert.throws(()=>assertRepairableConfig(154,original,{ ...transformed,templateData:{...transformed.templateData,name:"Changed"} }),/UNEXPECTED_CONTENT/);
  const estimate = { templateData: {kind:"ESTIMATE",unit:"Meter",correctValue:8848.86,explanation:"Original",tolerance:null,numberFormat:"DECIMAL"} };
  const expanded = { ...estimate,stageDurationsSeconds:{stage1:15,stage2:15,stage3:15},createPixelQuestionByAnswer:{answer1:false,answer2:false} };
  assert.doesNotThrow(()=>assertRepairableConfig(207,estimate,expanded));
  assert.throws(()=>assertRepairableConfig(207,estimate,{ ...expanded,templateData:{...estimate.templateData,unit:"Kilometer"} }),/UNEXPECTED_CONTENT/);
  assert.throws(()=>assertRepairableConfig(208,estimate,expanded),/TARGET_INVALID/);
});

test("fixed repair workflow remains Preview-only, exact-CI-gated and mutually exclusive with deployment", () => {
  const workflow = readFileSync(".github/workflows/deploy-preview.yml","utf8");
  const job = workflow.slice(workflow.indexOf("  editorial-test-repair:"));
  assert.match(job,/environment: preview/);
  assert.match(job,/github.ref == 'refs\/heads\/codex\/editorial-safe-import'/);
  assert.match(job,/verify-preview-ci.ts/);
  assert.match(job,/deployment:validate/);
  assert.doesNotMatch(job,/db:deploy|VERCEL_TOKEN|production/);
  assert.match(workflow,/!inputs.editorial_dry_run_only && !inputs.editorial_repair_test_questions/);
});
