import assert from "node:assert/strict";
import test from "node:test";

import {
  getCreatableQuestionTemplateContracts,
  getQuestionTemplateContract,
  questionTemplateContractRegistry,
  questionTemplateDefinitions,
} from "@/app/fragen/editor/templates/questionTemplates";
import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { getMediaSlotDefinition } from "@/app/fragen/editor/mediaSlots";
import {
  isTemplateContractAvailable,
  resolveLegacyQuestionTemplateContract,
  resolveTemplateContract,
  resolveTemplateContractCompatibility,
} from "./templateContractResolver";
import {
  validateQuestionTemplateContractCoverage,
  validateTemplateContractRegistry,
} from "./templateContractValidation";
import type { TemplateDefinition } from "./templateContract";

const standardQuestionTemplateContract =
  getQuestionTemplateContract("standard")!;

test("the derived registry extends existing definitions without duplicate identities", () => {
  assert.deepEqual(
    validateTemplateContractRegistry(questionTemplateContractRegistry),
    [],
  );
  assert.equal(
    questionTemplateContractRegistry.length,
    questionTemplateDefinitions.length,
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
    questionTemplateContractRegistry
      .filter((template) => template.lifecycle.status === "ACTIVE")
      .every((template) => template.lifecycle.availability.runtime),
  );
});

test("every productive question definition resolves to a valid contract", () => {
  assert.deepEqual(
    validateQuestionTemplateContractCoverage(
      questionTemplateDefinitions,
      questionTemplateContractRegistry,
    ),
    [],
  );
  for (const definition of questionTemplateDefinitions) {
    const contract = getQuestionTemplateContract(definition.id);
    assert.ok(contract, `missing contract for ${definition.id}`);
    assert.deepEqual(
      validateTemplateContractRegistry([contract]),
      [],
      `invalid contract for ${definition.id}`,
    );
  }

  const missingDefinition = {
    ...questionTemplateDefinitions[0],
    id: "future_template",
  };
  assert.equal(
    validateQuestionTemplateContractCoverage(
      [missingDefinition],
      questionTemplateContractRegistry,
    )[0]?.code,
    "TEMPLATE_CONTRACT_COVERAGE_MISSING",
  );
});

test("template semantics are derived from definitions and focused overlays", () => {
  const cases = [
    [questionTemplateIds.trueFalse, "SINGLE_CHOICE", "CHOICE_MATCH"],
    [questionTemplateIds.estimate, "NUMBER", "CLOSEST_VALUE"],
    [questionTemplateIds.ordering, "ORDER", "ORDER_POSITION"],
    [questionTemplateIds.translationReadAloud, "TEXT", "MANUAL"],
    [questionTemplateIds.anagram, "TEXT", "NORMALIZED_TEXT_MATCH"],
    [questionTemplateIds.googleReviews, "TEXT", "MANUAL"],
    [questionTemplateIds.faceMorph, "STRUCTURED_TEXT", "MANUAL"],
    [questionTemplateIds.musicReverse, "STRUCTURED_TEXT", "MANUAL"],
    [questionTemplateIds.musicEightBit, "TEXT", "MANUAL"],
    [questionTemplateIds.pixelImage, "TEXT", "MANUAL"],
  ] as const;

  for (const [templateId, interaction, evaluation] of cases) {
    const contract = getQuestionTemplateContract(templateId);
    assert.equal(contract?.interaction.defaultType, interaction, templateId);
    assert.equal(contract?.evaluation.defaultType, evaluation, templateId);
  }

  assert.equal(
    getQuestionTemplateContract(questionTemplateIds.ordering)?.validation
      .rules[0]?.type,
    "MIN_ITEMS",
  );
  assert.equal(
    getQuestionTemplateContract(questionTemplateIds.googleReviews)?.dataSources
      .find((source) => source.sourceId === "googleResearch")?.type,
    "EXTERNAL_TRANSIENT",
  );
  assert.equal(
    getQuestionTemplateContract(questionTemplateIds.musicReverse)?.dataSources
      .find((source) => source.sourceId === "music_reverse_audio")?.type,
    "GENERATED",
  );
  assert.equal(
    getQuestionTemplateContract(questionTemplateIds.faceMorph)?.dataSources
      .find((source) => source.sourceId === "face_morph_result")?.type,
    "USER_OR_GENERATED",
  );
});

