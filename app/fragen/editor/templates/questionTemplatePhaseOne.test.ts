import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  getQuestionTemplateDefinition,
  questionTemplateDefinitions,
  validateQuestionTemplateDefinitions,
} from "./questionTemplates";
import { questionTemplateIds } from "./questionTemplateRegistry";
import {
  generateAnagramSuggestionCandidates,
  generateAnagramSuggestions,
  getLegacyTrueFalseStatement,
  getQuestionTemplateValidationIssue,
  isAllowedGoogleMapsUrl,
  isExactAnagram,
  parseQuestionTemplateData,
  resolveQuestionText,
  TRANSLATION_TEXT_MAX_LENGTH,
} from "./questionTemplateData";
import {
  buildQuestionTemplateRuntimeModel,
  evaluateStructuredAnswer,
} from "./questionTemplateRuntime";
import { parseQuestionTemplateConfigDraft } from "../pixelTemplateConfig";

test("phase-one templates are enabled and fully registered", () => {
  assert.deepEqual(validateQuestionTemplateDefinitions(), []);
  for (const id of [
    questionTemplateIds.trueFalse,
    questionTemplateIds.estimate,
    questionTemplateIds.ordering,
    questionTemplateIds.translationReadAloud,
    questionTemplateIds.anagram,
    questionTemplateIds.googleReviews,
  ]) {
    const definition = getQuestionTemplateDefinition(id);
    assert.equal(definition?.enabled, true);
    assert.equal(definition?.availableForFiltering, true);
    assert.ok(definition?.icon);
    assert.ok(definition?.answerMode);
    assert.ok(definition?.evaluationMode);
    assert.ok(definition?.editorKind);
    assert.ok(definition?.presentationKind);
    assert.ok(definition?.answerFormKind);
  }
  assert.equal(
    new Set(questionTemplateDefinitions.map((entry) => entry.id)).size,
    questionTemplateDefinitions.length,
  );
  assert.equal(
    getQuestionTemplateDefinition(questionTemplateIds.trueFalse)?.questionLabelKey,
    "statement",
  );
});

test("shared controls cover segmented boolean, sortable order and browser voices", () => {
  const editor = readFileSync(
    "app/fragen/editor/components/StructuredTemplateEditor.tsx",
    "utf8",
  );
  const sortable = readFileSync(
    "app/fragen/editor/components/SortableTemplateList.tsx",
    "utf8",
  );
  const answerForm = readFileSync(
    "app/quiz/[quizId]/antworten/QuizAntwortClient.tsx",
    "utf8",
  );
  const voices = readFileSync(
    "app/fragen/editor/components/useSpeechVoices.ts",
    "utf8",
  );
  const presentation = readFileSync(
    "app/quiz/[quizId]/praesentation/QuizPraesentationPlayer.tsx",
    "utf8",
  );

  assert.match(editor, /aria-pressed=\{active\}/);
  assert.doesNotMatch(editor, /data\.statement/);
  assert.match(editor, /SortableTemplateList/);
  assert.match(answerForm, /SortableTemplateList/);
  assert.match(sortable, /PointerSensor/);
  assert.match(sortable, /KeyboardSensor/);
  assert.match(sortable, /touch-none/);
  assert.match(voices, /speechSynthesis\.getVoices\(\)/);
  assert.match(voices, /voiceschanged/);
  assert.match(editor, /Passend zur Zielsprache/);
  assert.match(editor, /Weitere Stimmen/);
  assert.match(editor, /voiceId/);
  assert.match(answerForm, /templateData\.unit/);
  assert.match(presentation, /Google-Nutzer/);
  assert.match(presentation, /review\.attributionText/);
  assert.match(presentation, /templateData\.unit/);
});

