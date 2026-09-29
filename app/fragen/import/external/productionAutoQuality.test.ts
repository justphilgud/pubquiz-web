import assert from "node:assert/strict";
import test from "node:test";

import {
  assessProductionAutoQuality,
  countIndependentReliableSourceHosts,
  toAutoApprovedPlanItem,
} from "./productionAutoQuality";
import { isStrongPrimaryOrOfficialSource } from "./sourceReliability";
import type {
  ExternalQuestion,
  ExternalQuestionAutomationResult,
} from "./types";

const question: ExternalQuestion = {
  provider: "OpenTDB",
  externalReference: `sha256:${"a".repeat(64)}`,
  contentFingerprint: "a".repeat(64),
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  originalLanguage: "en",
  category: "Science & Nature",
  difficulty: "medium",
  type: "multiple",
  question: "Which planet is known as the Red Planet?",
  correctAnswer: "Mars",
  incorrectAnswers: ["Venus", "Jupiter", "Mercury"],
  providerPayload: {
    type: "multiple",
    difficulty: "medium",
    category: "Science & Nature",
    question: "Which planet is known as the Red Planet?",
    correct_answer: "Mars",
    incorrect_answers: ["Venus", "Jupiter", "Mercury"],
  },
};

function automation(
  overrides: Partial<ExternalQuestionAutomationResult> = {},
): ExternalQuestionAutomationResult {
  return {
    enrichment: {
      question: "Welcher Planet wird als Roter Planet bezeichnet?",
      correctAnswer: "Mars",
      incorrectAnswers: ["Venus", "Jupiter", "Merkur"],
      explanation: "Die Eisenoxide auf seiner Oberfläche lassen Mars rot erscheinen.",
      verificationSourceUrl: "https://science.nasa.gov/mars/",
      verificationSourceTitle: "NASA Mars",
      suggestedCategoryName: "Naturwissenschaften",
    },
    localizationStatus: "LOCALIZED",
    localizationNote: null,
    verificationStatus: "VERIFIED",
    verificationNote: "Bestätigt.",
    verificationSources: [
      { title: "NASA", url: "https://science.nasa.gov/mars/" },
      { title: "Britannica", url: "https://www.britannica.com/place/Mars-planet" },
    ],
    flags: {
      ambiguous: false,
      languageDependent: false,
      localContext: false,
      poorDistractor: false,
      sourceQualityLow: false,
      timeSensitive: false,
    },
    changes: ["Deutsche Lokalisierung"],
    rejectRecommended: false,
    rejectionReason: null,
    model: "perplexity/sonar",
    ...overrides,
  };
}

test("auto quality accepts only fully localized, verified candidates with two independent sources", () => {
  const result = assessProductionAutoQuality({ question, automation: automation() });
  assert.equal(result.eligible, true);
  assert.equal(result.classification, "AUTO_APPROVED_FOR_PRODUCTION");
  assert.equal(result.independentReliableSourceHosts, 2);
  assert.equal(result.hasStrongPrimaryOrOfficialSource, true);
  assert.deepEqual(result.failures, []);
  const item = toAutoApprovedPlanItem({
    candidateId: "auto-a",
    question,
    automation: automation(),
    assessment: result,
  });
  assert.equal(item.reviewStatus, "READY_FOR_REVIEW");
  assert.equal(item.autoQualityEvidence?.classification, "AUTO_APPROVED_FOR_PRODUCTION");
});

test("auto quality accepts one strong official primary source", () => {
  const result = assessProductionAutoQuality({
    question,
    automation: automation({
      verificationSources: [{ title: "NASA", url: "https://science.nasa.gov/mars/" }],
    }),
  });
  assert.equal(result.eligible, true);
  assert.equal(result.independentReliableSourceHosts, 1);
  assert.equal(result.hasStrongPrimaryOrOfficialSource, true);
});

test("auto quality still rejects one ordinary secondary source", () => {
  const result = assessProductionAutoQuality({
    question,
    automation: automation({
      verificationSources: [{
        title: "Britannica",
        url: "https://www.britannica.com/place/Mars-planet",
      }],
    }),
  });
  assert.equal(result.eligible, false);
  assert.equal(result.hasStrongPrimaryOrOfficialSource, false);
  assert.deepEqual(result.failures, ["INSUFFICIENT_INDEPENDENT_SOURCES"]);
});

test("subdomains and country domains of one organization do not count as independent", () => {
  assert.equal(countIndependentReliableSourceHosts([
    { url: "https://global.example.com/fact" },
    { url: "https://www.example.co.uk/fact" },
  ]), 1);
});

test("official source detection is suffix-bound and cannot be spoofed by a middle label", () => {
  assert.equal(isStrongPrimaryOrOfficialSource("https://science.nasa.gov/mars/"), true);
  assert.equal(isStrongPrimaryOrOfficialSource("https://service.gov.uk/fact"), true);
  assert.equal(isStrongPrimaryOrOfficialSource("https://gov.example.com/fact"), false);
  assert.equal(isStrongPrimaryOrOfficialSource("https://university.example.com/fact"), false);
});

test("auto quality rejects one-source and unresolved quality cases", () => {
  const result = assessProductionAutoQuality({
    question,
    automation: automation({
      verificationSources: [{
        title: "Britannica",
        url: "https://www.britannica.com/place/Mars-planet",
      }],
      flags: {
        ...automation().flags,
        poorDistractor: true,
      },
    }),
  });
  assert.equal(result.eligible, false);
  assert.deepEqual(new Set(result.failures), new Set([
    "INSUFFICIENT_INDEPENDENT_SOURCES",
    "QUALITY_NOT_READY",
  ]));
  assert.throws(() => toAutoApprovedPlanItem({
    candidateId: "auto-a",
    question,
    automation: automation(),
    assessment: result,
  }), /EXTERNAL_IMPORT_CANDIDATE_NOT_AUTO_APPROVED/);
});

test("semantic duplicate blocks automatic approval", () => {
  const result = assessProductionAutoQuality({
    question,
    automation: automation(),
    existingQuestions: [{
      questionId: 9,
      question: "Welcher Planet ist als der Rote Planet bekannt?",
    }],
  });
  assert.equal(result.eligible, false);
  assert.ok(result.failures.includes("QUALITY_NOT_READY"));
});
