import type { QuestionEditorMessages } from "@/app/i18n/messageTypes";
import type {
  QuestionTemplate,
  QuestionTemplateDefinition,
} from "../types";
import {
  findQuestionTemplate,
  questionTemplateIds,
} from "./questionTemplateRegistry";
import { getMediaSlotDefinition } from "../mediaSlots";
import {
  buildTemplateContractRegistry,
  isTemplateContractAvailable,
  resolveTemplateContract,
} from "@/app/rendering/templates/templateContractResolver";
import {
  questionTemplateContractOverlays,
  standaloneTemplateContracts,
} from "@/app/rendering/templates/referenceTemplates";
import {
  validateQuestionTemplateContractCoverage,
  validateTemplateContractRegistry,
} from "@/app/rendering/templates/templateContractValidation";

export const questionTemplateDefinitions: QuestionTemplateDefinition[] = [
  {
    id: questionTemplateIds.standard,
    icon: "message-square",
    enabled: true,
    answerMode: "OPEN_TEXT",
    evaluationMode: "MANUAL",
    editorKind: "STANDARD",
    presentationKind: "STANDARD",
    answerFormKind: "STANDARD",
    selectable: false,
    availableForFiltering: true,
    requiresAnswerImages: false,
    translationKey: "standard",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: true,
    initialAnswers: [{ isCorrect: true }],
    mediaSlots: [
      { slotKey: "question_image", required: false },
      { slotKey: "question_audio", required: false },
    ],
    generators: [],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.multipleChoice,
    icon: "list-checks", enabled: true, answerMode: "MULTIPLE_CHOICE",
    evaluationMode: "EXACT_MATCH", editorKind: "STANDARD",
    presentationKind: "STANDARD", answerFormKind: "STANDARD",
    selectable: false,
    availableForFiltering: false,
    requiresAnswerImages: false,
    translationKey: "multipleChoice",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: true,
    initialAnswers: [
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: false },
    ],
    mediaSlots: [
      { slotKey: "question_image", required: false },
      { slotKey: "question_audio", required: false },
    ],
    generators: [],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.faceMorph,
    questionTextIsTemplateStatic: true,
    icon: "scan-face", enabled: true, answerMode: "OPEN_TEXT",
    evaluationMode: "MANUAL", editorKind: "STANDARD",
    presentationKind: "STANDARD", answerFormKind: "STANDARD",
    selectable: true,
    availableForFiltering: true,
    requiresAnswerImages: true,
    translationKey: "faceMorph",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: false,
    initialAnswers: [
      { fieldLabelKey: "personA", isCorrect: true },
      { fieldLabelKey: "personB", isCorrect: true },
    ],
    mediaSlots: [{ slotKey: "face_morph_result", required: true }],
    generators: [],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.musicReverse,
    questionTextIsTemplateStatic: true,
    icon: "audio-lines", enabled: true, answerMode: "OPEN_TEXT",
    evaluationMode: "MANUAL", editorKind: "STANDARD",
    presentationKind: "STANDARD", answerFormKind: "STANDARD",
    selectable: true,
    availableForFiltering: true,
    requiresAnswerImages: false,
    translationKey: "musicReverse",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: false,
    initialAnswers: [
      { fieldLabelKey: "artist", isCorrect: true },
      { fieldLabelKey: "title", isCorrect: true },
    ],
    mediaSlots: [
      { slotKey: "music_original_audio", required: true },
      { slotKey: "music_reverse_audio", required: true },
    ],
    generators: ["audio_reverse"],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.musicEightBit,
    questionTextIsTemplateStatic: true,
    icon: "music", enabled: true, answerMode: "OPEN_TEXT",
    evaluationMode: "MANUAL", editorKind: "STANDARD",
    presentationKind: "STANDARD", answerFormKind: "STANDARD",
    selectable: false,
    availableForFiltering: false,
    requiresAnswerImages: false,
    translationKey: "musicEightBit",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: false,
    initialAnswers: [{ fieldLabelKey: "title", isCorrect: true }],
    mediaSlots: [
      { slotKey: "music_original_audio", required: true },
      { slotKey: "music_bitcrush_audio", required: true },
    ],
    generators: ["audio_bitcrush"],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.pixelImage,
    questionTextIsTemplateStatic: true,
    icon: "image", enabled: true, answerMode: "OPEN_TEXT",
    evaluationMode: "MANUAL", editorKind: "STANDARD",
    presentationKind: "STANDARD", answerFormKind: "STANDARD",
    selectable: true,
    availableForFiltering: true,
    requiresAnswerImages: false,
    translationKey: "pixelImage",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: false,
    initialAnswers: [{ fieldLabelKey: "solution", isCorrect: true }],
    mediaSlots: [
      { slotKey: "pixel_original_image", required: true },
      { slotKey: "pixel_stage_3_image", required: true },
      { slotKey: "pixel_stage_2_image", required: true },
      { slotKey: "pixel_stage_1_image", required: true },
    ],
    generators: ["image_pixelate"],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.trueFalse,
    icon: "badge-check", enabled: true, selectable: true,
    availableForFiltering: true, requiresAnswerImages: false,
    answerMode: "BOOLEAN", evaluationMode: "BOOLEAN_MATCH",
    editorKind: "TRUE_FALSE", presentationKind: "TRUE_FALSE",
    answerFormKind: "TRUE_FALSE", translationKey: "trueFalse",
    questionLabelKey: "statement",
    allowsOptionalQuestionImage: true,
    initialAnswers: [{ isCorrect: true }, { isCorrect: false }],
    mediaSlots: [{ slotKey: "question_image", required: false }],
    generators: [],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.estimate,
    icon: "gauge", enabled: true, selectable: true,
    availableForFiltering: true, requiresAnswerImages: false,
    answerMode: "NUMBER", evaluationMode: "NUMERIC_CLOSEST",
    editorKind: "ESTIMATE", presentationKind: "ESTIMATE",
    answerFormKind: "ESTIMATE", translationKey: "estimate",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: true, initialAnswers: [{ isCorrect: true }],
    mediaSlots: [{ slotKey: "question_image", required: false }], generators: [],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.ordering,
    icon: "list-ordered", enabled: true, selectable: true,
    availableForFiltering: true, requiresAnswerImages: false,
    answerMode: "ORDERING", evaluationMode: "ORDER_POSITION",
    editorKind: "ORDERING", presentationKind: "ORDERING",
    answerFormKind: "ORDERING", translationKey: "ordering",
    questionLabelKey: "task",
    allowsOptionalQuestionImage: true,
    initialAnswers: [{ isCorrect: true }, { isCorrect: true }],
    mediaSlots: [{ slotKey: "question_image", required: false }], generators: [],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.translationReadAloud,
    questionTextIsTemplateStatic: true,
    icon: "languages", enabled: true, selectable: true,
    availableForFiltering: true, requiresAnswerImages: false,
    answerMode: "OPEN_TEXT", evaluationMode: "MANUAL",
    editorKind: "TRANSLATION_READ_ALOUD",
    presentationKind: "TRANSLATION_READ_ALOUD",
    answerFormKind: "TRANSLATION_READ_ALOUD",
    translationKey: "translationReadAloud",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: false, initialAnswers: [{ isCorrect: true }],
    mediaSlots: [{ slotKey: "lyrics_tts_audio", required: false }],
    generators: [],
    contentGenerators: ["text_translation", "text_to_speech"],
  },
  {
    id: questionTemplateIds.anagram,
    questionTextIsTemplateStatic: true,
    icon: "shuffle", enabled: true, selectable: true,
    availableForFiltering: true, requiresAnswerImages: false,
    answerMode: "OPEN_TEXT", evaluationMode: "EXACT_MATCH",
    editorKind: "ANAGRAM", presentationKind: "ANAGRAM",
    answerFormKind: "ANAGRAM", translationKey: "anagram",
    questionLabelKey: "searchTarget",
    allowsOptionalQuestionImage: false, initialAnswers: [{ isCorrect: true }],
    mediaSlots: [], generators: [],
    contentGenerators: ["anagram_generate"],
  },
  {
    id: questionTemplateIds.googleReviews,
    questionTextIsTemplateStatic: true,
    icon: "star", enabled: true, selectable: true,
    availableForFiltering: true, requiresAnswerImages: false,
    answerMode: "OPEN_TEXT", evaluationMode: "MANUAL",
    editorKind: "GOOGLE_REVIEWS", presentationKind: "GOOGLE_REVIEWS",
    answerFormKind: "GOOGLE_REVIEWS", translationKey: "googleReviews",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: false, initialAnswers: [{ isCorrect: true }],
    mediaSlots: [{ slotKey: "lyrics_tts_audio", required: false }],
    generators: [],
    contentGenerators: ["text_to_speech"],
  },
  {
    id: questionTemplateIds.pollSingle,
    icon: "circle-dot",
    enabled: true,
    answerMode: "POLL_SINGLE",
    evaluationMode: "NONE",
    editorKind: "POLL_OPTIONS",
    presentationKind: "POLL_OPTIONS",
    answerFormKind: "POLL_OPTIONS",
    selectable: true,
    availableForFiltering: true,
    requiresAnswerImages: false,
    translationKey: "pollSingle",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: false,
    initialAnswers: [
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: false },
    ],
    mediaSlots: [],
    generators: [],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.pollMulti,
    icon: "list-checks",
    enabled: true,
    answerMode: "POLL_MULTI",
    evaluationMode: "NONE",
    editorKind: "POLL_OPTIONS",
    presentationKind: "POLL_OPTIONS",
    answerFormKind: "POLL_OPTIONS",
    selectable: true,
    availableForFiltering: true,
    requiresAnswerImages: false,
    translationKey: "pollMulti",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: false,
    initialAnswers: [
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: false },
    ],
    mediaSlots: [],
    generators: [],
    contentGenerators: [],
  },
  {
    id: questionTemplateIds.pollScale,
    icon: "sliders-horizontal",
    enabled: true,
    answerMode: "POLL_SCALE",
    evaluationMode: "NONE",
    editorKind: "POLL_SCALE",
    presentationKind: "POLL_SCALE",
    answerFormKind: "POLL_SCALE",
    selectable: true,
    availableForFiltering: true,
    requiresAnswerImages: false,
    translationKey: "pollScale",
    questionLabelKey: "question",
    allowsOptionalQuestionImage: false,
    initialAnswers: [],
    mediaSlots: [],
    generators: [],
    contentGenerators: [],
  },
];

