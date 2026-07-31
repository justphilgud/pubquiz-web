import { questionTemplateIds } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import type { TemplateDefinition } from "./templateContract";
import type { TemplateContractOverlay } from "./templateContractResolver";

const standardQuestionOverlay: TemplateContractOverlay = {
  sourceTemplateIds: [
    questionTemplateIds.standard,
    questionTemplateIds.multipleChoice,
  ],
  apply: (contract, sources) => ({
    ...contract,
    identity: {
      ...contract.identity,
      templateId: "standard_question",
      description: "Standardfrage mit Text- oder Auswahlantwort.",
    },
    lifecycle: {
      ...contract.lifecycle,
      availability: {
        ...contract.lifecycle.availability,
        create: true,
      },
    },
    content: {
      ...contract.content,
      fields: [
        ...contract.content.fields,
        {
          key: "options",
          type: "OPTION_LIST",
          cardinality: "OPTIONAL",
          requiredAt: "ON_QUIZ_USE",
          ownership: "CONTENT_ITEM",
        },
      ],
    },
    interaction: {
      defaultType: "TEXT",
      allowedTypes: ["TEXT", "CHOICE"],
      required: true,
      quizOverrideAllowed: true,
    },
    evaluation: {
      defaultType: "MANUAL",
      allowedTypes: ["MANUAL", "NORMALIZED_TEXT_MATCH", "CHOICE_MATCH"],
    },
    overrides: {
      ...contract.overrides,
      properties: {
        ...contract.overrides.properties,
        answerMode: "SLIDE",
      },
    },
    renderer: {
      ...contract.renderer,
      teamForm: Object.fromEntries(
        sources.map((source) => [
          source.answerMode === "OPEN_TEXT" ? "TEXT" : "CHOICE",
          source.answerFormKind,
        ]),
      ),
    },
  }),
};

const pixelRevealOverlay: TemplateContractOverlay = {
  sourceTemplateIds: [questionTemplateIds.pixelImage],
  apply: (contract) => ({
    ...contract,
    identity: {
      ...contract.identity,
      templateId: "pixel_reveal",
      family: "REVEAL",
      description: "Mehrstufiges Bild-Reveal mit gespeicherten Pixelstufen.",
    },
    content: {
      ...contract.content,
      fields: [
        ...contract.content.fields,
        {
          key: "originalImage",
          type: "MEDIA_REFERENCE",
          cardinality: "ONE",
          requiredAt: "ON_APPROVE",
          ownership: "CONTENT_ITEM",
        },
        {
          key: "pixelStages",
          type: "ORDERED_MEDIA_LIST",
          cardinality: "MANY",
          requiredAt: "ON_APPROVE",
          ownership: "CONTENT_ITEM",
          validationRules: [{ type: "MIN_ITEMS", value: 2 }],
        },
      ],
    },
    components: {
      slots: [
        contract.components.slots.find((slot) => slot.slotId === "prompt")!,
        {
          slotId: "originalImage",
          componentType: "IMAGE",
          semanticRole: "MEDIA",
          minItems: 1,
          maxItems: 1,
          dataSourceId: "questionContent",
          mediaSlotKeys: ["pixel_original_image"],
        },
        {
          slotId: "pixelStages",
          componentType: "IMAGE_COLLECTION",
          semanticRole: "MEDIA",
          minItems: 2,
          maxItems: 3,
          dataSourceId: "pixelStages",
          mediaSlotKeys: [
            "pixel_stage_3_image",
            "pixel_stage_2_image",
            "pixel_stage_1_image",
          ],
        },
        contract.components.slots.find((slot) => slot.slotId === "solution")!,
      ],
    },
    reveal: {
      supported: true,
      required: true,
      defaultStrategy: "AUTOMATIC_SEQUENCE",
      minSteps: 2,
      maxSteps: 3,
      targetRoles: ["pixelStages"],
      overrideableProperties: ["step", "stageTimings"],
    },
    moderation: {
      ...contract.moderation,
      nextReveal: true,
      previousReveal: true,
    },
    layout: {
      defaultVariant: "FULLSCREEN_MEDIA",
      allowedVariants: ["FULLSCREEN_MEDIA", "MEDIA_TOP"],
    },
    overrides: {
      properties: {
        ...contract.overrides.properties,
        revealStep: "RUNTIME",
        stageTimings: "SLIDE",
      },
    },
    validation: { rules: [{ type: "MIN_ITEMS", value: 2 }] },
    dataSources: [
      contract.dataSources.find(
        (source) => source.sourceId === "questionContent",
      )!,
      {
        sourceId: "pixelStages",
        type: "GENERATED",
        resolution: "STORED_REFERENCE",
        persistence: "CONTENT_ITEM",
        refreshPolicy: "NEVER",
        fallback: "BLOCK_RUNTIME",
      },
    ],
    runtime: {
      stateRequirements: [
        ...contract.runtime.stateRequirements,
        {
          stateKey: "revealStep",
          resetOnSlideEnter: true,
          persistAcrossReload: true,
          dataSourceId: "pixelStages",
        },
      ],
    },
  }),
};

