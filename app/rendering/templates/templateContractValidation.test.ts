import assert from "node:assert/strict";
import test from "node:test";

import {
  isInteractionEvaluationCompatible,
  type TemplateDefinition,
} from "./templateContract";
import {
  podiumTemplateContract,
} from "./referenceTemplates";
import {
  getQuestionTemplateContract,
  questionTemplateContractRegistry,
} from "@/app/fragen/editor/templates/questionTemplates";
import {
  validateTemplateContract,
  validateTemplateContractRegistry,
} from "./templateContractValidation";

function cloneTemplate(template: TemplateDefinition): TemplateDefinition {
  return structuredClone(template);
}

const standardQuestionTemplateContract =
  getQuestionTemplateContract("standard")!;
const pixelRevealTemplateContract =
  getQuestionTemplateContract("pixelbild")!;

test("all derived and standalone contracts are valid and versioned uniquely", () => {
  assert.deepEqual(
    validateTemplateContractRegistry(questionTemplateContractRegistry),
    [],
  );
  assert.equal(
    new Set(
      questionTemplateContractRegistry.map(
        (template) =>
          `${template.identity.templateId}@${template.identity.version}`,
      ),
    ).size,
    questionTemplateContractRegistry.length,
  );
  assert.ok(
    questionTemplateContractRegistry.every(
      (template) =>
        Number.isInteger(template.identity.version) &&
        template.identity.version > 0,
    ),
  );
});

test("registry validation rejects ambiguous legacy resolution IDs", () => {
  const duplicateAlias = cloneTemplate(podiumTemplateContract);
  duplicateAlias.compatibility.legacyMappings = [
    { templateId: "standard" },
  ];

  assert.ok(
    validateTemplateContractRegistry([
      standardQuestionTemplateContract,
      duplicateAlias,
    ]).some(
      (validationIssue) =>
        validationIssue.code === "DUPLICATE_RESOLUTION_ID",
    ),
  );
});

test("standard question interaction and evaluation compatibility is central", () => {
  assert.equal(isInteractionEvaluationCompatible("TEXT", "MANUAL"), true);
  assert.equal(
    isInteractionEvaluationCompatible("TEXT", "NORMALIZED_TEXT_MATCH"),
    true,
  );
  assert.equal(
    isInteractionEvaluationCompatible("SINGLE_CHOICE", "CHOICE_MATCH"),
    true,
  );
  assert.equal(
    isInteractionEvaluationCompatible("MULTI_CHOICE", "CLOSEST_VALUE"),
    false,
  );
  assert.equal(
    standardQuestionTemplateContract.interaction.quizOverrideAllowed,
    true,
  );
  assert.equal(
    standardQuestionTemplateContract.overrides.properties.answerMode,
    "SLIDE",
  );
  assert.equal(
    standardQuestionTemplateContract.overrides.properties.solution,
    "LOCKED",
  );
});

test("every allowed interaction has one executable answer-form definition", () => {
  for (const contract of questionTemplateContractRegistry) {
    assert.deepEqual(
      new Set(contract.interaction.answerForms.map((form) => form.type)),
      new Set(contract.interaction.allowedTypes),
      contract.identity.templateId,
    );
  }

  const duplicate = cloneTemplate(standardQuestionTemplateContract);
  duplicate.interaction.answerForms = [
    ...duplicate.interaction.answerForms,
    duplicate.interaction.answerForms[0],
  ];
  assert.ok(
    validateTemplateContract(duplicate).some(
      (validationIssue) => validationIssue.code === "DUPLICATE_ANSWER_FORM",
    ),
  );

  const missing = cloneTemplate(standardQuestionTemplateContract);
  missing.interaction.answerForms = missing.interaction.answerForms.filter(
    (form) => form.type !== "TEXT",
  );
  assert.ok(
    validateTemplateContract(missing).some(
      (validationIssue) => validationIssue.code === "MISSING_ANSWER_FORM",
    ),
  );

  const notAllowed = cloneTemplate(standardQuestionTemplateContract);
  notAllowed.interaction.allowedTypes = ["TEXT"];
  assert.ok(
    validateTemplateContract(notAllowed).some(
      (validationIssue) => validationIssue.code === "ANSWER_FORM_NOT_ALLOWED",
    ),
  );
});