test("true/false uses one policy for editor and runtime", () => {
  const data = parseQuestionTemplateData({
    kind: "TRUE_FALSE",
    correctAnswer: true,
    explanation: "Berlin ist die deutsche Hauptstadt.",
  }, questionTemplateIds.trueFalse, true);
  assert.ok(data && data.kind === "TRUE_FALSE");
  const runtime = buildQuestionTemplateRuntimeModel({
    templateId: questionTemplateIds.trueFalse,
    questionText: "Berlin ist eine Stadt.",
    templateConfig: {
      stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 },
      createPixelQuestionByAnswer: { answer1: false, answer2: false },
      templateData: data,
    },
    correctAnswers: [],
  });
  assert.equal(runtime.answerMode, "BOOLEAN");
  assert.equal(runtime.evaluationMode, "BOOLEAN_MATCH");
  assert.equal(runtime.prompt, "Berlin ist eine Stadt.");
  assert.deepEqual(runtime.solutionLines, [
    "Wahr",
    "Berlin ist die deutsche Hauptstadt.",
  ]);
  assert.equal(evaluateStructuredAnswer(data, "wahr"), true);
});

test("legacy true/false statement is adopted without keeping a second field", () => {
  const templateData = {
    kind: "TRUE_FALSE",
    statement: "Legacy-Aussage",
    correctAnswer: false,
    explanation: "",
  };
  assert.equal(
    getLegacyTrueFalseStatement({ templateData }),
    "Legacy-Aussage",
  );
  assert.equal(
    resolveQuestionText("Kanonische Aussage", { templateData }),
    "Kanonische Aussage",
  );
  assert.equal(resolveQuestionText("", { templateData }), "Legacy-Aussage");
  assert.deepEqual(
    parseQuestionTemplateData(templateData, questionTemplateIds.trueFalse, false),
    { kind: "TRUE_FALSE", correctAnswer: false, explanation: "" },
  );
});

test("ordering evaluates exact order and prepares position scoring", () => {
  const data = parseQuestionTemplateData({
    kind: "ORDERING",
    items: [
      { id: "a", text: "Erstens", explanation: "" },
      { id: "b", text: "Zweitens", explanation: "" },
    ],
    scoring: "EXACT",
  }, questionTemplateIds.ordering, true);
  assert.ok(data && data.kind === "ORDERING");
  assert.equal(evaluateStructuredAnswer(data, '["a","b"]'), true);
  assert.equal(evaluateStructuredAnswer(data, '["b","a"]'), false);
  assert.equal(getQuestionTemplateDefinition(questionTemplateIds.ordering)?.evaluationMode, "ORDER_EXACT");
});

test("anagram generator preserves letters and rejects invalid manual values", () => {
  const suggestions = generateAnagramSuggestions("Schoolmaster");
  assert.ok(suggestions.length >= 5);
  assert.ok(suggestions.every((entry) => isExactAnagram("Schoolmaster", entry)));
  assert.ok(suggestions.every((entry) => entry === entry.toLocaleUpperCase("de-DE")));
  assert.ok(suggestions.some((entry) => entry === "CLASSROOM THE"));
  assert.ok(suggestions.every((entry) => entry.split(" ").length >= 2));
  const flexible = generateAnagramSuggestions("Conversation");
  assert.ok(flexible.some((entry) => entry.split(" ").length === 3));
  assert.ok(flexible.every((entry) => isExactAnagram("Conversation", entry)));
  assert.ok(generateAnagramSuggestions("Weltmitzeit")
    .includes("WELT ZEIT MIT"));
  assert.ok(generateAnagramSuggestions("Welttime")
    .includes("WELT IT ME"));
  const person = generateAnagramSuggestionCandidates("Angela Merkel");
  assert.ok(person.length >= 5);
  assert.ok(person.some((entry) => entry.quality === "MIXED"));
  assert.ok(person.every((entry) => isExactAnagram("Angela Merkel", entry.value)));
  assert.ok(person.every((entry) =>
    !["ANGELA", "MERKEL"].some((part) => entry.value.split(" ").includes(part))
  ));
  const difficult = generateAnagramSuggestionCandidates("XQZZ");
  assert.ok(difficult.length > 0);
  assert.ok(difficult.every((entry) => entry.quality === "FALLBACK"));
  for (const source of ["Ada Lovelace", "Grace Hopper", "Angela Merkel"]) {
    const generated = generateAnagramSuggestions(source);
    assert.equal(new Set(generated).size, generated.length);
    assert.ok(generated.every((entry) => isExactAnagram(source, entry)));
    const compact = source.replace(/[\s-]+/g, "").toLocaleUpperCase("de-DE");
    assert.ok(generated.every((entry) =>
      entry.replaceAll(" ", "") !== [...compact].reverse().join("")
    ));
    assert.ok(generated.every((entry) =>
      !(compact + compact).includes(entry.replaceAll(" ", ""))
    ));
  }
  assert.equal(isExactAnagram("Ada Lovelace", "Ada Lovelace!"), true);
  assert.equal(isExactAnagram("Jörg Weiß", "ßEWI GRÖJ"), true);
  assert.equal(isExactAnagram("Jean-Luc", "CULA JEN"), true);
  assert.equal(isExactAnagram("Ada Lovelace", "Grace Hopper"), false);
  assert.equal(parseQuestionTemplateData({
    kind: "ANAGRAM",
    name: "Ada Lovelace",
    suggestions,
    selectedSolution: "Grace Hopper",
  }, questionTemplateIds.anagram, true), null);
});

