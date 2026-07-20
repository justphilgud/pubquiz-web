import { getBerlinDate } from "@/app/lib/berlinDate";
import { deRenderingMessages } from "@/app/i18n/messages/de/rendering";
import {
  isSelectableAnswerFormTemplateId,
  isSelectablePresentationTemplateId,
  type AnswerFormTemplate,
  type PresentationTemplate,
} from "@/app/rendering/templateRegistry";

export const QUIZ_MASTER_DATA_LIMITS = {
  title: 200,
  venueName: 200,
  url: 2048,
  internalNote: 2000,
} as const;

export type QuizMasterDataInput = {
  eventSeriesId: number;
  title: string;
  date: string;
  time?: string;
  venueName?: string;
  mapUrl?: string;
  publicUrl?: string;
  internalNote?: string;
  presentationTemplateId?: string | null;
  answerFormTemplateId?: string | null;
};

export type NormalizedQuizMasterData = {
  eventSeriesId: number;
  title: string;
  date: string;
  dateValue: Date;
  time: string | null;
  venueName: string | null;
  mapUrl: string | null;
  publicUrl: string | null;
  internalNote: string | null;
  presentationTemplateId: PresentationTemplate["id"] | null;
  answerFormTemplateId: AnswerFormTemplate["id"] | null;
};

export type QuizMasterDataValidationResult =
  | { ok: true; value: NormalizedQuizMasterData }
  | { ok: false; errors: Record<string, string>; message: string };

export function resolveInitialEventSeriesId(
  requestedId: string | undefined,
  eventSeries: ReadonlyArray<{ id: number; isArchived: boolean }>,
) {
  const parsedId = Number(requestedId);
  return eventSeries.some(
    (entry) => entry.id === parsedId && !entry.isArchived,
  )
    ? parsedId
    : undefined;
}

function optional(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isSafeHttpUrl(value: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateQuizMasterData(
  input: QuizMasterDataInput,
): QuizMasterDataValidationResult {
  const title = input.title.trim();
  const date = input.date.trim();
  const time = optional(input.time);
  const venueName = optional(input.venueName);
  const mapUrl = optional(input.mapUrl);
  const publicUrl = optional(input.publicUrl);
  const internalNote = optional(input.internalNote);
  const presentationTemplateId = optional(input.presentationTemplateId ?? undefined);
  const answerFormTemplateId = optional(input.answerFormTemplateId ?? undefined);
  const errors: Record<string, string> = {};

  if (!Number.isInteger(input.eventSeriesId) || input.eventSeriesId <= 0) {
    errors.eventSeriesId = "Eventreihe ist erforderlich.";
  }
  if (!title) errors.title = "Name ist erforderlich.";
  else if (title.length > QUIZ_MASTER_DATA_LIMITS.title) {
    errors.title = `Name darf maximal ${QUIZ_MASTER_DATA_LIMITS.title} Zeichen enthalten.`;
  }
  if (!date) errors.date = "Datum ist erforderlich.";
  else if (!isValidDate(date)) errors.date = "Datum ist ungültig.";
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    errors.time = "Uhrzeit muss im Format HH:MM angegeben werden.";
  }
  if ((venueName?.length ?? 0) > QUIZ_MASTER_DATA_LIMITS.venueName) {
    errors.venueName = `Veranstaltungsname darf maximal ${QUIZ_MASTER_DATA_LIMITS.venueName} Zeichen enthalten.`;
  }
  if ((mapUrl?.length ?? 0) > QUIZ_MASTER_DATA_LIMITS.url || !isSafeHttpUrl(mapUrl)) {
    errors.mapUrl = "Kartenlink muss eine gültige HTTP- oder HTTPS-URL sein.";
  }
  if ((publicUrl?.length ?? 0) > QUIZ_MASTER_DATA_LIMITS.url || !isSafeHttpUrl(publicUrl)) {
    errors.publicUrl = "Veranstaltungs-URL muss eine gültige HTTP- oder HTTPS-URL sein.";
  }
  if ((internalNote?.length ?? 0) > QUIZ_MASTER_DATA_LIMITS.internalNote) {
    errors.internalNote = `Interne Bemerkung darf maximal ${QUIZ_MASTER_DATA_LIMITS.internalNote} Zeichen enthalten.`;
  }
  if (presentationTemplateId && !isSelectablePresentationTemplateId(presentationTemplateId)) {
    errors.presentationTemplateId = deRenderingMessages.validation.unknownPresentation;
  }
  if (answerFormTemplateId && !isSelectableAnswerFormTemplateId(answerFormTemplateId)) {
    errors.answerFormTemplateId = deRenderingMessages.validation.unknownAnswerForm;
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      message: Object.values(errors)[0],
    };
  }

  return {
    ok: true,
    value: {
      eventSeriesId: input.eventSeriesId,
      title,
      date,
      dateValue: new Date(`${date}T00:00:00.000Z`),
      time,
      venueName,
      mapUrl,
      publicUrl,
      internalNote,
      presentationTemplateId: presentationTemplateId as PresentationTemplate["id"] | null,
      answerFormTemplateId: answerFormTemplateId as AnswerFormTemplate["id"] | null,
    },
  };
}

export function buildQuizCopyMasterData(
  original: {
    eventSeriesId: number;
    time: string | null;
    venueName: string | null;
    mapUrl: string | null;
    internalNote: string | null;
    presentationTemplateId?: string | null;
    answerFormTemplateId?: string | null;
  },
  target: { title: string; date: string },
): QuizMasterDataInput {
  return {
    eventSeriesId: original.eventSeriesId,
    title: target.title,
    date: target.date,
    time: original.time ?? undefined,
    venueName: original.venueName ?? undefined,
    mapUrl: original.mapUrl ?? undefined,
    publicUrl: undefined,
    internalNote: original.internalNote ?? undefined,
    presentationTemplateId: original.presentationTemplateId ?? null,
    answerFormTemplateId: original.answerFormTemplateId ?? null,
  };
}

export type QuizTemporalStatus =
  | "UPCOMING"
  | "TODAY"
  | "PAST"
  | "ARCHIVED"
  | "MISSING_DATE";

export function getQuizTemporalStatus(
  date: string | Date | null,
  isArchived: boolean,
  now = new Date(),
): QuizTemporalStatus {
  if (isArchived) return "ARCHIVED";
  if (!date) return "MISSING_DATE";

  const dateKey = typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  const todayKey = getBerlinDate(now).toISOString().slice(0, 10);
  if (dateKey === todayKey) return "TODAY";
  return dateKey < todayKey ? "PAST" : "UPCOMING";
}