test("planned poll and matching interactions remain centrally modelled", () => {
  assert.equal(isInteractionEvaluationCompatible("POLL_SINGLE", "NONE"), true);
  assert.equal(isInteractionEvaluationCompatible("POLL_MULTI", "NONE"), true);
  assert.equal(isInteractionEvaluationCompatible("POLL_SCALE", "NONE"), true);
  assert.equal(isInteractionEvaluationCompatible("MATCHING", "MANUAL"), true);
});

test("incompatible defaults and NONE mismatches are reported with stable codes", () => {
  const invalidStandard = cloneTemplate(standardQuestionTemplateContract);
  invalidStandard.interaction.defaultType = "SINGLE_CHOICE";
  invalidStandard.evaluation.defaultType = "CLOSEST_VALUE";
  invalidStandard.evaluation.allowedTypes = ["CLOSEST_VALUE"];

  const invalidNone = cloneTemplate(podiumTemplateContract);
  invalidNone.evaluation.defaultType = "MANUAL";
  invalidNone.evaluation.allowedTypes = ["MANUAL"];

  assert.ok(
    validateTemplateContract(invalidStandard).some(
      (validationIssue) =>
        validationIssue.code ===
        "INCOMPATIBLE_INTERACTION_EVALUATION",
    ),
  );
  assert.ok(
    validateTemplateContract(invalidNone).some(
      (validationIssue) =>
        validationIssue.code === "INVALID_NONE_EVALUATION",
    ),
  );
});

test("pixel reveal requires generated persisted stages and at least two items", () => {
  const pixelStageSlot = pixelRevealTemplateContract.components.slots.find(
    (slot) => slot.slotId === "pixelStages",
  );
  const pixelSource = pixelRevealTemplateContract.dataSources.find(
    (source) => source.sourceId === "pixelStages",
  );

  assert.equal(pixelRevealTemplateContract.reveal.required, true);
  assert.equal(pixelStageSlot?.minItems, 2);
  assert.equal(pixelSource?.type, "GENERATED");
  assert.equal(pixelSource?.resolution, "STORED_REFERENCE");
  assert.equal(pixelSource?.persistence, "CONTENT_ITEM");
  assert.equal(
    pixelRevealTemplateContract.authoring.capabilities.includes(
      "PIXEL_GENERATOR",
    ),
    true,
  );
  assert.equal(
    pixelRevealTemplateContract.overrides.properties.points,
    "SLIDE",
  );
  assert.equal(
    pixelRevealTemplateContract.overrides.properties.stageTimings,
    "SLIDE",
  );

  const missingSource = cloneTemplate(pixelRevealTemplateContract);
  missingSource.dataSources = missingSource.dataSources.filter(
    (source) => source.sourceId !== "pixelStages",
  );
  assert.ok(
    validateTemplateContract(missingSource).some(
      (validationIssue) => validationIssue.code === "MISSING_DATA_SOURCE",
    ),
  );
});

