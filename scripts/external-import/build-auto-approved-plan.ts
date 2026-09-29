import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  assessProductionAutoQuality,
  toAutoApprovedPlanItem,
} from "../../app/fragen/import/external/productionAutoQuality";
import {
  EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION,
  canonicalExternalImportPlan,
  externalImportPlanDigest,
  validateExternalImportPlan,
  type ExternalImportPlan,
  type ExternalImportPlanItem,
} from "../../app/fragen/import/external/productionImportGuard";
import type {
  ExternalQuestion,
  ExternalQuestionAutomationResult,
} from "../../app/fragen/import/external/types";

type EnrichedPoolEntry = Readonly<{
  question: ExternalQuestion;
  automation: ExternalQuestionAutomationResult | null;
  error: string | null;
}>;

type EnrichedPool = Readonly<{
  results: readonly EnrichedPoolEntry[];
}>;

export type AutoApprovedCandidate = Readonly<{
  item: ExternalImportPlanItem;
  sourceReference: string;
}>;

function required(value: string | undefined, code: string) {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

function countBy<T extends string | number>(values: readonly T[]) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [
      String(value),
      values.filter((entry) => entry === value).length,
    ]),
  );
}

function deterministicCandidateId(question: ExternalQuestion) {
  return `auto-${createHash("sha256")
    .update(question.externalReference, "utf8")
    .digest("hex")
    .slice(0, 24)}`;
}

function itemCategory(item: ExternalImportPlanItem) {
  return item.prepared.category ?? "";
}

function chooseNext(
  candidates: readonly AutoApprovedCandidate[],
  selected: readonly AutoApprovedCandidate[],
  categoryCounts: ReadonlyMap<string, number>,
  categoryCap: number,
) {
  const selectedIds = new Set(selected.map((candidate) => candidate.item.candidateId));
  return candidates
    .filter((candidate) =>
      !selectedIds.has(candidate.item.candidateId) &&
      (categoryCounts.get(itemCategory(candidate.item)) ?? 0) < categoryCap
    )
    .sort((left, right) => {
      const categoryDifference =
        (categoryCounts.get(itemCategory(left.item)) ?? 0) -
        (categoryCounts.get(itemCategory(right.item)) ?? 0);
      return categoryDifference || left.sourceReference.localeCompare(right.sourceReference);
    })[0];
}

export function selectBalancedProductionCandidates(
  candidates: readonly AutoApprovedCandidate[],
  targetCount: number,
) {
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 1_000) {
    throw new Error("EXTERNAL_IMPORT_AUTO_TARGET_INVALID");
  }
  const categoryCap = Math.ceil(targetCount * 0.15);
  const easyTarget = Math.round(targetCount * 0.25);
  const hardTarget = Math.round(targetCount * 0.25);
  const difficultyTargets = new Map<number, number>([
    [25, easyTarget],
    [50, targetCount - easyTarget - hardTarget],
    [75, hardTarget],
  ]);
  const selected: AutoApprovedCandidate[] = [];
  const categoryCounts = new Map<string, number>();
  const add = (candidate: AutoApprovedCandidate) => {
    selected.push(candidate);
    const category = itemCategory(candidate.item);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  };

  for (const [difficulty, target] of difficultyTargets) {
    const matching = candidates.filter(
      (candidate) => candidate.item.prepared.difficulty === difficulty,
    );
    for (let count = 0; count < target; count += 1) {
      const next = chooseNext(matching, selected, categoryCounts, categoryCap);
      if (!next) break;
      add(next);
    }
  }
  while (selected.length < targetCount) {
    const next = chooseNext(candidates, selected, categoryCounts, categoryCap);
    if (!next) throw new Error("EXTERNAL_IMPORT_AUTO_POOL_INSUFFICIENT");
    add(next);
  }
  return selected;
}