test("legacy IDs and aliases resolve to the reference contracts", () => {
  assert.equal(
    getQuestionTemplateContract(null)?.identity.templateId,
    "standard_question",
  );
  assert.equal(
    getQuestionTemplateContract("standard")?.identity.templateId,
    "standard_question",
  );
  assert.equal(
    getQuestionTemplateContract("pixelbild")?.identity.templateId,
    "pixel_reveal",
  );
  assert.equal(
    getQuestionTemplateContract("image_pixel")?.identity.templateId,
    "pixel_reveal",
  );
  assert.equal(
    getQuestionTemplateContract("multiple_choice")?.identity.templateId,
    "standard_question",
  );
  assert.equal(
    resolveTemplateContractCompatibility(
      questionTemplateContractRegistry,
      "multiple_choice",
    )?.interactionType,
    "MULTI_CHOICE",
  );
  assert.equal(
    resolveTemplateContract(
      questionTemplateContractRegistry,
      questionTemplateIds.trueFalse,
    )?.identity.templateId,
    questionTemplateIds.trueFalse,
  );
  assert.equal(getQuestionTemplateContract("unknown-template"), null);
});

test("contract media references delegate scope and MIME rules to the central slot policy", () => {
  const standard = getQuestionTemplateContract(questionTemplateIds.standard)!;
  const faceMorph = getQuestionTemplateContract(questionTemplateIds.faceMorph)!;
  const reverse = getQuestionTemplateContract(questionTemplateIds.musicReverse)!;

  assert.equal(
    standard.components.slots.find(
      (slot) => slot.mediaSlotKeys?.includes("question_image"),
    )?.minItems,
    0,
  );

  const answerImages = faceMorph.components.slots.find(
    (slot) => slot.slotId === "answerImages",
  );
  assert.deepEqual(answerImages?.mediaSlotKeys, ["answer_image"]);
  assert.equal(answerImages?.minItems, 2);
  assert.equal(getMediaSlotDefinition("answer_image").scope, "ANSWER");
  assert.equal(
    getMediaSlotDefinition("answer_image").allowedMimeTypes.includes(
      "image/png",
    ),
    true,
  );

  const reverseOutput = reverse.components.slots.find(
    (slot) => slot.mediaSlotKeys?.includes("music_reverse_audio"),
  );
  assert.equal(reverseOutput?.minItems, 1);
  assert.equal(
    reverse.dataSources.find(
      (source) => source.sourceId === "music_reverse_audio",
    )?.type,
    "GENERATED",
  );
});

test("special contracts expose their existing authoring and media capabilities", () => {
  const faceMorph = getQuestionTemplateContract(questionTemplateIds.faceMorph)!;
  const reverse = getQuestionTemplateContract(questionTemplateIds.musicReverse)!;
  const pixel = getQuestionTemplateContract(questionTemplateIds.pixelImage)!;

  assert.equal(
    faceMorph.dataSources.find(
      (source) => source.sourceId === "face_morph_result",
    )?.type,
    "USER_OR_GENERATED",
  );
  assert.equal(
    reverse.authoring.capabilities.includes("AUDIO_REVERSE"),
    true,
  );
  assert.equal(pixel.authoring.capabilities.includes("PIXEL_GENERATOR"), true);
  assert.deepEqual(
    pixel.components.slots.find((slot) => slot.slotId === "pixelStages")
      ?.mediaSlotKeys,
    [
      "pixel_stage_3_image",
      "pixel_stage_2_image",
      "pixel_stage_1_image",
    ],
  );
});

