import "server-only";

import { resolveLocale, type AppLocale } from "./locale";
import { loadQuestionEditorMessages } from "./questionEditorMessages";

export function getQuestionEditorMessages(locale?: string | null) {
  const resolvedLocale: AppLocale = resolveLocale(locale);

  return {
    locale: resolvedLocale,
    messages: loadQuestionEditorMessages(resolvedLocale),
  };
}
