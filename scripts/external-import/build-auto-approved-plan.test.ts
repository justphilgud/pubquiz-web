import assert from "node:assert/strict";
import test from "node:test";

import type { ExternalImportPlanItem } from "../../app/fragen/import/external/productionImportGuard";
import {
  selectBalancedProductionCandidates,
  type AutoApprovedCandidate,
} from "./build-auto-approved-plan";

function candidate(id: number, category: string, difficulty: number): AutoApprovedCandidate {
  return {
    sourceReference: `source-${String(id).padStart(3, "0")}`,
    item: {
      candidateId: `candidate-${id}`,
      externalReference: `source-${id}`,
      contentFingerprint: id.toString(16).padStart(64, "0"),
      original: {
        language: "en", category, difficulty: "medium", type: "multiple",
        question: `Original ${id}?`, correctAnswer: "Right",
        incorrectAnswers: ["A", "B", "C"], providerPayload: {},
      },
      prepared: {
        question: `Frage ${id}?`, correctAnswer: "Richtig", distractors: ["A", "B", "C"],
        explanation: null, difficulty, category,
      },
      verification: {
        status: "VERIFIED",
        sources: [
          { title: "A", url: "https://example.org/a" },
          { title: "B", url: "https://example.edu/b" },
        ],
      },
      autoQualityEvidence: {
        classification: "AUTO_APPROVED_FOR_PRODUCTION",
        policyVersion: "production-auto-quality-v1",
        localizationStatus: "LOCALIZED",
        qualityStatus: "READY_FOR_REVIEW",
        issueCodes: [],
        independentReliableSourceHosts: 2,
      },
      reviewStatus: "READY_FOR_REVIEW",
      license: { name: "CC", url: "https://example.org/license" },
      media: [],
    } satisfies ExternalImportPlanItem,
  };
}

test("balanced selection reaches the requested 25/50/25 difficulty mix", () => {
  const pool = [25, 50, 75].flatMap((difficulty) =>
    Array.from({ length: difficulty === 50 ? 50 : 25 }, (_, index) =>
      candidate(difficulty * 100 + index, `Kategorie ${index % 10}`, difficulty)
    )
  );
  const selected = selectBalancedProductionCandidates(pool, 100);
  const difficulties = selected.map(({ item }) => item.prepared.difficulty);
  assert.equal(difficulties.filter((value) => value === 25).length, 25);
  assert.equal(difficulties.filter((value) => value === 50).length, 50);
  assert.equal(difficulties.filter((value) => value === 75).length, 25);
  const categories = selected.map(({ item }) => item.prepared.category);
  assert.ok(Math.max(...new Set(categories).values().map((category) =>
    categories.filter((value) => value === category).length
  )) <= 15);
});

test("balanced selection fails closed when category cap prevents the target", () => {
  const pool = Array.from({ length: 10 }, (_, index) => candidate(index, "Nur eine", 50));
  assert.throws(
    () => selectBalancedProductionCandidates(pool, 10),
    /EXTERNAL_IMPORT_AUTO_POOL_INSUFFICIENT/,
  );
});
