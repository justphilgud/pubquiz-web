import type { QuestionEditorMessages } from "@/app/i18n/messageTypes";
import type {
  QuestionTemplate,
  QuestionTemplateDefinition,
} from "../types";
import { questionTemplateIds } from "./questionTemplateRegistry";
import { getMediaSlotDefinition } from "../mediaSlots";

export const questionTemplateDefinitions: QuestionTemplateDefinition[] = [
  {
    id: questionTemplateIds.standard,
    selectable: false,
    requiresAnswerImages: false,
    translationKey: "standard",
    allowsOptionalQuestionImage: true,
    initialAnswers: [{ isCorrect: true }],
    mediaSlots: [
      { slotKey: "question_image", required: false },
      { slotKey: "question_audio", required: false },
    ],
    generators: [],
  },
  {
    id: questionTemplateIds.multipleChoice,
    selectable: false,
    requiresAnswerImages: false,
    translationKey: "multipleChoice",
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
  },
  {
    id: questionTemplateIds.faceMorph,
    selectable: true,
    requiresAnswerImages: true,
    translationKey: "faceMorph",
    allowsOptionalQuestionImage: false,
    initialAnswers: [
      { fieldLabelKey: "personA", isCorrect: true },
      { fieldLabelKey: "personB", isCorrect: true },
    ],
    mediaSlots: [{ slotKey: "face_morph_result", required: true }],
    generators: [],
  },
  {
    id: questionTemplateIds.musicReverse,
    selectable: true,
    requiresAnswerImages: false,
    translationKey: "musicReverse",
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
  },
  {
    id: questionTemplateIds.musicEightBit,
    selectable: false,
    requiresAnswerImages: false,
    translationKey: "musicEightBit",
    allowsOptionalQuestionImage: false,
    initialAnswers: [{ fieldLabelKey: "title", isCorrect: true }],
    mediaSlots: [
      { slotKey: "music_original_audio", required: true },
      { slotKey: "music_bitcrush_audio", required: true },
    ],
    generators: ["audio_bitcrush"],
  },
  {
    id: questionTemplateIds.pixelImage,
    selectable: true,
    requiresAnswerImages: false,
    translationKey: "pixelImage",
    allowsOptionalQuestionImage: false,
    initialAnswers: [{ fieldLabelKey: "solution", isCorrect: true }],
    mediaSlots: [
      { slotKey: "pixel_original_image", required: true },
      { slotKey: "pixel_stage_3_image", required: true },
      { slotKey: "pixel_stage_2_image", required: true },
      { slotKey: "pixel_stage_1_image", required: true },
    ],
    generators: ["image_pixelate"],
  },
];

export function localizeQuestionTemplates(
  messages: QuestionEditorMessages,
): QuestionTemplate[] {
  return questionTemplateDefinitions.map((definition) => {
    const translation = messages.templates[definition.translationKey];

    return {
      id: definition.id,
      selectable: definition.selectable,
      requiresAnswerImages: definition.requiresAnswerImages,
      name: translation.name,
      description: translation.description,
      defaultQuestionText: translation.defaultQuestion,
      allowsOptionalQuestionImage: definition.allowsOptionalQuestionImage,
      generators: definition.generators,
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
