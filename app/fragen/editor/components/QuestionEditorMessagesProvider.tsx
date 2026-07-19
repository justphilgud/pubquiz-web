"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppLocale } from "@/app/i18n/locale";
import type { QuestionEditorMessages } from "@/app/i18n/messageTypes";

type QuestionEditorMessageContextValue = {
  locale: AppLocale;
  messages: QuestionEditorMessages;
};

const QuestionEditorMessageContext =
  createContext<QuestionEditorMessageContextValue | null>(null);

export function QuestionEditorMessagesProvider({
  locale,
  messages,
  children,
}: QuestionEditorMessageContextValue & { children: ReactNode }) {
  return (
    <QuestionEditorMessageContext.Provider value={{ locale, messages }}>
      {children}
    </QuestionEditorMessageContext.Provider>
  );
}

export function useQuestionEditorMessages() {
  const value = useContext(QuestionEditorMessageContext);

  if (!value) {
    throw new Error("QuestionEditorMessagesProvider is missing.");
  }

  return value;
}
