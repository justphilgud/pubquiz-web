import {
  getInitialQuizFlowConfig,
  isQuizFlowItemType,
  validateQuizFlowConfig,
  type QuizFlowConfig,
  type QuizFlowItemType,
} from "@/app/quiz/flow/quizFlow";

export const STORY_ELEMENT_TYPES = [
  "IMAGE",
  "IMAGE_GALLERY",
  "TEXT",
  "ANECDOTE",
  "QUOTE",
  "PORTRAIT",
  "CHAPTER_INTRO",
  "MEDIA_SEQUENCE",
  "AUDIO",
  "VIDEO",
  "CUSTOM_MESSAGE",
] as const satisfies readonly QuizFlowItemType[];

export type StoryElementType = (typeof STORY_ELEMENT_TYPES)[number];

export const STORY_ELEMENT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type StoryElementStatusValue = (typeof STORY_ELEMENT_STATUSES)[number];

export const STORY_ELEMENT_SCOPES = ["GLOBAL", "EVENT_SERIES", "QUIZ"] as const;
export type StoryElementScopeValue = (typeof STORY_ELEMENT_SCOPES)[number];

export const STORY_QUESTION_RELATIONSHIPS = [
  "CONTEXT",
  "AFTER_SOLUTION",
  "RELATED",
  "REVEAL",
  "FOLLOW_UP",
] as const;
export type StoryQuestionRelationshipValue =
  (typeof STORY_QUESTION_RELATIONSHIPS)[number];

/**
 * Compatibility value for new editorial links. The field remains persisted so
 * existing relationship metadata is not lost, but quiz placement is controlled
 * exclusively by quiz_ablauf_elemente.
 */
export const DEFAULT_STORY_QUESTION_RELATIONSHIP = "AFTER_SOLUTION" as const;

export function getNewStoryQuestionRelationship() {
  return DEFAULT_STORY_QUESTION_RELATIONSHIP;
}

export const PRODUCTIVE_STORY_QUESTION_RELATIONSHIPS = [
  "RELATED",
  "AFTER_SOLUTION",
] as const satisfies readonly StoryQuestionRelationshipValue[];

export type StoryElementMutationInput = {
  type: unknown;
  title: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  moderatorNote?: unknown;
  status: unknown;
  scope: unknown;
  eventSeriesId?: unknown;
  quizId?: unknown;
  config: unknown;
};

export type ValidatedStoryElementInput = {
  type: StoryElementType;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  moderatorNote: string | null;
  status: Exclude<StoryElementStatusValue, "ARCHIVED">;
  scope: StoryElementScopeValue;
  eventSeriesId: number | null;
  quizId: number | null;
  config: QuizFlowConfig;
};

export type StoryElementValidation =
  | { ok: true; value: ValidatedStoryElementInput }
  | { ok: false; message: string };

function normalizeText(value: unknown, limit: number, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length > limit || (required && !normalized)) return null;
  return normalized;
}

function normalizeOptionalId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const id = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : Number.NaN;
}

export function isStoryElementType(value: unknown): value is StoryElementType {
  return typeof value === "string" &&
    isQuizFlowItemType(value) &&
    STORY_ELEMENT_TYPES.some((type) => type === value);
}

export function isStoryElementStatus(value: unknown): value is StoryElementStatusValue {
  return typeof value === "string" &&
    STORY_ELEMENT_STATUSES.some((status) => status === value);
}

export function isStoryElementScope(value: unknown): value is StoryElementScopeValue {
  return typeof value === "string" &&
    STORY_ELEMENT_SCOPES.some((scope) => scope === value);
}

export function isStoryQuestionRelationship(
  value: unknown,
): value is StoryQuestionRelationshipValue {
  return typeof value === "string" &&
    STORY_QUESTION_RELATIONSHIPS.some((relationship) => relationship === value);
}