test("generated and snapshot data source constraints reject invalid combinations", () => {
  const invalidGenerated = cloneTemplate(pixelRevealTemplateContract);
  invalidGenerated.dataSources = invalidGenerated.dataSources.map((source) =>
    source.sourceId === "pixelStages"
      ? { ...source, persistence: "RUNTIME_STATE" }
      : source,
  );

  const invalidSnapshot = cloneTemplate(standardQuestionTemplateContract);
  invalidSnapshot.dataSources = invalidSnapshot.dataSources.map((source) => ({
    ...source,
    persistence: "SNAPSHOT",
  }));

  const invalidFallback = cloneTemplate(standardQuestionTemplateContract);
  invalidFallback.dataSources = invalidFallback.dataSources.map((source) => ({
    ...source,
    fallback: "UNKNOWN",
  })) as unknown as TemplateDefinition["dataSources"];

  assert.ok(
    validateTemplateContract(invalidGenerated).some(
      (validationIssue) =>
        validationIssue.code ===
        "INVALID_GENERATED_SOURCE_PERSISTENCE",
    ),
  );
  assert.ok(
    validateTemplateContract(invalidSnapshot).some(
      (validationIssue) =>
        validationIssue.code === "INVALID_SNAPSHOT_SOURCE",
    ),
  );
  assert.ok(
    validateTemplateContract(invalidFallback).some(
      (validationIssue) =>
        validationIssue.code === "INVALID_DATA_SOURCE_FALLBACK",
    ),
  );
});

test("contract validation rejects duplicate aliases inside one contract", () => {
  const duplicateAlias = cloneTemplate(standardQuestionTemplateContract);
  duplicateAlias.compatibility.legacyMappings = [
    ...duplicateAlias.compatibility.legacyMappings,
    { templateId: "multiple-choice", interactionType: "MULTI_CHOICE" },
  ];

  assert.ok(
    validateTemplateContract(duplicateAlias).some(
      (validationIssue) =>
        validationIssue.code === "DUPLICATE_LEGACY_MAPPING",
    ),
  );
});

test("media references reject unknown, duplicate and incompatible slot policies", () => {
  const unknown = cloneTemplate(standardQuestionTemplateContract);
  unknown.components.slots[0].mediaSlotKeys = [
    "unknown_media_slot",
  ] as never;

  const duplicate = cloneTemplate(standardQuestionTemplateContract);
  duplicate.components.slots[0].mediaSlotKeys = ["question_image"];

  const incompatible = cloneTemplate(standardQuestionTemplateContract);
  incompatible.components.slots[0].componentType = "AUDIO";
  incompatible.components.slots[0].mediaSlotKeys = ["question_image"];

  assert.ok(
    validateTemplateContract(unknown).some(
      (validationIssue) => validationIssue.code === "UNKNOWN_MEDIA_SLOT",
    ),
  );
  assert.ok(
    validateTemplateContract(duplicate).some(
      (validationIssue) =>
        validationIssue.code === "DUPLICATE_MEDIA_SLOT_REFERENCE",
    ),
  );
  assert.ok(
    validateTemplateContract(incompatible).some(
      (validationIssue) =>
        validationIssue.code === "MEDIA_SLOT_COMPONENT_MISMATCH",
    ),
  );
});

test("podium is runtime-only, snapshot-backed and not a creation template", () => {
  const rankingSlot = podiumTemplateContract.components.slots[0];
  const rankingSource = podiumTemplateContract.dataSources[0];

  assert.equal(podiumTemplateContract.interaction.defaultType, "NO_ANSWER");
  assert.equal(podiumTemplateContract.evaluation.defaultType, "NONE");
  assert.equal(rankingSlot.componentType, "RANKING");
  assert.equal(rankingSlot.minItems, 1);
  assert.equal(rankingSource.type, "RUNTIME");
  assert.equal(rankingSource.persistence, "SNAPSHOT");
  assert.equal(podiumTemplateContract.lifecycle.status, "EXPERIMENTAL");
  assert.equal(podiumTemplateContract.lifecycle.availability.create, false);

  const staticRanking = cloneTemplate(podiumTemplateContract);
  staticRanking.dataSources = [
    {
      ...staticRanking.dataSources[0],
      type: "STATIC",
      resolution: "CONTENT_ITEM",
      persistence: "CONTENT_ITEM",
    },
  ];
  assert.ok(
    validateTemplateContract(staticRanking).some(
      (validationIssue) =>
        validationIssue.code === "INVALID_RUNTIME_COMPONENT_SOURCE",
    ),
  );
});
