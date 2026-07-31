import { getMediaSlotDefinition } from "@/app/fragen/editor/mediaSlots";
import {
  getQuestionTemplatePersistenceIds,
  questionTemplateIds,
} from "@/app/fragen/editor/templates/questionTemplateRegistry";
import type {
  GeneratorId,
  QuestionAnswerMode,
  QuestionContentGeneratorId,
  QuestionEvaluationMode,
  QuestionTemplateDefinition,
} from "@/app/fragen/editor/types";
import type {
  TemplateAuthoringCapability,
  TemplateComponentSlot,
  TemplateContentFieldDefinition,
  TemplateDataSourceDefinition,
  TemplateDefinition,
  TemplateEvaluationType,
  TemplateInteractionType,
  TemplateLayoutVariant,
} from "./templateContract";

export type TemplateContractOverlay = {
  sourceTemplateIds: readonly string[];
  apply: (
    contract: TemplateDefinition,
    sources: readonly QuestionTemplateDefinition[],
  ) => TemplateDefinition;
};

function interactionFromAnswerMode(
  answerMode: QuestionAnswerMode,
): TemplateInteractionType {
  if (answerMode === "OPEN_TEXT") return "TEXT";
  if (answerMode === "BOOLEAN") return "BOOLEAN";
  if (answerMode === "NUMBER") return "NUMERIC";
  if (answerMode === "ORDERING") return "ORDERING";
  return "CHOICE";
}

function evaluationFromQuestionDefinition(
  evaluationMode: QuestionEvaluationMode,
  interaction: TemplateInteractionType,
): TemplateEvaluationType {
  if (evaluationMode === "MANUAL") return "MANUAL";
  if (evaluationMode === "BOOLEAN_MATCH") return "CHOICE_MATCH";
  if (evaluationMode === "NUMERIC_CLOSEST") return "CLOSEST_VALUE";
  if (evaluationMode === "NUMERIC_TOLERANCE") return "NUMERIC_TOLERANCE";
  if (evaluationMode === "ORDER_EXACT") return "ORDER_EXACT";
  if (evaluationMode === "ORDER_POSITION") return "ORDER_POSITION";
  return interaction === "CHOICE"
    ? "CHOICE_MATCH"
    : "NORMALIZED_TEXT_MATCH";
}

function generatorCapability(
  generatorId: GeneratorId,
): TemplateAuthoringCapability | null {
  if (generatorId === "image_pixelate") return "PIXEL_GENERATOR";
  if (generatorId === "image_face_morph") return "FACE_MORPH_GENERATOR";
  if (generatorId === "audio_reverse") return "AUDIO_REVERSE";
  if (generatorId === "audio_bitcrush") return "AUDIO_BITCRUSH";
  if (generatorId === "text_to_speech") return "TTS_PREVIEW";
  return null;
}

function contentGeneratorCapability(
  generatorId: QuestionContentGeneratorId,
): TemplateAuthoringCapability {
  if (generatorId === "text_translation") return "TRANSLATION";
  if (generatorId === "text_to_speech") return "TTS_PREVIEW";
  return "ANAGRAM_GENERATOR";
}