export const questionTemplateContractRegistry =
  buildTemplateContractRegistry(
    questionTemplateDefinitions,
    questionTemplateContractOverlays,
    standaloneTemplateContracts,
  );

export function getQuestionTemplateContract(
  templateId: string | null,
  version?: number,
) {
  return resolveTemplateContract(
    questionTemplateContractRegistry,
    templateId,
    version,
  );
}

export function getCreatableQuestionTemplateContracts() {
  return questionTemplateContractRegistry.filter((template) =>
    isTemplateContractAvailable(template, "create"),
  );
}

export function getQuestionTemplateDefinition(templateId: string | null) {
  return findQuestionTemplate(
    questionTemplateDefinitions,
    templateId ?? questionTemplateIds.standard,
  );
}

export function validateQuestionTemplateDefinitions(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const definition of questionTemplateDefinitions) {
    if (ids.has(definition.id)) errors.push(`Doppelte Template-ID: ${definition.id}`);
    ids.add(definition.id);
    if (!definition.icon.trim()) errors.push(`Icon fehlt: ${definition.id}`);
    if (!definition.editorKind || !definition.presentationKind || !definition.answerFormKind) {
      errors.push(`Oberflächenzuordnung fehlt: ${definition.id}`);
    }
  }
  errors.push(
    ...validateTemplateContractRegistry(questionTemplateContractRegistry).map(
      (validationIssue) =>
        `${validationIssue.code} (${validationIssue.path}): ${validationIssue.message}`,
    ),
    ...validateQuestionTemplateContractCoverage(
      questionTemplateDefinitions,
      questionTemplateContractRegistry,
    ).map(
      (validationIssue) =>
        `${validationIssue.code} (${validationIssue.path}): ${validationIssue.message}`,
    ),
  );
  return errors;
}

