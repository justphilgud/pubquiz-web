import type {
  MediaSlotKey,
  QuestionTemplateSurfaceKind,
} from "@/app/fragen/editor/types";

export type TemplateFamily =
  | "QUESTION"
  | "REVEAL"
  | "INFORMATION"
  | "RUNTIME_DATA"
  | "TRANSITION"
  | "COMPOSITE";

export type TemplateLifecycleStatus =
  | "DRAFT"
  | "EXPERIMENTAL"
  | "ACTIVE"
  | "DEPRECATED"
  | "ARCHIVED";

export type TemplateAvailability = {
  create: boolean;
  filter: boolean;
  import: boolean;
  runtime: boolean;
  featureFlag?: string;
};

export type TemplateContentFieldType =
  | "STRING"
  | "RICH_TEXT"
  | "BOOLEAN"
  | "NUMBER"
  | "STRING_LIST"
  | "OPTION_LIST"
  | "MEDIA_REFERENCE"
  | "ORDERED_MEDIA_LIST"
  | "SOURCE_REFERENCE";

export type TemplateValidationRule =
  | { type: "MIN_LENGTH"; value: number }
  | { type: "MAX_LENGTH"; value: number }
  | { type: "MIN_ITEMS"; value: number }
  | { type: "MAX_ITEMS"; value: number }
  | { type: "POSITIVE_NUMBER" };

export type TemplateContentFieldDefinition = {
  key: string;
  type: TemplateContentFieldType;
  cardinality: "ONE" | "OPTIONAL" | "MANY";
  requiredAt:
    | "NEVER"
    | "ON_SAVE"
    | "ON_SUBMIT"
    | "ON_APPROVE"
    | "ON_QUIZ_USE"
    | "ON_RUNTIME";
  ownership: "CONTENT_ITEM" | "EMBEDDED_CONTENT";
  editableInQuiz?: boolean;
  defaultValue?: unknown;
  validationRules?: readonly TemplateValidationRule[];
};

export type TemplateComponentType =
  | "TITLE"
  | "PROMPT"
  | "BODY_TEXT"
  | "EXPLANATION"
  | "HINT_SET"
  | "SOLUTION"
  | "REVIEW_COLLECTION"
  | "ORDERING_ITEM_SET"
  | "IMAGE"
  | "IMAGE_COLLECTION"
  | "AUDIO"
  | "VIDEO"
  | "LOGO"
  | "QR_CODE"
  | "TEAM_LIST"
  | "RANKING"
  | "ANSWER_STATISTICS"
  | "SCOREBOARD"
  | "RESPONSE_PROGRESS";

export type TemplateComponentSemanticRole =
  | "PRIMARY_CONTENT"
  | "SUPPORTING_CONTENT"
  | "SOLUTION"
  | "MEDIA"
  | "RUNTIME_STATUS"
  | "RESULT";

export type TemplateComponentSlot = {
  slotId: string;
  componentType: TemplateComponentType;
  semanticRole: TemplateComponentSemanticRole;
  minItems: number;
  maxItems: number;
  dataSourceId?: string;
  mediaSlotKeys?: readonly MediaSlotKey[];
};

export type TemplateInteractionType =
  | "NONE"
  | "TEXT"
  | "CHOICE"
  | "BOOLEAN"
  | "NUMERIC"
  | "ORDERING"
  | "BUZZER";

export type TemplateEvaluationType =
  | "NONE"
  | "MANUAL"
  | "NORMALIZED_TEXT_MATCH"
  | "CHOICE_MATCH"
  | "EXACT_NUMERIC"
  | "NUMERIC_TOLERANCE"
  | "CLOSEST_VALUE"
  | "ORDER_EXACT"
  | "ORDER_POSITION"
  | "ORDER_ADJACENCY";

export const compatibleEvaluationTypes = {
  NONE: ["NONE"],
  TEXT: ["MANUAL", "NORMALIZED_TEXT_MATCH"],
  CHOICE: ["CHOICE_MATCH"],
  BOOLEAN: ["CHOICE_MATCH"],
  NUMERIC: ["EXACT_NUMERIC", "NUMERIC_TOLERANCE", "CLOSEST_VALUE"],
  ORDERING: ["ORDER_EXACT", "ORDER_POSITION", "ORDER_ADJACENCY"],
  BUZZER: ["MANUAL"],
} as const satisfies Record<
  TemplateInteractionType,
  readonly TemplateEvaluationType[]
>;

export function isInteractionEvaluationCompatible(
  interaction: TemplateInteractionType,
  evaluation: TemplateEvaluationType,
): boolean {
  return (compatibleEvaluationTypes[interaction] as readonly string[]).includes(
    evaluation,
  );
}

export type TemplateInteractionContract = {
  defaultType: TemplateInteractionType;
  allowedTypes: readonly TemplateInteractionType[];
  required: boolean;
  quizOverrideAllowed: boolean;
};

export type TemplateEvaluationContract = {
  defaultType: TemplateEvaluationType;
  allowedTypes: readonly TemplateEvaluationType[];
  recommendedBasePoints?: number;
};

export type TemplateRevealStrategy =
  | "NONE"
  | "MANUAL_STEP"
  | "TIMED_STEP"
  | "AUTOMATIC_SEQUENCE"
  | "MEDIA_PROGRESS"
  | "RUNTIME_DATA_REVEAL";

export type TemplateRevealContract = {
  supported: boolean;
  required: boolean;
  defaultStrategy: TemplateRevealStrategy;
  minSteps?: number;
  maxSteps?: number;
  targetRoles?: readonly string[];
  overrideableProperties?: readonly string[];
};