test("non-creatable and experimental contracts stay out of normal creation", () => {
  const creatableIds = getCreatableQuestionTemplateContracts().map(
    (template) => template.identity.templateId,
  );

  assert.equal(creatableIds.includes("standard_question"), true);
  assert.equal(creatableIds.includes("podium"), false);
  assert.equal(creatableIds.includes(questionTemplateIds.musicEightBit), false);
  assert.equal(
    isTemplateContractAvailable(
      getQuestionTemplateContract("podium")!,
      "create",
    ),
    false,
  );
  assert.equal(
    isTemplateContractAvailable(
      getQuestionTemplateContract("podium")!,
      "runtime",
    ),
    true,
  );
});

test("every productive editor choice resolves into the creatable contract set", () => {
  const creatableContracts = getCreatableQuestionTemplateContracts();
  const creatableIds = new Set(
    creatableContracts.map((template) => template.identity.templateId),
  );

  for (const definition of questionTemplateDefinitions.filter(
    (template) => template.enabled && template.selectable,
  )) {
    const contract = getQuestionTemplateContract(definition.id);
    assert.ok(contract, definition.id);
    assert.equal(creatableIds.has(contract.identity.templateId), true);
  }
  assert.equal(
    new Set(creatableContracts.map((contract) => contract.identity.templateId))
      .size,
    creatableContracts.length,
  );
});

test("a deactivated legacy definition remains deterministic and runtime-readable", () => {
  const source = questionTemplateDefinitions.find(
    (definition) => definition.id === questionTemplateIds.trueFalse,
  );
  assert.ok(source);

  const disabledDefinition = { ...source, enabled: false, selectable: false };
  const first = resolveLegacyQuestionTemplateContract(disabledDefinition);
  const second = resolveLegacyQuestionTemplateContract(disabledDefinition);

  assert.deepEqual(first, second);
  assert.equal(first.lifecycle.status, "DEPRECATED");
  assert.equal(first.lifecycle.availability.create, false);
  assert.equal(first.lifecycle.availability.runtime, true);
  assert.equal(
    resolveTemplateContract([first], questionTemplateIds.trueFalse),
    first,
  );
});

test("legacy contracts receive complete defaults without runtime work", () => {
  const contract = getQuestionTemplateContract(questionTemplateIds.anagram);

  assert.ok(contract);
  assert.equal(contract.identity.version, 1);
  assert.equal(contract.dataSources[0]?.sourceId, "questionContent");
  assert.equal(contract.dataSources[0]?.refreshPolicy, "NEVER");
  assert.ok(contract.renderer.editor);
  assert.ok(contract.renderer.moderationPreview);
  assert.ok(contract.renderer.presentation);
  assert.deepEqual(contract.migration.steps, []);
});

test("feature flags and contract versions are resolved deterministically", () => {
  const flagged: TemplateDefinition = structuredClone(
    standardQuestionTemplateContract,
  );
  flagged.lifecycle.availability.create = true;
  flagged.lifecycle.availability.featureFlag = "template.standard";
  assert.equal(isTemplateContractAvailable(flagged, "create"), false);
  assert.equal(
    isTemplateContractAvailable(
      flagged,
      "create",
      new Set(["template.standard"]),
    ),
    true,
  );

  const versionTwo: TemplateDefinition = structuredClone(
    standardQuestionTemplateContract,
  );
  versionTwo.identity.version = 2;
  versionTwo.migration.currentVersion = 2;
  versionTwo.migration.steps = [
    {
      migrationId: "standard-question-v1-v2",
      fromVersion: 1,
      toVersion: 2,
    },
  ];
  const versionedRegistry = [
    standardQuestionTemplateContract,
    versionTwo,
  ];

  assert.equal(
    resolveTemplateContract(versionedRegistry, "standard")?.identity.version,
    2,
  );
  assert.equal(
    resolveTemplateContract(versionedRegistry, "standard", 1)?.identity
      .version,
    1,
  );
});
