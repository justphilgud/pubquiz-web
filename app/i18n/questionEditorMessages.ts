import type { AppLocale } from "./locale";
import type {
  QuestionEditorMessageOverrides,
  QuestionEditorMessages,
} from "./messageTypes";
import { deQuestionEditorMessages } from "./messages/de/questionEditor";
import { enQuestionEditorMessages } from "./messages/en/questionEditor";

function mergeCatalog<T extends object>(base: T, overrides: object): T {
  const result = { ...base } as Record<string, unknown>;

  for (const [key, value] of Object.entries(overrides)) {
    const baseValue = result[key];
    result[key] =
      value && typeof value === "object" && !Array.isArray(value) &&
      baseValue && typeof baseValue === "object" && !Array.isArray(baseValue)
        ? mergeCatalog(baseValue, value)
        : value;
  }

  return result as T;
}

export function loadQuestionEditorMessages(locale: AppLocale): QuestionEditorMessages {
  const german = deQuestionEditorMessages as QuestionEditorMessages;

  return locale === "en"
    ? mergeCatalog(german, enQuestionEditorMessages as QuestionEditorMessageOverrides)
    : german;
}
