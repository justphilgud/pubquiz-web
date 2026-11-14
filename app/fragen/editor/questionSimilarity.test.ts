import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateQuestionSimilarity,
  compareQuestionFingerprints,
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
      selectedSolution: name.split(" ").reverse().join(" "),
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

test("media templates require the stimulus, and distinguish files for the same answer", () => {
  const pixel = (image: string | null) => getQuestionDuplicateFingerprint({
    questionText: "Was ist auf diesem Pixelbild zu sehen?",
    templateId: questionTemplateIds.pixelImage,
    templateConfig: baseConfig,
    answers: [{ text: "Eiffelturm", isCorrect: true }],
    media: [{ slotKey: "pixel_original_image", url: image }],
  });
  assert.equal(pixel(null), "");
  assert.equal(compareQuestionFingerprints(pixel("eiffelturm-a.jpg"), pixel("eiffelturm-b.jpg"), false), 0);
  assert.equal(compareQuestionFingerprints(pixel("eiffelturm-a.jpg"), pixel("/medien/eiffelturm-a.jpg"), false), 1);
});

test("pair comparison preserves correct links but ignores prompt, row order and technical IDs", () => {
  const fingerprint = (pairs: [string, string][], questionText = "Ordne die Begriffe zu") =>
    getQuestionDuplicateFingerprint({
      questionText, templateId: questionTemplateIds.pairs,
      templateConfig: { ...baseConfig, templateData: {
        kind: "PAIRS", pairs: pairs.map(([left, right]) => ({ left, right, leftId: crypto.randomUUID(), rightId: crypto.randomUUID() })),
      } },
      answers: [],
    });
  const pairs = fingerprint([["A", "Eins"], ["B", "Zwei"]]);
  assert.equal(compareQuestionFingerprints(pairs, fingerprint([["B", "Zwei"], ["a", "EINS"]], "Welche Begriffe gehören zusammen?"), false), 1);
  assert.equal(compareQuestionFingerprints(pairs, fingerprint([["A", "Zwei"], ["B", "Eins"]]), false), 0);
  assert.equal(compareQuestionFingerprints(pairs, fingerprint([["C", "Drei"], ["D", "Vier"]]), false), 0);
  assert.equal(fingerprint([["A", ""], ["B", "Zwei"]]), "");
});

test("facts include clues and accepted answers; ordering retains canonical solution order", () => {
  const facts = (clue: string, variant: string) => getQuestionDuplicateFingerprint({
    questionText: "Welche Person ist gesucht?", templateId: questionTemplateIds.factsPerson, answers: [],
    templateConfig: { ...baseConfig, templateData: {
      kind: "FACTS", response: "TEXT", solution: "Ada Lovelace", acceptedVariants: [variant], options: [],
      facts: [clue, "Schrieb einen Algorithmus", "Lebte im 19. Jahrhundert"].map(text => ({ text, id: crypto.randomUUID() })),
    } },
  });
  const first = facts("Lebte in London", "Ada");
  assert.ok(first);
  assert.equal(first, facts("Lebte in London", "Ada"));
  assert.notEqual(first, facts("Wurde 1815 geboren", "Ada"));
  assert.notEqual(first, facts("Lebte in London", "Lovelace"));
  const ordering = (items: string[]) => getQuestionDuplicateFingerprint({
    questionText: "Bringe die Ereignisse in Reihenfolge", templateId: questionTemplateIds.ordering, answers: [],
    templateConfig: { ...baseConfig, templateData: {
      kind: "ORDERING", scoring: "EXACT",
      items: items.map(text => ({ id: crypto.randomUUID(), text, explanation: "" })),
    } },
  });
  assert.notEqual(ordering(["A", "B"]), ordering(["B", "A"]));
});

test("custom templates based on standard questions compare answer fields instead of repeated prompts", () => {
  const fingerprint = (answer: string, sourcePrompt: string) => getQuestionDuplicateFingerprint({
    questionText: sourcePrompt, templateId: null, templateConfig: null, hasCustomTemplate: true,
    answers: [{ text: answer, fieldLabel: "Lösung" }],
  });
  const first = fingerprint("Familie", "Erkenne das Wort");
  assert.equal(first, fingerprint(" Familie ", "Was ist gesucht?"));
  assert.notEqual(first, fingerprint("Auftritt", "Erkenne das Wort"));
  assert.equal(fingerprint("", "Erkenne das Wort"), "");
});