export function localizeQuestionTemplates(
  messages: QuestionEditorMessages,
): QuestionTemplate[] {
  return questionTemplateDefinitions.map((definition) => {
    const translation = messages.templates[definition.translationKey];

    return {
      id: definition.id,
      icon: definition.icon,
      enabled: definition.enabled,
      answerMode: definition.answerMode,
      evaluationMode: definition.evaluationMode,
      editorKind: definition.editorKind,
      presentationKind: definition.presentationKind,
      answerFormKind: definition.answerFormKind,
      selectable: definition.selectable,
      availableForFiltering: definition.availableForFiltering,
      requiresAnswerImages: definition.requiresAnswerImages,
      name: translation.name,
      description: translation.description,
      defaultQuestionText: translation.defaultQuestion,
      questionLabel: messages.question.labels[definition.questionLabelKey],
      allowsOptionalQuestionImage: definition.allowsOptionalQuestionImage,
      generators: definition.generators,
      contentGenerators: definition.contentGenerators,
      initialAnswers: definition.initialAnswers.map((answer) => ({
        fieldLabel: answer.fieldLabelKey
          ? messages.templateFields[answer.fieldLabelKey]
          : undefined,
        isCorrect: answer.isCorrect,
      })),
      mediaSlots: definition.mediaSlots.map((templateSlot) => {
        const slotDefinition = getMediaSlotDefinition(templateSlot.slotKey);
        return {
          key: slotDefinition.key,
          allowedMediaType: slotDefinition.mediaType,
          required: templateSlot.required,
          label: messages.mediaSlots[slotDefinition.labelKey].label,
          helpText: messages.mediaSlots[slotDefinition.helpKey].help,
          manualUploadAllowed: slotDefinition.manualUploadAllowed,
          generatorInput: slotDefinition.generatorInput,
          generatorOutput: slotDefinition.generatorOutput,
        };
      }),
    };
  });
}
