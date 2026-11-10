import assert from "node:assert/strict";
import test from "node:test";
import { defaultFacts, factsAnswers } from "@/app/fragen/editor/templates/factsTemplate";
import { defaultPairs, formatPairMatches, pairColumns, parsePairs, type PairsData } from "@/app/fragen/editor/templates/pairsTemplate";
import { normalizeQuestionTemplateConfig } from "@/app/fragen/editor/pixelTemplateConfig";
import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { questionPhaseMedia } from "@/app/rendering/presentation/questionPhaseMedia";
import { resolveQuizAnswerInteraction } from "./answerInteraction";
import { evaluateBaseAnswer } from "./evaluation/evaluateBaseAnswer";
import { evaluateQuestionPoints } from "./evaluation/evaluateQuestionPoints";
import { resolveEffectiveSubmission } from "./evaluation/effectiveSubmission";
import { getQuestionBaseMaximum, validateQuestionPointsMode } from "./evaluation/questionPointPolicy";
import { interactionPayloadToDraft, validateInteractionPayload } from "./interaction/interactionPayload";
import { shouldKeepInteractionOpenUntilBlockClose } from "./interaction/interactionSubmissionPolicy";
import { canPublishParticipantMedium, projectParticipantQuestionContent } from "./participantQuestionProjection";

const openedAt = new Date("2026-11-10T19:30:00Z");
const context = { state: "OPEN", openedAt, releasedAt: openedAt, isHidden: false };
const input = {
  effectiveAnswerMode: "OPEN" as const, answerOptions: [], selectedAnswerIds: [],
  structuredFields: [], structuredAnswers: new Map(), orderingItems: [],
};

for (const count of [4, 6, 7]) {
  test(`${count} pairs round-trip through draft and submission and score by correct association`, () => {
    const data: PairsData = {
      kind: "PAIRS", pairs: Array.from({ length: count }, (_, index) => ({
        leftId: crypto.randomUUID(), rightId: crypto.randomUUID(),
        left: `Linker Begriff ${index + 1}`, right: `Rechter Begriff ${index + 1}`,
      })),
    };
    const templateId = questionTemplateIds.pairs;
    const config = normalizeQuestionTemplateConfig(JSON.parse(JSON.stringify({ templateData: data })), templateId);
    assert.deepEqual(config?.templateData, data);
    const interaction = resolveQuizAnswerInteraction({
      templateId, originalAnswerMode: "OPEN", effectiveAnswerMode: "OPEN",
      answerFields: [], answerOptions: [], templateData: config?.templateData,
    });
    assert.equal(interaction.type, "MATCHING");
    assert.deepEqual(interaction, { type: "MATCHING", ...pairColumns({ ...data, pairs: [...data.pairs].reverse() }) });
    assert.doesNotMatch(JSON.stringify(interaction), /leftId|rightId|pairs/);
    assert.equal(shouldKeepInteractionOpenUntilBlockClose(interaction.type), true);
    assert.equal(projectParticipantQuestionContent(config, [], context).resolution, null);
    assert.equal(projectParticipantQuestionContent(config, [], { ...context, state: "REVEALED" }).resolution?.answers.length, count);

    const correct = data.pairs.map(({ leftId, rightId }) => [leftId, rightId]);
    const wrong = data.pairs.map(({ leftId }, index) => [leftId, data.pairs[(index + 1) % count].rightId]);
    for (const [matches, points, status] of [
      [correct, count / 4, "CORRECT"], [correct.slice(0, 3), 0.75, "PARTIAL"],
      [wrong, 0, "WRONG"], [[], 0, "UNANSWERED"],
    ] as const) {
      const answerText = JSON.stringify(matches);
      const validated = validateInteractionPayload(interaction, { answerText, selectedAnswerIds: [], structuredAnswers: [] });
      assert.equal(validated.hasContent, matches.length > 0);
      assert.equal(interactionPayloadToDraft(interaction, validated.payload)?.antwortText, answerText);
      const effective = resolveEffectiveSubmission({
        interactionRunId: 2,
        draft: { antwort_text: null, antwort_id: null, antwortauswahlen: [], antwortfelder: [] },
        submissions: [{
          interaction_run_id: 2, team_answer_submission_id: 5, submission_version: 1,
          status: "SUBMITTED", interaction_type: "MATCHING", payload: validated.payload,
        }],
      });
      const scored = evaluateBaseAnswer({ ...input, templateId, pairs: data, answerText: effective?.answerText ?? null });
      assert.equal(scored.status, status);
      assert.equal(scored.basePoints.toNumber(), points);
      assert.equal(scored.maxPoints.toNumber(), count / 4);
      assert.equal(evaluateQuestionPoints(scored, "expertenbonus").finalPoints.toNumber(), points * 2);
    }
    const policy = { templateId, correctAnswerCount: 0, structuredFieldCount: 0, orderingItemCount: count };
    assert.equal(getQuestionBaseMaximum(policy).toNumber(), count / 4);
    assert.throws(() => validateQuestionPointsMode({ ...policy, pointsMode: "risikofrage" }), /Teilpunkte/);
    assert.equal(formatPairMatches(data, JSON.stringify(correct.slice(0, 1))), "Linker Begriff 1 ↔ Rechter Begriff 1");

    for (const invalid of [[correct[0], correct[0]], [[correct[0][0], "unknown"]], [[correct[0][0], correct[1][0]]]]) {
      assert.throws(() => validateInteractionPayload(interaction, {
        answerText: JSON.stringify(invalid), selectedAnswerIds: [], structuredAnswers: [],
      }), /ungültig/);
    }
  });
}

