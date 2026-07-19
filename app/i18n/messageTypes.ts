import type { deQuestionEditorMessages } from "./messages/de/questionEditor";

export type WidenMessageCatalog<T> = {
  [K in keyof T]: T[K] extends string ? string : WidenMessageCatalog<T[K]>;
};

export type PartialMessageCatalog<T> = {
  [K in keyof T]?: T[K] extends string ? string : PartialMessageCatalog<T[K]>;
};

export type QuestionEditorMessages = WidenMessageCatalog<
  typeof deQuestionEditorMessages
>;

export type QuestionEditorMessageOverrides = PartialMessageCatalog<
  QuestionEditorMessages
>;

export type MessageParams = Record<string, string | number>;
