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
  const structuralTemplateId = template.baseTemplateId ?? template.id;
  const templateData = getDefaultQuestionTemplateData(structuralTemplateId);
  const answers = template.initialAnswers.map((answer) => {
    const id = createId();
    return {
      id,
      fieldGroupId: answer.fieldLabel ? id : undefined,
      fieldLabel: answer.fieldLabel,
      isRequired: answer.fieldLabel ? true : undefined,
      text: answer.text ?? "",
      isCorrect: answer.isCorrect ?? false,
      additionalInfo: answer.additionalInfo ?? "",
      media: null,
    } satisfies QuestionAnswerDraft;
  });
  return {
    ...draft,
    templateId: template.sourceTemplateId
      ? template.baseTemplateId ?? null
      : template.id === "standard"
        ? null
        : template.id,
    sourceTemplateId: template.sourceTemplateId ?? null,
    questionText: template.sourceTemplateId
      ? template.defaultQuestionText
      : draft.questionText.trim()
        ? draft.questionText
        : template.defaultQuestionText,
    questionMedia: template.sourceTemplateId
      ? structuredClone(template.initialQuestionMedia ?? [])
      : draft.questionMedia,
    templateConfig: template.initialTemplateConfig
      ? structuredClone(template.initialTemplateConfig)
      : {
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
    sourceTemplateId: null,
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