test("anagram editor generates automatically without a word-count control", () => {
  const editor = readFileSync(
    "app/fragen/editor/components/StructuredTemplateEditor.tsx",
    "utf8",
  );
  assert.match(editor, />Anagramme erzeugen</);
  assert.doesNotMatch(editor, /Bevorzugte Wortanzahl/);
  assert.doesNotMatch(editor, /Buchstabenvarianten erzeugen/);
  assert.match(editor, /generateAnagramSuggestions\(data\.name\)/);
});

test("estimate keeps closest mode while tolerance evaluation is prepared", () => {
  const definition = getQuestionTemplateDefinition(questionTemplateIds.estimate);
  assert.equal(definition?.evaluationMode, "NUMERIC_CLOSEST");
  const data = parseQuestionTemplateData({
    kind: "ESTIMATE",
    correctValue: 100,
    unit: "km",
    numberFormat: "INTEGER",
    explanation: "",
    tolerance: 5,
  }, questionTemplateIds.estimate, true);
  assert.ok(data && data.kind === "ESTIMATE");
  assert.equal(evaluateStructuredAnswer(data, "104"), true);
  assert.equal(evaluateStructuredAnswer(data, "106"), false);
  assert.equal(parseQuestionTemplateData({
    kind: "ESTIMATE",
    correctValue: 100,
    unit: "",
    numberFormat: "PERCENT",
    explanation: "",
    tolerance: null,
  }, questionTemplateIds.estimate, true), null);
  assert.deepEqual(getQuestionTemplateValidationIssue({
    kind: "ESTIMATE",
    correctValue: 100,
    unit: "",
    numberFormat: "INTEGER",
    explanation: "",
    tolerance: null,
  }, questionTemplateIds.estimate), {
    code: "ESTIMATE_UNIT_REQUIRED",
    field: "templateUnit",
    message: "Bitte gib eine Einheit für die Schätzfrage an.",
  });
});

test("translation languages and length use the central validator", () => {
  const valid = {
    kind: "TRANSLATION_READ_ALOUD" as const,
    originalText: "Hello",
    sourceLanguage: "en",
    targetLanguage: "de",
    translation: "Hallo",
    voiceProvider: "BROWSER" as const,
    voiceId: "default",
    voiceStyle: "",
    voiceInstruction: "",
    speed: 1,
  };
  assert.ok(parseQuestionTemplateData(
    valid,
    questionTemplateIds.translationReadAloud,
    true,
  ));
  assert.equal(parseQuestionTemplateData(
    { ...valid, targetLanguage: "en" },
    questionTemplateIds.translationReadAloud,
    true,
  ), null);
  assert.equal(parseQuestionTemplateData(
    { ...valid, originalText: "x".repeat(TRANSLATION_TEXT_MAX_LENGTH + 1) },
    questionTemplateIds.translationReadAloud,
    false,
  ), null);
  const runtime = buildQuestionTemplateRuntimeModel({
    templateId: questionTemplateIds.translationReadAloud,
    questionText: "Welcher Songtext wurde hier übersetzt?",
    templateConfig: {
      stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 },
      createPixelQuestionByAnswer: { answer1: false, answer2: false },
      templateData: valid,
    },
    correctAnswers: [{ text: "Gesuchte Lösung" }],
  });
  assert.doesNotMatch(runtime.solutionLines.join(" "), /Hello/);
  assert.match(runtime.solutionLines.join(" "), /Gesuchte Lösung/);
});

