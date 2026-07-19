import { formatMessage } from "@/app/i18n/formatMessage";
import type { QuestionEditorMessages } from "@/app/i18n/messageTypes";
import type { QuestionQualityIssue } from "./questionQuality";
import type {
  QuestionEditorErrorCode,
  QuestionEditorSuccessCode,
} from "./types";
import { isMediaSlotKey, getMediaSlotDefinition } from "./mediaSlots";

export function formatQuestionQualityIssue(
  issue: QuestionQualityIssue,
  messages: QuestionEditorMessages,
): string {
  const params = { ...issue.params };
  const labelKey = params.labelKey;

  if (typeof labelKey === "string" && labelKey in messages.templateMedia) {
    params.label = messages.templateMedia[
      labelKey as keyof typeof messages.templateMedia
    ];
  }
  if (isMediaSlotKey(labelKey)) {
    const definition = getMediaSlotDefinition(labelKey);
    params.label = messages.mediaSlots[definition.labelKey].label;
  }

  return formatMessage(messages.quality[issue.code], params);
}

export function formatQuestionEditorError(
  code: QuestionEditorErrorCode | string,
  messages: QuestionEditorMessages,
  fallbackMessage: string,
  params?: Record<string, string | number>,
): string {
  const knownCode = code as QuestionEditorErrorCode;
  const template = messages.errors[knownCode];

  return template ? formatMessage(template, params) : fallbackMessage;
}

export function formatQuestionEditorSuccess(
  code: QuestionEditorSuccessCode,
  messages: QuestionEditorMessages,
  params: Record<string, string | number>,
): string {
  return formatMessage(messages.success[code], params);
}