test("pair definitions reject incomplete, ambiguous and reused entries", () => {
  const data = defaultPairs();
  assert.equal(parsePairs(data, true), null);
  data.pairs[0] = { ...data.pairs[0], left: " Zürich ", right: "Schweiz" };
  data.pairs[1] = { ...data.pairs[1], left: "ZÜRICH", right: "Deutschland" };
  assert.equal(parsePairs(data, true), null);
  data.pairs[1].left = "Berlin";
  assert.equal(parsePairs(data, true)?.pairs[0].left, "Zürich");
  data.pairs[1].rightId = data.pairs[0].leftId;
  assert.equal(parsePairs(data, true), null);
});

test("facts person uses free text, variants and reveal-only content", () => {
  const templateId = questionTemplateIds.factsPerson;
  const data = {
    ...defaultFacts("TEXT"), solution: "Wilhelm Tell", acceptedVariants: ["Tell"],
    facts: [{ id: "a", text: "Schweiz" }, { id: "b", text: "Armbrust" }, { id: "c", text: "Apfel" }],
  };
  const config = normalizeQuestionTemplateConfig({ templateData: data }, templateId);
  assert.ok(config);
  assert.equal(normalizeQuestionTemplateConfig({
    templateData: { ...data, options: [{ id: "a", text: "a", isCorrect: true }, { id: "b", text: "b", isCorrect: false }] },
  }, templateId), null);
  const interaction = resolveQuizAnswerInteraction({
    templateId, originalAnswerMode: "OPEN", effectiveAnswerMode: "OPEN",
    answerFields: [], answerOptions: [], templateData: data,
  });
  assert.equal(interaction.type, "TEXT");
  const answerOptions = factsAnswers(data, []).map((answer, id) => ({ ...answer, id }));
  for (const [answerText, status] of [["wilhelm tell", "CORRECT"], ["Tell", "CORRECT"], ["Robin Hood", "REVIEW_REQUIRED"]]) {
    assert.equal(evaluateBaseAnswer({ ...input, templateId, answerOptions, answerText }).status, status);
  }

  const slotKey = "facts_person_solution_image";
  const media = [{ datei: "portrait.png", slotKey }];
  assert.deepEqual(questionPhaseMedia(templateId, media, "QUESTION"), []);
  assert.deepEqual(questionPhaseMedia(templateId, media, "SOLUTION"), media);
  assert.equal(canPublishParticipantMedium(slotKey, context), false);
  assert.equal(canPublishParticipantMedium(slotKey, { ...context, state: "REVEALED" }), true);
  assert.doesNotMatch(JSON.stringify(projectParticipantQuestionContent(config, [], context)), /Wilhelm Tell|acceptedVariants/);
  assert.deepEqual(projectParticipantQuestionContent(config, [], { ...context, state: "REVEALED" }).resolution?.answers, ["Wilhelm Tell"]);
});
