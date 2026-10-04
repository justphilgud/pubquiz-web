import assert from "node:assert/strict";
import test from "node:test";
import { defaultFacts, factsAnswers, parseFacts, isValidYear } from "./factsTemplate";
import { questionTemplateIds } from "./questionTemplateRegistry";
import { getQuestionAnswerMode } from "@/app/fragen/questionAnswerMode";
import { resolveQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import { validateInteractionPayload, interactionPayloadToDraft } from "@/app/quiz/interaction/interactionPayload";
import { evaluateBaseAnswer } from "@/app/quiz/evaluation/evaluateBaseAnswer";
import { COUNTRY_OPTIONS, isCountryCode } from "@/app/lib/countries";
import { buildQuestionTemplateRuntimeModel } from "./questionTemplateRuntime";
import { parseQuestionTemplateConfigDraft, normalizeQuestionTemplateConfig, DEFAULT_PIXEL_TEMPLATE_CONFIG } from "../pixelTemplateConfig";

const data = { ...defaultFacts("YEAR"), solution: "1994", facts: [{ id: "a", text: "Deutschland wird Weltmeister." }, { id: "b", text: "Der Eurotunnel wird eröffnet." }] };
const base = { effectiveAnswerMode: "OPEN" as const, answerOptions: [], selectedAnswerIds: [], answerText: null, structuredFields: [], structuredAnswers: new Map(), orderingItems: [] };

test("facts boundaries, nonempty content, IDs and ordered reload", () => {
  for (const count of [2, 7]) {
    const value = { ...data, facts: Array.from({ length: count }, (_, i) => ({ id: String(i), text: `Fakt ${i}` })) };
    assert.deepEqual(parseFacts(value, "YEAR", true), value);
    const config = { ...DEFAULT_PIXEL_TEMPLATE_CONFIG, templateData: value };
    assert.deepEqual(parseQuestionTemplateConfigDraft(JSON.parse(JSON.stringify(config)), questionTemplateIds.factsYear), config);
    assert.deepEqual(normalizeQuestionTemplateConfig(config, questionTemplateIds.factsYear), config);
  }
  for (const facts of [[], [data.facts[0]], Array(8).fill(data.facts[0]), [data.facts[0], { id: "b", text: " " }], [data.facts[0], data.facts[0]]]) {
    assert.equal(parseFacts({ ...data, facts }, "YEAR", false), null);
  }
  assert.equal(parseFacts({ ...data, facts: data.facts.map((fact) => ({ ...fact, text: "x".repeat(301) })) }, "YEAR", false), null);
  const reversed = { ...data, facts: [...data.facts].reverse() };
  assert.deepEqual(parseFacts(JSON.parse(JSON.stringify(reversed)), "YEAR", true)?.facts, reversed.facts);
  assert.equal(parseFacts({ ...data, facts: data.facts.map((fact) => ({ ...fact, text: "Lang ".repeat(60) })) }, "YEAR", true)?.facts.length, 2);
});

test("year boundaries and country membership", () => {
  for (const value of ["1", "1994", "9999"]) assert.equal(isValidYear(value), true);
  for (const value of ["0", "-1", "10000", "1994.5", "01994", "1e3"]) assert.equal(isValidYear(value), false);
  assert.equal(COUNTRY_OPTIONS.length, 193);
  assert.equal(new Set(COUNTRY_OPTIONS.map((country) => country.value)).size, 193);
  assert.equal(isCountryCode("CH"), true);
  for (const value of ["GL", "TW", "XK", "VA", "Schweiz"]) assert.equal(isCountryCode(value), false);
  assert.equal(parseFacts({ ...data, response: "COUNTRY", solution: "GL" }, "COUNTRY", true), null);
});

test("year and country use shared payload, reload and exact evaluation", () => {
  for (const [templateId, response, solution, wrong] of [[questionTemplateIds.factsYear, "YEAR", "1994", "1995"], [questionTemplateIds.factsCountry, "COUNTRY", "CH", "DE"]] as const) {
    const templateData = { ...data, response, solution };
    const interaction = resolveQuizAnswerInteraction({ templateId, templateData, originalAnswerMode: "OPEN", effectiveAnswerMode: "OPEN", answerFields: [], answerOptions: [] });
    assert.equal(interaction.type, response === "YEAR" ? "NUMBER" : "TEXT");
    const draft = { answerText: solution, selectedAnswerIds: [], structuredAnswers: [] };
    const validated = validateInteractionPayload(interaction, draft);
    assert.equal(validated.hasContent, true);
    assert.equal(interactionPayloadToDraft(interaction, JSON.parse(JSON.stringify(validated.payload))).antwortText, solution);
    assert.throws(() => validateInteractionPayload(interaction, { ...draft, answerText: response === "YEAR" ? "1e3" : "GL" }));
    const answers = factsAnswers(templateData, []).map((answer, index) => ({ id: index + 1, text: answer.text, isCorrect: answer.isCorrect }));
    assert.equal(evaluateBaseAnswer({ ...base, templateId, answerOptions: answers, answerText: solution }).status, "CORRECT");
    assert.equal(evaluateBaseAnswer({ ...base, templateId, answerOptions: answers, answerText: wrong }).status, "WRONG");
    assert.equal(evaluateBaseAnswer({ ...base, templateId, answerOptions: answers }).status, "UNANSWERED");
  }
});

test("free answer variants remain hidden and visible options use single choice", () => {
  const templateId = questionTemplateIds.factsText;
  const open = { ...data, response: "TEXT" as const, solution: "Albert Einstein", acceptedVariants: ["Einstein"] };
  const answers = factsAnswers(open, []);
  assert.equal(getQuestionAnswerMode({ templateId, answers }), "OPEN");
  const input = { templateId, templateData: open, originalAnswerMode: "OPEN" as const, effectiveAnswerMode: "OPEN" as const, answerFields: [], answerOptions: answers.map((answer, index) => ({ id: index + 1, label: answer.text })) };
  const interaction = resolveQuizAnswerInteraction(input);
  assert.equal(interaction.type, "TEXT");
  assert.equal(JSON.stringify(interaction).includes("Einstein"), false);
  for (const answerText of ["Albert Einstein", "einstein"]) assert.equal(evaluateBaseAnswer({ ...base, templateId, answerText, answerOptions: answers.map((answer, index) => ({ id: index + 1, text: answer.text, isCorrect: true })) }).status, "CORRECT");
  const choice = { ...open, acceptedVariants: [], options: [{ id: "x", text: "Einstein", isCorrect: true }, { id: "y", text: "Newton", isCorrect: false }] };
  assert.ok(parseFacts(choice, "TEXT", true));
  assert.equal(parseFacts({ ...choice, acceptedVariants: ["Einstein"] }, "TEXT", true), null);
  assert.equal(parseFacts({ ...choice, options: choice.options.map((option) => ({ ...option, isCorrect: true })) }, "TEXT", true), null);
  const options = factsAnswers(choice, []);
  assert.equal(getQuestionAnswerMode({ templateId, answers: options }), "CLOSED");
  const closed = resolveQuizAnswerInteraction({ ...input, templateData: choice, originalAnswerMode: "CLOSED", effectiveAnswerMode: "CLOSED", answerOptions: options.map((option, index) => ({ id: index + 1, label: option.text })) });
  assert.equal(closed.type, "SINGLE_CHOICE");
  const evaluated = { ...base, templateId, effectiveAnswerMode: "CLOSED" as const, answerOptions: options.map((option, index) => ({ id: index + 1, text: option.text, isCorrect: option.isCorrect })) };
  assert.equal(evaluateBaseAnswer({ ...evaluated, selectedAnswerIds: [1] }).status, "CORRECT");
  assert.equal(evaluateBaseAnswer({ ...evaluated, selectedAnswerIds: [2] }).status, "WRONG");
  const runtime = buildQuestionTemplateRuntimeModel({ templateId, questionText: "Person?", templateConfig: { ...DEFAULT_PIXEL_TEMPLATE_CONFIG, templateData: open }, correctAnswers: answers });
  assert.deepEqual(runtime.solutionLines, ["Albert Einstein"]);
});