function layoutContractForDefinition(
  definition: QuestionTemplateDefinition,
): {
  defaultVariant: TemplateLayoutVariant;
  allowedVariants: readonly TemplateLayoutVariant[];
} {
  const withSolution = (
    ...variants: readonly TemplateLayoutVariant[]
  ): readonly TemplateLayoutVariant[] =>
    Array.from(new Set([...variants, "SOLUTION_FOCUS" as const]));

  if (definition.id === questionTemplateIds.multipleChoice) {
    return {
      defaultVariant: "CHOICE_GRID",
      allowedVariants: withSolution("CHOICE_GRID"),
    };
  }
  if (definition.id === questionTemplateIds.trueFalse) {
    return {
      defaultVariant: "TRUE_FALSE",
      allowedVariants: withSolution("TRUE_FALSE"),
    };
  }
  if (definition.id === questionTemplateIds.ordering) {
    return {
      defaultVariant: "ORDERING",
      allowedVariants: withSolution("ORDERING"),
    };
  }
  if (
    definition.id === questionTemplateIds.musicReverse ||
    definition.id === questionTemplateIds.musicEightBit ||
    definition.id === questionTemplateIds.translationReadAloud
  ) {
    return {
      defaultVariant: "AUDIO_FOCUS",
      allowedVariants: withSolution("AUDIO_FOCUS"),
    };
  }
  if (definition.id === questionTemplateIds.pixelImage) {
    return {
      defaultVariant: "REVEAL_SEQUENCE",
      allowedVariants: withSolution("REVEAL_SEQUENCE", "MEDIA_FOCUS"),
    };
  }
  if (definition.id === questionTemplateIds.faceMorph) {
    return {
      defaultVariant: "MEDIA_FOCUS",
      allowedVariants: withSolution("MEDIA_FOCUS"),
    };
  }
  if (definition.id === questionTemplateIds.googleReviews) {
    return {
      defaultVariant: "REVEAL_SEQUENCE",
      allowedVariants: withSolution("REVEAL_SEQUENCE", "CHOICE_GRID"),
    };
  }
  if (definition.id === questionTemplateIds.estimate) {
    return {
      defaultVariant: "CONTENT_CENTERED",
      allowedVariants: withSolution("CONTENT_CENTERED", "MEDIA_FOCUS"),
    };
  }
  if (definition.id === questionTemplateIds.anagram) {
    return {
      defaultVariant: "CONTENT_CENTERED",
      allowedVariants: withSolution("CONTENT_CENTERED"),
    };
  }
  return {
    defaultVariant: "CONTENT_CENTERED",
    allowedVariants: withSolution(
      "CONTENT_CENTERED",
      "CONTENT_SPLIT",
      "MEDIA_FOCUS",
      "AUDIO_FOCUS",
      "STRUCTURED_RESPONSE",
    ),
  };
}

function contentFieldsForDefinition(
  definition: QuestionTemplateDefinition,
): TemplateContentFieldDefinition[] {
  const prompt: TemplateContentFieldDefinition = {
    key: "prompt",
    type: "STRING",
    cardinality: "ONE",
    requiredAt: "ON_APPROVE",
    ownership: "CONTENT_ITEM",
  };
  const solution: TemplateContentFieldDefinition = {
    key: "solution",
    type:
      definition.answerMode === "BOOLEAN"
        ? "BOOLEAN"
        : definition.answerMode === "NUMBER"
          ? "NUMBER"
          : definition.answerMode === "ORDERING"
            ? "OPTION_LIST"
            : "STRING_LIST",
    cardinality: "ONE",
    requiredAt: "ON_APPROVE",
    ownership: "CONTENT_ITEM",
    ...(definition.answerMode === "ORDERING"
      ? { validationRules: [{ type: "MIN_ITEMS" as const, value: 2 }] }
      : {}),
  };

  if (definition.editorKind === "ESTIMATE") {
    return [
      prompt,
      { ...solution, key: "correctValue" },
      {
        key: "unit",
        type: "STRING",
        cardinality: "ONE",
        requiredAt: "ON_APPROVE",
        ownership: "CONTENT_ITEM",
      },
    ];
  }
  if (definition.editorKind === "ORDERING") {
    return [prompt, { ...solution, key: "items" }];
  }
  if (definition.editorKind === "TRANSLATION_READ_ALOUD") {
    return [
      prompt,
      {
        key: "originalText",
        type: "RICH_TEXT",
        cardinality: "ONE",
        requiredAt: "ON_APPROVE",
        ownership: "CONTENT_ITEM",
      },
      {
        key: "translation",
        type: "RICH_TEXT",
        cardinality: "ONE",
        requiredAt: "ON_APPROVE",
        ownership: "CONTENT_ITEM",
      },
      solution,
    ];
  }
  if (definition.editorKind === "ANAGRAM") {
    return [
      prompt,
      { ...solution, key: "anagramSolution" },
      {
        key: "anagram",
        type: "STRING",
        cardinality: "ONE",
        requiredAt: "ON_APPROVE",
        ownership: "CONTENT_ITEM",
      },
    ];
  }
  if (definition.editorKind === "GOOGLE_REVIEWS") {
    return [
      prompt,
      {
        key: "reviews",
        type: "STRING_LIST",
        cardinality: "MANY",
        requiredAt: "ON_APPROVE",
        ownership: "CONTENT_ITEM",
        validationRules: [{ type: "MIN_ITEMS", value: 1 }],
      },
      solution,
    ];
  }
  if (definition.id === "face_morph") {
    return [
      prompt,
      {
        key: "persons",
        type: "OPTION_LIST",
        cardinality: "MANY",
        requiredAt: "ON_APPROVE",
        ownership: "CONTENT_ITEM",
        validationRules: [{ type: "MIN_ITEMS", value: 2 }],
      },
      solution,
    ];
  }
  return [prompt, solution];
}

