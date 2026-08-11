import type {
  QuestionAnswerDraft,
  QuestionEditorDraft,
  QuestionMediaDraft,
  QuestionMediaSlotConfig,
  QuestionTemplate,
} from "./types";
import type { QuestionEditorMessages } from "@/app/i18n/messageTypes";
import { getMediaSlotDefinition } from "./mediaSlots";
import {
  getAnswersForTemplateData,
  getDefaultQuestionTemplateData,
} from "./templates/questionTemplateData";
import { resolveCanonicalQuestionTemplateId } from "./templates/questionTemplateRegistry";

export type QuestionTemplateChangeImpact = {
  overwritesContent: boolean;
  retainsQuestionMedia: boolean;
  hasRequiredMediaTypeConflict: boolean;
};

export function analyzeQuestionTemplateChange(
  draft: QuestionEditorDraft,
  template: QuestionTemplate,
): QuestionTemplateChangeImpact {
  const retainedMedia = draft.questionMedia.filter((media) => media.operation !== "REMOVE");
  return {
    overwritesContent:
      draft.templateId !== null ||
      draft.questionText.trim().length > 0 ||
      draft.answers.length !== 1 ||
      draft.answers.some(
        (answer) => answer.text.trim().length > 0 || answer.additionalInfo.trim().length > 0 || answer.media !== null,
      ),
    retainsQuestionMedia: draft.questionMedia.length > 0,
    hasRequiredMediaTypeConflict: retainedMedia.some(
      (media) => !template.mediaSlots.some(
        (slot) => slot.key === media.slotKey && slot.allowedMediaType === media.mediaType,
      ),
    ),
  };
}

export function applyQuestionTemplateToDraft(
  draft: QuestionEditorDraft,
  template: QuestionTemplate,
  createId: () => string,
): QuestionEditorDraft {
  const templateData = getDefaultQuestionTemplateData(template.id);
  const answers = template.initialAnswers.map((answer) => {
    const id = createId();
    return {
      id,
      fieldGroupId: answer.fieldLabel ? id : undefined,
      fieldLabel: answer.fieldLabel,
      isRequired: answer.fieldLabel ? true : undefined,
      text: answer.text ?? "",
      isCorrect: answer.isCorrect ?? false,
      additionalInfo: "",
      media: null,
    } satisfies QuestionAnswerDraft;
  });
  return {
    ...draft,
    templateId: template.id,
    questionText: draft.questionText.trim()
      ? draft.questionText
      : template.defaultQuestionText,
    templateConfig: {
      ...draft.templateConfig,
      ...(templateData ? { templateData } : {}),
    },
    answers: templateData
      ? getAnswersForTemplateData(templateData, answers)
      : answers,
  };
}

export function clearQuestionTemplateFromDraft(draft: QuestionEditorDraft): QuestionEditorDraft {
  const switchesFromSpecialTemplate =
    resolveCanonicalQuestionTemplateId(draft.templateId) !== null;
  return {
    ...draft,
    templateId: null,
    questionText: switchesFromSpecialTemplate ? "" : draft.questionText,
    templateConfig: {
      stageDurationsSeconds: draft.templateConfig.stageDurationsSeconds,
      createPixelQuestionByAnswer: draft.templateConfig.createPixelQuestionByAnswer,
    },
    answers: draft.answers.map((answer) => ({
      id: answer.id,
      answerId: answer.answerId,
      text: answer.text,
      isCorrect: answer.isCorrect,
      additionalInfo: answer.additionalInfo,
      media: answer.media,
    })),
  };
}

export function getActiveQuestionMediaSlots(
  selectedTemplate: QuestionTemplate | null,
  questionMedia: QuestionMediaDraft[],
  messages?: QuestionEditorMessages,
): QuestionMediaSlotConfig[] {
  const active = selectedTemplate?.mediaSlots ?? [];
  const known = new Set(active.map((slot) => slot.key));
  const retainedSlots = questionMedia
    .filter((media) => !known.has(media.slotKey))
    .map((media): QuestionMediaSlotConfig => {
      const definition = getMediaSlotDefinition(media.slotKey);
      return {
        key: media.slotKey,
        allowedMediaType: media.mediaType ?? definition.mediaType,
        required: false,
        label: messages?.mediaSlots[definition.labelKey].label ?? "Medium zur Frage",
        helpText: messages?.mediaSlots[definition.helpKey].help ?? "Vorhandenes Fragenmedium bleibt erhalten.",
        manualUploadAllowed: definition.manualUploadAllowed,
        generatorInput: definition.generatorInput,
        generatorOutput: definition.generatorOutput,
      };
    });
  return [...active, ...retainedSlots];
}
