import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateQuestionSimilarity,
  getQuestionDuplicateFingerprint,
  isPotentialQuestionDuplicate,
  normalizeQuestionForSimilarity,
} from "./questionSimilarity";
import { questionTemplateIds } from "./templates/questionTemplateRegistry";

const baseConfig = {
  stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 },
  createPixelQuestionByAnswer: { answer1: false, answer2: false },
};

test("question similarity ignores casing, punctuation and umlaut spelling noise", () => {
  assert.equal(
    normalizeQuestionForSimilarity("  WELCHE Stadt ist größer? "),
    "welche stadt ist grosser",
  );
  assert.equal(
    isPotentialQuestionDuplicate(
      "Welche Stadt ist größer: Hamburg oder München?",
      "Welche Stadt ist groesser Hamburg oder Muenchen",
    ),
    true,
  );
});

test("question similarity keeps unrelated questions apart", () => {
  assert.ok(
    calculateQuestionSimilarity(
      "Wer schrieb den Roman Der Prozess?",
      "Wie hoch ist der Mount Everest?",
    ) < 0.3,
  );
});

test("generic translation prompts use original text and solution for duplicates", () => {
  const first = getQuestionDuplicateFingerprint({
    questionText: "Welcher Songtext wurde hier übersetzt?",
    templateId: questionTemplateIds.translationReadAloud,
    templateConfig: {
      ...baseConfig,
      templateData: {
        kind: "TRANSLATION_READ_ALOUD",
        originalText: "Hello darkness my old friend",
        sourceLanguage: "en",
        targetLanguage: "de",
        translation: "Hallo Dunkelheit",
        voiceProvider: "BROWSER",
        voiceId: "default",
        voiceStyle: "",
        voiceInstruction: "",
        speed: 1,
      },
    },
    answers: [{ text: "The Sound of Silence", isCorrect: true }],
  });
  const other = getQuestionDuplicateFingerprint({
    questionText: "Welcher Songtext wurde hier übersetzt?",
    templateId: questionTemplateIds.translationReadAloud,
    templateConfig: {
      ...baseConfig,
      templateData: {
        kind: "TRANSLATION_READ_ALOUD",
        originalText: "Is this the real life",
        sourceLanguage: "en",
        targetLanguage: "de",
        translation: "Ist dies das echte Leben",
        voiceProvider: "BROWSER",
        voiceId: "default",
        voiceStyle: "",
        voiceInstruction: "",
        speed: 1,
      },
    },
    answers: [{ text: "Bohemian Rhapsody", isCorrect: true }],
  });
  assert.equal(calculateQuestionSimilarity(first, other) < 0.58, true);
  assert.equal(calculateQuestionSimilarity(first, first), 1);
});

test("template fingerprints retain their business-specific duplicate core", () => {
  const anagram = (name: string) => getQuestionDuplicateFingerprint({
    questionText: "Welcher Name verbirgt sich hinter diesem Anagramm?",
    templateId: questionTemplateIds.anagram,
    templateConfig: {
      ...baseConfig,
      templateData: {
        kind: "ANAGRAM",
        name,
        selectedSolution: "TEST",
        suggestions: [],
        wordCountPreference: "AUTO",
      },
    },
    answers: [{ text: name, isCorrect: true }],
  });
  assert.equal(anagram("Ada Lovelace"), anagram("Ada Lovelace"));
  assert.notEqual(anagram("Ada Lovelace"), anagram("Grace Hopper"));

  const standard = getQuestionDuplicateFingerprint({
    questionText: "Wer schrieb den Roman Der Prozess?",
    templateId: null,
    templateConfig: null,
    answers: [],
  });
  assert.equal(standard, "wer schrieb den roman der prozess");
});