test("Google review links are allow-listed without accepting arbitrary hosts", () => {
  assert.equal(isAllowedGoogleMapsUrl("https://maps.app.goo.gl/example"), true);
  assert.equal(isAllowedGoogleMapsUrl("https://maps.google.com/example"), true);
  assert.equal(isAllowedGoogleMapsUrl("https://www.google.com/maps/place/example"), true);
  assert.equal(isAllowedGoogleMapsUrl("https://google.com/maps/place/example"), true);
  assert.equal(isAllowedGoogleMapsUrl("http://www.google.com/maps/place/example"), false);
  assert.equal(isAllowedGoogleMapsUrl("https://example.org/maps"), false);
  assert.equal(parseQuestionTemplateData({
    kind: "GOOGLE_REVIEWS",
    placeName: "Beispielort",
    sourceUrl: "",
    mapsUrl: "https://example.org/maps",
    accessedAt: "2026-07-24",
    reviews: [{
      id: "review-1",
      text: "Großartig",
      author: "Ada",
      rating: 5,
      dateLabel: "vor einem Monat",
    }],
    explanation: "",
    sequentialReveal: true,
  }, questionTemplateIds.googleReviews, false), null);
  assert.equal(parseQuestionTemplateData({
    kind: "GOOGLE_REVIEWS",
    placeName: "Beispielort",
    sourceUrl: "https://example.org/review",
    mapsUrl: "",
    accessedAt: "",
    reviews: [{
      id: "review-1",
      text: "Großartig",
      author: "",
      rating: null,
      dateLabel: "",
    }],
    explanation: "",
    sequentialReveal: false,
  }, questionTemplateIds.googleReviews, false), null);
});

test("migration, clone and transfer preserve template identity and config", () => {
  const migration = readFileSync(
    "prisma/migrations/20260724120000_add_phase_one_question_templates/migration.sql",
    "utf8",
  );
  for (const id of [
    "wahr_falsch",
    "schaetzfrage",
    "reihenfolge",
    "uebersetzt_vorgelesen",
    "anagramm",
    "google_rezensionen",
  ]) {
    assert.match(migration, new RegExp(`'${id}'`));
  }
  assert.doesNotMatch(migration, /DROP|DELETE|ALTER\s+TABLE/i);

  const management = readFileSync(
    "app/fragen/editor/managementActions.ts",
    "utf8",
  );
  assert.match(management, /vorlage_id:\s*source\.vorlage_id/);
  assert.match(
    management,
    /template_config_json:\s*source\.template_config_json/,
  );

  const actions = readFileSync("app/fragen/actions.ts", "utf8");
  assert.match(actions, /exportFragenFuerTransfer/);
  assert.match(actions, /template_id/);
  assert.match(actions, /template_config_json/);
});

test("incomplete structured data remains editable in a saved draft", () => {
  const config = parseQuestionTemplateConfigDraft({
    stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 },
    createPixelQuestionByAnswer: { answer1: false, answer2: false },
    templateData: {
      kind: "ANAGRAM",
      name: "Ada Lovelace",
      suggestions: [],
      selectedSolution: "",
    },
  }, questionTemplateIds.anagram);
  assert.equal(config?.templateData?.kind, "ANAGRAM");
  assert.equal(
    config?.templateData?.kind === "ANAGRAM"
      ? config.templateData.selectedSolution
      : null,
    "",
  );
});