export function buildProductionAutoPlan(input: {
  pool: EnrichedPool;
  targetCount: number;
  batchId: string;
  evaluatedAt: string;
  operatorUserId: number;
}) {
  if (!Number.isFinite(Date.parse(input.evaluatedAt))) {
    throw new Error("EXTERNAL_IMPORT_AUTO_EVALUATED_AT_INVALID");
  }
  if (!Array.isArray(input.pool.results)) {
    throw new Error("EXTERNAL_IMPORT_AUTO_POOL_INVALID");
  }
  const failures: Record<string, number> = {};
  const eligible: AutoApprovedCandidate[] = [];
  const acceptedQuestions: Array<{ questionId: number; question: string }> = [];
  const uniqueReferences = new Set<string>();

  const entries = [...input.pool.results].sort((left, right) =>
    left.question.externalReference.localeCompare(right.question.externalReference)
  );
  for (const entry of entries) {
    if (uniqueReferences.has(entry.question.externalReference)) {
      failures.DUPLICATE_SOURCE_REFERENCE = (failures.DUPLICATE_SOURCE_REFERENCE ?? 0) + 1;
      continue;
    }
    uniqueReferences.add(entry.question.externalReference);
    if (!entry.automation) {
      const code = entry.error ?? "AUTOMATION_MISSING";
      failures[code] = (failures[code] ?? 0) + 1;
      continue;
    }
    const assessment = assessProductionAutoQuality({
      question: entry.question,
      automation: entry.automation,
      existingQuestions: acceptedQuestions,
    });
    if (!assessment.eligible) {
      for (const failure of assessment.failures) {
        failures[failure] = (failures[failure] ?? 0) + 1;
      }
      continue;
    }
    const item = toAutoApprovedPlanItem({
      candidateId: deterministicCandidateId(entry.question),
      question: entry.question,
      automation: entry.automation,
      assessment,
    });
    eligible.push({ item, sourceReference: entry.question.externalReference });
    acceptedQuestions.push({
      questionId: acceptedQuestions.length + 1,
      question: item.prepared.question,
    });
  }

  const selected = selectBalancedProductionCandidates(eligible, input.targetCount);
  const plan: ExternalImportPlan = {
    version: 1,
    batchId: input.batchId,
    sourceType: "OpenTDB",
    frozenAt: input.evaluatedAt,
    operatorUserId: input.operatorUserId,
    importApproval: {
      approvalMode: "AUTOMATED_QUALITY_GATE",
      policyVersion: EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION,
      records: selected.map(({ item }) => ({
        candidateId: item.candidateId,
        sourceStatus: "APPROVED",
        evaluatedAt: input.evaluatedAt,
      })),
    },
    items: selected.map(({ item }) => item),
  };
  validateExternalImportPlan(plan);
  const report = {
    version: 1,
    batchId: input.batchId,
    approvalMode: "AUTOMATED_QUALITY_GATE",
    policyVersion: EXTERNAL_IMPORT_AUTO_QUALITY_POLICY_VERSION,
    evaluatedAt: input.evaluatedAt,
    rawCandidates: input.pool.results.length,
    uniqueCandidates: uniqueReferences.size,
    autoApprovedBeforeBalancing: eligible.length,
    selected: plan.items.length,
    planDigest: externalImportPlanDigest(plan),
    categoryDistribution: countBy(plan.items.map((item) => item.prepared.category ?? "")),
    difficultyDistribution: countBy(plan.items.map((item) => item.prepared.difficulty)),
    rejectionCounts: Object.fromEntries(Object.entries(failures).sort()),
  };
  return { plan, report };
}

async function main() {
  const poolPath = required(process.argv[2], "EXTERNAL_IMPORT_AUTO_POOL_PATH_REQUIRED");
  const planPath = required(process.argv[3], "EXTERNAL_IMPORT_AUTO_PLAN_PATH_REQUIRED");
  const reportPath = required(process.argv[4], "EXTERNAL_IMPORT_AUTO_REPORT_PATH_REQUIRED");
  const targetCount = Number(required(process.argv[5], "EXTERNAL_IMPORT_AUTO_TARGET_REQUIRED"));
  const batchId = required(process.argv[6], "EXTERNAL_IMPORT_AUTO_BATCH_REQUIRED");
  const evaluatedAt = required(process.argv[7], "EXTERNAL_IMPORT_AUTO_TIME_REQUIRED");
  const operatorUserId = Number(required(process.argv[8], "EXTERNAL_IMPORT_AUTO_OPERATOR_REQUIRED"));
  const pool = JSON.parse(await readFile(poolPath, "utf8")) as EnrichedPool;
  const { plan, report } = buildProductionAutoPlan({
    pool,
    targetCount,
    batchId,
    evaluatedAt,
    operatorUserId,
  });
  await mkdir(dirname(planPath), { recursive: true });
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(planPath, canonicalExternalImportPlan(plan), { mode: 0o600 });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/external-import/build-auto-approved-plan.ts")) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "EXTERNAL_IMPORT_AUTO_PLAN_FAILED"}\n`);
    process.exitCode = 1;
  });
}