function mediaContractParts(definition: QuestionTemplateDefinition): {
  slots: TemplateComponentSlot[];
  dataSources: TemplateDataSourceDefinition[];
} {
  const generatedSources: TemplateDataSourceDefinition[] = [];
  const slots = definition.mediaSlots.map((slot): TemplateComponentSlot => {
    const mediaSlot = getMediaSlotDefinition(slot.slotKey);
    const generated = mediaSlot.generatorOutput;
    if (generated) {
      generatedSources.push({
        sourceId: slot.slotKey,
        type:
          mediaSlot.origin === "USER_OR_GENERATED"
            ? "USER_OR_GENERATED"
            : "GENERATED",
        resolution: "STORED_REFERENCE",
        persistence: "CONTENT_ITEM",
        refreshPolicy: "NEVER",
        fallback: slot.required ? "BLOCK_RUNTIME" : "HIDE_COMPONENT",
      });
    }
    return {
      slotId: slot.slotKey,
      componentType:
        mediaSlot.mediaType === "AUDIO"
          ? "AUDIO"
          : mediaSlot.mediaType === "VIDEO"
            ? "VIDEO"
            : "IMAGE",
      semanticRole: "MEDIA",
      minItems: slot.required ? 1 : 0,
      maxItems: 1,
      dataSourceId: generated ? slot.slotKey : "questionContent",
      mediaSlotKeys: [slot.slotKey],
    };
  });
  if (definition.requiresAnswerImages) {
    slots.push({
      slotId: "answerImages",
      componentType: "IMAGE_COLLECTION",
      semanticRole: "MEDIA",
      minItems: definition.initialAnswers.length,
      maxItems: definition.initialAnswers.length,
      dataSourceId: "questionContent",
      mediaSlotKeys: ["answer_image"],
    });
  }
  return { slots, dataSources: generatedSources };
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function resolveLegacyQuestionTemplateContract(
  definition: QuestionTemplateDefinition,
): TemplateDefinition {
  const interaction = interactionFromAnswerMode(definition.answerMode);
  const evaluation = evaluationFromQuestionDefinition(
    definition.evaluationMode,
    interaction,
  );
  const media = mediaContractParts(definition);
  const capabilities = unique([
    ...(definition.mediaSlots.length > 0
      ? (["MEDIA_UPLOAD"] as const)
      : []),
    ...definition.generators
      .map(generatorCapability)
      .filter(
        (capability): capability is TemplateAuthoringCapability =>
          capability !== null,
      ),
    ...definition.contentGenerators.map(contentGeneratorCapability),
    "DUPLICATE_CHECK" as const,
    "QUALITY_CHECK" as const,
  ]);
  const dataSources: TemplateDataSourceDefinition[] = [
    {
      sourceId: "questionContent",
      type: "STATIC",
      resolution: "CONTENT_ITEM",
      persistence: "CONTENT_ITEM",
      refreshPolicy: "NEVER",
      fallback: "BLOCK_RUNTIME",
    },
    ...media.dataSources,
    ...(definition.editorKind === "GOOGLE_REVIEWS"
      ? [
          {
            sourceId: "googleResearch",
            type: "EXTERNAL_TRANSIENT" as const,
            resolution: "ON_DEMAND" as const,
            persistence: "NONE" as const,
            refreshPolicy: "MANUAL" as const,
            fallback: "NONE" as const,
          },
        ]
      : []),
  ];
  const persistenceIds = getQuestionTemplatePersistenceIds(definition.id);

  return {
    identity: {
      templateId: definition.id,
      version: 1,
      name: definition.translationKey,
      description: `Normalisierter Vertrag für ${definition.id}.`,
      family: "QUESTION",
      icon: definition.icon,
      documentationKey: `questionTemplate.${definition.translationKey}`,
    },
    lifecycle: {
      status: definition.enabled ? "ACTIVE" : "DEPRECATED",
      availability: {
        create: definition.enabled && definition.selectable,
        filter: definition.availableForFiltering,
        import: true,
        runtime: true,
      },
    },
    classification: { tags: ["question", definition.translationKey] },
    content: {
      contentItemRequired: true,
      fields: contentFieldsForDefinition(definition),
    },
    components: {
      slots: [
        {
          slotId: "prompt",
          componentType: "PROMPT",
          semanticRole: "PRIMARY_CONTENT",
          minItems: 1,
          maxItems: 1,
          dataSourceId: "questionContent",
        },
        {
          slotId: "solution",
          componentType: "SOLUTION",
          semanticRole: "SOLUTION",
          minItems: 1,
          maxItems: 1,
          dataSourceId: "questionContent",
        },
        ...media.slots,
      ],
    },
    interaction: {
      defaultType: interaction,
      allowedTypes: [interaction],
      required: true,
      quizOverrideAllowed: false,
    },
    evaluation: {
      defaultType: evaluation,
      allowedTypes: [evaluation],
    },
    reveal: {
      supported: false,
      required: false,
      defaultStrategy: "NONE",
    },
    moderation: {
      navigate: true,
      openAnswers: true,
      closeAnswers: true,
      controlTimer: true,
      controlMedia: definition.mediaSlots.length > 0,
      nextReveal: false,
      previousReveal: false,
      showSolution: true,
      manuallyAdjustScores: true,
    },
    layout: layoutContractForDefinition(definition),
    display: {
      densities: ["COMFORTABLE"],
      emphases: ["BALANCED", "CONTENT"],
      alignments: ["START", "CENTER"],
      backgrounds: ["THEME"],
    },
    overrides: {
      properties: {
        answerMode: "LOCKED",
        category: "LOCKED",
        layout: "SLIDE",
        mediaPlayback: "RUNTIME",
        points: "SLIDE",
        solution: "LOCKED",
        timer: "SLIDE",
      },
    },
    authoring: { capabilities },
    validation: {
      rules:
        definition.answerMode === "ORDERING"
          ? [{ type: "MIN_ITEMS", value: 2 }]
          : [],
    },
    dataSources,
    runtime: {
      stateRequirements: [
        {
          stateKey: "answerAcceptanceState",
          resetOnSlideEnter: false,
          persistAcrossReload: true,
        },
        {
          stateKey: "timerState",
          resetOnSlideEnter: true,
          persistAcrossReload: true,
        },
      ],
    },
    renderer: {
      editor: definition.editorKind,
      moderationPreview: definition.presentationKind,
      presentation: definition.presentationKind,
      teamForm: { [interaction]: definition.answerFormKind },
      solution: definition.presentationKind,
    },
    compatibility: {
      legacyMappings: (
        persistenceIds.length > 0 ? persistenceIds : [definition.id]
      ).map((templateId) => ({ templateId, interactionType: interaction })),
    },
    migration: { currentVersion: 1, steps: [] },
  };
}

export function buildTemplateContractRegistry(
  definitions: readonly QuestionTemplateDefinition[],
  overlays: readonly TemplateContractOverlay[],
  standaloneTemplates: readonly TemplateDefinition[] = [],
): TemplateDefinition[] {
  const consumedDefinitionIds = new Set<string>();
  const contracts: TemplateDefinition[] = [];

  for (const overlay of overlays) {
    const sources = overlay.sourceTemplateIds
      .map((sourceId) =>
        definitions.find((definition) => definition.id === sourceId),
      )
      .filter(
        (definition): definition is QuestionTemplateDefinition =>
          definition !== undefined,
      );
    if (sources.length !== overlay.sourceTemplateIds.length) continue;

    sources.forEach((source) => consumedDefinitionIds.add(source.id));
    const primary = resolveLegacyQuestionTemplateContract(sources[0]);
    const compatibility = sources.flatMap((source) => {
      const sourceContract = resolveLegacyQuestionTemplateContract(source);
      return sourceContract.compatibility.legacyMappings;
    });
    contracts.push(
      overlay.apply(
        {
          ...primary,
          lifecycle: {
            status: sources.every((source) => source.enabled)
              ? "ACTIVE"
              : "DEPRECATED",
            availability: {
              create: sources.some(
                (source) => source.enabled && source.selectable,
              ),
              filter: sources.some(
                (source) => source.availableForFiltering,
              ),
              import: true,
              runtime: true,
            },
          },
          compatibility: { legacyMappings: compatibility },
        },
        sources,
      ),
    );
  }

  for (const definition of definitions) {
    if (!consumedDefinitionIds.has(definition.id)) {
      contracts.push(resolveLegacyQuestionTemplateContract(definition));
    }
  }
  return [...contracts, ...standaloneTemplates];
}

export type TemplateAvailabilityUse =
  | "create"
  | "filter"
  | "import"
  | "runtime";

export function isTemplateContractAvailable(
  template: TemplateDefinition,
  use: TemplateAvailabilityUse,
  enabledFeatureFlags: ReadonlySet<string> = new Set(),
): boolean {
  const featureFlag = template.lifecycle.availability.featureFlag;
  if (featureFlag && !enabledFeatureFlags.has(featureFlag)) return false;
  if (
    (use === "create" || use === "filter") &&
    template.lifecycle.status !== "ACTIVE"
  ) {
    return false;
  }
  return template.lifecycle.availability[use];
}

export function resolveTemplateContract(
  registry: readonly TemplateDefinition[],
  templateId: string | null,
  version?: number,
): TemplateDefinition | null {
  const normalizedId = templateId?.trim().toLowerCase() || "standard";
  const candidates = registry.filter(
    (template) =>
      template.identity.templateId.toLowerCase() === normalizedId ||
      template.compatibility.legacyMappings.some(
        (mapping) => mapping.templateId.toLowerCase() === normalizedId,
      ),
  );
  const versionedCandidates =
    version === undefined
      ? candidates
      : candidates.filter(
          (template) => template.identity.version === version,
        );
  return (
    [...versionedCandidates].sort(
      (left, right) => right.identity.version - left.identity.version,
    )[0] ?? null
  );
}

export function resolveTemplateContractCompatibility(
  registry: readonly TemplateDefinition[],
  templateId: string | null,
  version?: number,
): {
  template: TemplateDefinition;
  interactionType: TemplateInteractionType;
} | null {
  const template = resolveTemplateContract(registry, templateId, version);
  if (!template) return null;
  const normalizedId = templateId?.trim().toLowerCase() || "standard";
  const legacyMapping = template.compatibility.legacyMappings.find(
    (mapping) => mapping.templateId.toLowerCase() === normalizedId,
  );
  return {
    template,
    interactionType:
      legacyMapping?.interactionType ?? template.interaction.defaultType,
  };
}