export function validateStoryElementInput(
  input: StoryElementMutationInput,
): StoryElementValidation {
  if (!isStoryElementType(input.type)) {
    return { ok: false, message: "Der Story-Element-Typ ist ungültig." };
  }
  if (!isStoryElementStatus(input.status) || input.status === "ARCHIVED") {
    return { ok: false, message: "Der Lebenszyklusstatus ist ungültig." };
  }
  if (!isStoryElementScope(input.scope)) {
    return { ok: false, message: "Der Geltungsbereich ist ungültig." };
  }

  const title = normalizeText(input.title, 160, true);
  const description = normalizeText(input.description, 1_000);
  const category = normalizeText(input.category, 120);
  const moderatorNote = normalizeText(input.moderatorNote, 2_000);
  if (title === null || description === null || category === null || moderatorNote === null) {
    return { ok: false, message: "Mindestens ein Textfeld ist leer oder zu lang." };
  }

  const rawTags = Array.isArray(input.tags)
    ? input.tags
    : typeof input.tags === "string"
      ? input.tags.split(",")
      : [];
  const tags = [...new Set(rawTags.map((tag) => normalizeText(tag, 40)).filter(
    (tag): tag is string => typeof tag === "string" && tag.length > 0,
  ))];
  if (tags.length > 20) {
    return { ok: false, message: "Es sind höchstens 20 Tags erlaubt." };
  }

  const eventSeriesId = normalizeOptionalId(input.eventSeriesId);
  const quizId = normalizeOptionalId(input.quizId);
  if (Number.isNaN(eventSeriesId) || Number.isNaN(quizId)) {
    return { ok: false, message: "Eventreihe oder Quiz ist ungültig." };
  }
  if (
    (input.scope === "GLOBAL" && (eventSeriesId !== null || quizId !== null)) ||
    (input.scope === "EVENT_SERIES" && (eventSeriesId === null || quizId !== null)) ||
    (input.scope === "QUIZ" && (quizId === null || eventSeriesId !== null))
  ) {
    return { ok: false, message: "Der Geltungsbereich ist nicht vollständig oder widersprüchlich." };
  }

  const configCandidate = typeof input.config === "object" && input.config !== null
    ? {
        ...(input.config as Record<string, unknown>),
        version: 1,
        title,
        ...(moderatorNote ? { moderatorNote } : { moderatorNote: undefined }),
      }
    : input.config;
  const config = validateQuizFlowConfig(input.type, configCandidate);
  if (!config.ok) return config;

  return {
    ok: true,
    value: {
      type: input.type,
      title,
      description: description || null,
      category: category || null,
      tags,
      moderatorNote: moderatorNote || null,
      status: input.status,
      scope: input.scope,
      eventSeriesId,
      quizId,
      config: config.value,
    },
  };
}

export function getInitialStoryElementConfig(type: StoryElementType) {
  return getInitialQuizFlowConfig(type);
}

export function getStoryElementTypeLabel(type: StoryElementType) {
  return ({
    IMAGE: "Bild",
    IMAGE_GALLERY: "Bildergalerie",
    TEXT: "Text",
    ANECDOTE: "Anekdote",
    QUOTE: "Zitat",
    PORTRAIT: "Portrait",
    CHAPTER_INTRO: "Kapitelintro",
    MEDIA_SEQUENCE: "Mediensequenz",
    AUDIO: "Audio",
    VIDEO: "Video",
    CUSTOM_MESSAGE: "Freie Mitteilung",
  } as const)[type];
}

export function getStoryElementStatusLabel(status: StoryElementStatusValue) {
  return ({ DRAFT: "Entwurf", ACTIVE: "Aktiv", ARCHIVED: "Archiviert" } as const)[status];
}

export function getStoryElementScopeLabel(scope: StoryElementScopeValue) {
  return ({ GLOBAL: "Global verfügbar", EVENT_SERIES: "Eventreihe", QUIZ: "Nur dieses Quiz" } as const)[scope];
}

export function getStoryQuestionRelationshipLabel(
  relationship: StoryQuestionRelationshipValue,
) {
  return ({
    CONTEXT: "Einführung zur Frage",
    AFTER_SOLUTION: "Nach der Auflösung zeigen",
    RELATED: "Inhaltlich verknüpft",
    REVEAL: "Zusatzmaterial zur Auflösung",
    FOLLOW_UP: "Anschließender Inhalt",
  } as const)[relationship];
}