export type TemplateModerationContract = {
  navigate: boolean;
  openAnswers: boolean;
  closeAnswers: boolean;
  controlTimer: boolean;
  controlMedia: boolean;
  nextReveal: boolean;
  previousReveal: boolean;
  showSolution: boolean;
  manuallyAdjustScores: boolean;
};

export type TemplateLayoutVariant =
  | "CONTENT_CENTERED"
  | "CONTENT_SPLIT"
  | "MEDIA_LEFT"
  | "MEDIA_RIGHT"
  | "MEDIA_TOP"
  | "FULLSCREEN_MEDIA"
  | "CARD_GRID"
  | "RANKING_STAGE"
  | "RANKING_TABLE"
  | "RANKING_CARDS"
  | "HERO";

export type TemplateDisplayDensity = "COMPACT" | "COMFORTABLE" | "SPACIOUS";
export type TemplateDisplayEmphasis = "BALANCED" | "CONTENT" | "MEDIA";
export type TemplateDisplayAlignment = "START" | "CENTER";
export type TemplateBackgroundVariant = "THEME" | "SUBTLE" | "STRONG";

export type TemplateOverrideLevel =
  | "LOCKED"
  | "QUIZ"
  | "SECTION"
  | "SLIDE"
  | "RUNTIME";

export type TemplateOverrideProperty =
  | "answerMode"
  | "category"
  | "layout"
  | "mediaPlayback"
  | "points"
  | "revealStep"
  | "solution"
  | "stageTimings"
  | "timer";

export type TemplateAuthoringCapability =
  | "MEDIA_UPLOAD"
  | "IMAGE_CROP"
  | "PIXEL_GENERATOR"
  | "FACE_MORPH_GENERATOR"
  | "AUDIO_REVERSE"
  | "AUDIO_BITCRUSH"
  | "TRANSLATION"
  | "TTS_PREVIEW"
  | "ANAGRAM_GENERATOR"
  | "ANAGRAM_FROM_SOLUTION"
  | "DUPLICATE_CHECK"
  | "QUALITY_CHECK"
  | "ANSWER_VARIANT_EDITOR"
  | "LAYOUT_PREVIEW"
  | "THEME_PREVIEW";

export type TemplateDataSourceType =
  | "STATIC"
  | "GENERATED"
  | "USER_OR_GENERATED"
  | "RUNTIME"
  | "DERIVED"
  | "EXTERNAL_TRANSIENT";

export type TemplateDataSourceDefinition = {
  sourceId: string;
  type: TemplateDataSourceType;
  resolution:
    | "CONTENT_ITEM"
    | "EMBEDDED_CONTENT"
    | "STORED_REFERENCE"
    | "ON_SLIDE_ENTER"
    | "ON_DEMAND"
    | "LIVE";
  persistence:
    | "NONE"
    | "CONTENT_ITEM"
    | "QUIZ_SLIDE"
    | "RUNTIME_STATE"
    | "SNAPSHOT";
  refreshPolicy: "NEVER" | "AUTOMATIC" | "MANUAL" | "ON_REENTER";
  fallback: "NONE" | "LAST_KNOWN" | "HIDE_COMPONENT" | "BLOCK_RUNTIME";
};

export type TemplateRuntimeStateRequirement = {
  stateKey: string;
  resetOnSlideEnter: boolean;
  persistAcrossReload: boolean;
  dataSourceId?: string;
};

export type TemplateRendererId = QuestionTemplateSurfaceKind | "PODIUM";

export type TemplateRendererContract = {
  editor: TemplateRendererId | null;
  moderationPreview: TemplateRendererId | null;
  presentation: TemplateRendererId | null;
  teamForm?: Partial<
    Record<TemplateInteractionType, TemplateRendererId>
  >;
  solution?: TemplateRendererId;
  exportPrint?: TemplateRendererId;
};

export type TemplateCompatibilityContract = {
  legacyMappings: readonly {
    templateId: string;
    interactionType?: TemplateInteractionType;
  }[];
  legacyFieldNames?: Readonly<Record<string, string>>;
};

export type TemplateMigrationStep = {
  migrationId: string;
  fromVersion: number;
  toVersion: number;
};

export type TemplateDefinition = {
  identity: {
    templateId: string;
    version: number;
    name: string;
    description: string;
    family: TemplateFamily;
    icon?: string;
    documentationKey?: string;
  };
  lifecycle: {
    status: TemplateLifecycleStatus;
    availability: TemplateAvailability;
  };
  classification: {
    tags: readonly string[];
  };
  content: {
    contentItemRequired: boolean;
    fields: readonly TemplateContentFieldDefinition[];
  };
  components: {
    slots: readonly TemplateComponentSlot[];
  };
  interaction: TemplateInteractionContract;
  evaluation: TemplateEvaluationContract;
  reveal: TemplateRevealContract;
  moderation: TemplateModerationContract;
  layout: {
    defaultVariant: TemplateLayoutVariant;
    allowedVariants: readonly TemplateLayoutVariant[];
  };
  display: {
    densities: readonly TemplateDisplayDensity[];
    emphases: readonly TemplateDisplayEmphasis[];
    alignments: readonly TemplateDisplayAlignment[];
    backgrounds: readonly TemplateBackgroundVariant[];
  };
  overrides: {
    properties: Readonly<
      Partial<Record<TemplateOverrideProperty, TemplateOverrideLevel>>
    >;
  };
  authoring: {
    capabilities: readonly TemplateAuthoringCapability[];
  };
  validation: {
    rules: readonly TemplateValidationRule[];
  };
  dataSources: readonly TemplateDataSourceDefinition[];
  runtime: {
    stateRequirements: readonly TemplateRuntimeStateRequirement[];
  };
  renderer: TemplateRendererContract;
  compatibility: TemplateCompatibilityContract;
  migration: {
    currentVersion: number;
    steps: readonly TemplateMigrationStep[];
  };
};