export const questionTemplateContractOverlays = [
  standardQuestionOverlay,
  pixelRevealOverlay,
] as const satisfies readonly TemplateContractOverlay[];

export const podiumTemplateContract = {
  identity: {
    templateId: "podium",
    version: 1,
    name: "Siegerehrung",
    description: "Experimenteller Runtime-Vertrag für eine Siegerehrung.",
    family: "RUNTIME_DATA",
    icon: "trophy",
    documentationKey: "runtimeTemplate.podium",
  },
  lifecycle: {
    status: "EXPERIMENTAL",
    availability: {
      create: false,
      filter: false,
      import: false,
      runtime: true,
    },
  },
  classification: { tags: ["ranking", "runtime", "reveal"] },
  content: {
    contentItemRequired: false,
    fields: [
      {
        key: "caption",
        type: "STRING",
        cardinality: "OPTIONAL",
        requiredAt: "NEVER",
        ownership: "EMBEDDED_CONTENT",
        editableInQuiz: true,
      },
    ],
  },
  components: {
    slots: [
      {
        slotId: "ranking",
        componentType: "RANKING",
        semanticRole: "RESULT",
        minItems: 1,
        maxItems: 1,
        dataSourceId: "finalRanking",
      },
    ],
  },
  interaction: {
    defaultType: "NONE",
    allowedTypes: ["NONE"],
    required: false,
    quizOverrideAllowed: false,
  },
  evaluation: { defaultType: "NONE", allowedTypes: ["NONE"] },
  reveal: {
    supported: true,
    required: true,
    defaultStrategy: "RUNTIME_DATA_REVEAL",
    minSteps: 1,
    targetRoles: ["ranking"],
    overrideableProperties: ["step"],
  },
  moderation: {
    navigate: true,
    openAnswers: false,
    closeAnswers: false,
    controlTimer: false,
    controlMedia: false,
    nextReveal: true,
    previousReveal: true,
    showSolution: false,
    manuallyAdjustScores: false,
  },
  layout: {
    defaultVariant: "RANKING_STAGE",
    allowedVariants: [
      "RANKING_STAGE",
      "RANKING_TABLE",
      "RANKING_CARDS",
    ],
  },
  display: {
    densities: ["COMPACT", "COMFORTABLE", "SPACIOUS"],
    emphases: ["BALANCED", "CONTENT"],
    alignments: ["START", "CENTER"],
    backgrounds: ["THEME", "SUBTLE", "STRONG"],
  },
  overrides: {
    properties: { layout: "SLIDE", revealStep: "RUNTIME" },
  },
  authoring: { capabilities: ["LAYOUT_PREVIEW", "THEME_PREVIEW"] },
  validation: { rules: [] },
  dataSources: [
    {
      sourceId: "finalRanking",
      type: "RUNTIME",
      resolution: "ON_SLIDE_ENTER",
      persistence: "SNAPSHOT",
      refreshPolicy: "MANUAL",
      fallback: "LAST_KNOWN",
    },
  ],
  runtime: {
    stateRequirements: [
      {
        stateKey: "rankingSnapshot",
        resetOnSlideEnter: true,
        persistAcrossReload: true,
        dataSourceId: "finalRanking",
      },
      {
        stateKey: "revealStep",
        resetOnSlideEnter: true,
        persistAcrossReload: true,
      },
    ],
  },
  renderer: {
    editor: null,
    moderationPreview: "PODIUM",
    presentation: "PODIUM",
  },
  compatibility: { legacyMappings: [] },
  migration: { currentVersion: 1, steps: [] },
} as const satisfies TemplateDefinition;

export const standaloneTemplateContracts = [
  podiumTemplateContract,
] as const satisfies readonly TemplateDefinition[];
