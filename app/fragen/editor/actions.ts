"use server";

import { head } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import {
  canApproveQuestion,
  canCreateQuestions,
  canEditQuestion,
  canRequestQuestionChanges,
  canReviewQuestions,
  canSubmitForReview,
  requireQuestionEditor,
} from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import {
  getMediaUploadServerConfig,
  logMediaUploadFailure,
} from "./mediaUploadEnvironment";
import {
  getCurrentUserId,
  resolveQuestionApprovalOnCreate,
  resolveQuestionApprovalOnUpdate,
} from "@/app/services/questionService";
import {
  createAnswerMediaDraftFromStoredMedia,
  createQuestionMediaDraftFromStoredMedia,
  getQuestionMediaFileName,
  getQuestionMediaTypeFromName,
  isAllowedQuestionMediaPathname,
  questionMediaRules,
} from "./questionMedia";
import { questionTemplates } from "./templates/questionTemplates";
import type {
  QuestionMediaOperation,
  QuestionMediaType,
  QuestionSaveIntent,
  QuestionValidationTarget,
  ReviewReasonCode,
  SaveQuestionPayload,
  SaveQuestionResult,
} from "./types";

class DraftValidationError extends Error {
  constructor(
    message: string,
    readonly validationTarget?: QuestionValidationTarget,
  ) {
    super(message);
  }
}

type NormalizedAnswer = {
  clientId: string;
  answerId?: number;
  answerFieldId?: number;
  solutionId?: number;
  fieldGroupId?: string;
  fieldLabel?: string;
  isRequired?: boolean;
  text: string;
  isCorrect: boolean;
  additionalInfo: string;
  media: NormalizedMediaDraft;
};

type NormalizedDraft = {
  questionText: string;
  questionMedia: NormalizedMediaDraft;
  answers: NormalizedAnswer[];
  categoryIds: number[];
  sourceOrRemark: string;
  moderationNotes: string;
  validUntil: Date | null;
  reviewFeedback: string | null;
};

type NormalizedMediaDraft = {
  existingMediaId: number | null;
  url: string | null;
  mediaType: QuestionMediaType | null;
  fileName?: string;
  mimeType?: string;
  operation: QuestionMediaOperation;
} | null;

type SavedAnswerState = {
  clientId: string;
  answerId?: number;
  answerFieldId?: number;
  solutionId?: number;
  media: ReturnType<typeof createAnswerMediaDraftFromStoredMedia>;
};

const reviewReasonLabels: Record<ReviewReasonCode, string> = {
  SOURCE: "Quelle ergänzen",
  QUESTION_TEXT: "Fragetext überarbeiten",
  ANSWER: "Antwort oder Lösung prüfen",
  CATEGORIES: "Kategorien korrigieren",
  MEDIA: "Medien ergänzen oder ersetzen",
  ADDITIONAL_INFO: "Zusatzinformationen ergänzen",
  OTHER: "Sonstiges",
};

function normalizeReviewFeedback(payload: SaveQuestionPayload): string | null {
  if (payload.intent !== "REQUEST_CHANGES") {
    return null;
  }

  const reasonCodes = payload.reviewReasonCodes;
  const comment = payload.reviewComment?.trim() ?? "";

  if (
    !Array.isArray(reasonCodes) ||
    !reasonCodes.every(
      (reason): reason is ReviewReasonCode =>
        typeof reason === "string" && reason in reviewReasonLabels,
    )
  ) {
    throw new DraftValidationError("Die Rückgabegründe sind ungültig.");
  }

  const uniqueReasons = [...new Set(reasonCodes)];

  if (uniqueReasons.length === 0 && !comment) {
    throw new DraftValidationError(
      "Wähle mindestens einen Rückgabegrund oder ergänze einen Freitext.",
    );
  }

  if (uniqueReasons.includes("OTHER") && !comment) {
    throw new DraftValidationError(
      "Ergänze bei „Sonstiges“ einen Rückgabehinweis.",
    );
  }

  const feedback = [
    ...uniqueReasons.map((reason) => reviewReasonLabels[reason]),
    comment,
  ]
    .filter(Boolean)
    .join(" · ");

  if (feedback.length > 1000) {
    throw new DraftValidationError(
      "Der Rückgabehinweis darf höchstens 1.000 Zeichen lang sein.",
    );
  }

  return feedback;
}

function parseValidUntil(
  value: string | null,
  requireCompleteDate: boolean,
): Date | null {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    if (requireCompleteDate && value !== null) {
      throw new DraftValidationError(
        "Wähle ein vollständiges Gültigkeitsdatum aus.",
        "validUntil",
      );
    }

    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new DraftValidationError(
      "Das Gültigkeitsdatum ist nicht vollständig oder ungültig.",
      "validUntil",
    );
  }

  const date = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalizedValue
  ) {
    throw new DraftValidationError(
      "Das Gültigkeitsdatum ist ungültig.",
      "validUntil",
    );
  }

  return date;
}

function normalizeQuestionMedia(
  value: SaveQuestionPayload["questionMedia"],
  validationTarget: QuestionValidationTarget = "questionMedia",
): NormalizedMediaDraft {
  if (value === null) {
    return null;
  }

  if (
    !value ||
    typeof value !== "object" ||
    (value.existingMediaId !== null &&
      (!Number.isInteger(value.existingMediaId) ||
        value.existingMediaId <= 0)) ||
    (value.url !== null && typeof value.url !== "string") ||
    (value.mediaType !== null &&
      value.mediaType !== "IMAGE" &&
      value.mediaType !== "AUDIO") ||
    (value.fileName !== undefined && typeof value.fileName !== "string") ||
    (value.mimeType !== undefined && typeof value.mimeType !== "string") ||
    (value.operation !== "UNCHANGED" &&
      value.operation !== "NEW" &&
      value.operation !== "REMOVE")
  ) {
    throw new DraftValidationError(
      "Die Mediendaten sind ungültig.",
      validationTarget,
    );
  }

  const url = value.url?.trim() || null;
  const fileName = value.fileName?.trim() || undefined;
  const mimeType = value.mimeType?.trim().toLowerCase() || undefined;

  if (url && url.length > 2048) {
    throw new DraftValidationError(
      "Die Medien-URL ist zu lang.",
      validationTarget,
    );
  }

  if ((fileName?.length ?? 0) > 255 || (mimeType?.length ?? 0) > 100) {
    throw new DraftValidationError(
      "Die Metadaten des Mediums sind ungültig.",
      validationTarget,
    );
  }

  if (value.operation === "NEW" && (!url || !value.mediaType)) {
    throw new DraftValidationError(
      "Das neue Medium wurde nicht vollständig hochgeladen.",
      validationTarget,
    );
  }

  return {
    existingMediaId: value.existingMediaId,
    url,
    mediaType: value.mediaType,
    fileName,
    mimeType,
    operation: value.operation,
  };
}

async function verifyUploadedQuestionMedia(
  media: Exclude<NormalizedMediaDraft, null>,
  target: "QUESTION" | "ANSWER" = "QUESTION",
  validationTarget: QuestionValidationTarget = "questionMedia",
) {
  if (media.operation !== "NEW" || !media.url || !media.mediaType) {
    return media;
  }

  let url: URL;

  try {
    url = new URL(media.url);
  } catch {
    throw new DraftValidationError(
      "Die hochgeladene Datei besitzt keine gültige URL.",
      validationTarget,
    );
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".public.blob.vercel-storage.com")
  ) {
    throw new DraftValidationError(
      "Die Datei stammt nicht aus dem vorgesehenen Medienspeicher.",
      validationTarget,
    );
  }

  try {
    const uploadConfig = getMediaUploadServerConfig();
    const metadata = await head(media.url, uploadConfig.blobAuthentication);
    const rule = questionMediaRules[media.mediaType];

    if (
      !isAllowedQuestionMediaPathname(
        metadata.pathname,
        media.mediaType,
        target,
        uploadConfig.pathnamePrefix,
      )
    ) {
      throw new DraftValidationError(
        "Dateipfad oder Dateiendung des Mediums ist ungültig.",
        validationTarget,
      );
    }

    if (!rule.mimeTypes.includes(metadata.contentType.toLowerCase())) {
      throw new DraftValidationError(
        "Der tatsächliche Dateityp des Mediums wird nicht unterstützt.",
        validationTarget,
      );
    }

    if (metadata.size > rule.maximumSizeInBytes) {
      throw new DraftValidationError(
        `Das Medium darf höchstens ${rule.sizeLabel} groß sein.`,
        validationTarget,
      );
    }

    return {
      ...media,
      url: metadata.url,
      fileName: media.fileName ?? getQuestionMediaFileName(metadata.pathname),
      mimeType: metadata.contentType.toLowerCase(),
    };
  } catch (error) {
    if (error instanceof DraftValidationError) {
      throw error;
    }

    logMediaUploadFailure("blob-verification", error, { target });
    throw new DraftValidationError(
      "Die hochgeladene Datei konnte nicht verifiziert werden.",
      validationTarget,
    );
  }
}

function validateQuestion(payload: SaveQuestionPayload): NormalizedDraft {
  if (!payload || typeof payload !== "object") {
    throw new DraftValidationError("Die Entwurfsdaten sind ungültig.");
  }

  if (
    payload.intent !== "DRAFT" &&
    payload.intent !== "SUBMIT_FOR_REVIEW" &&
    payload.intent !== "APPROVE" &&
    payload.intent !== "REQUEST_CHANGES"
  ) {
    throw new DraftValidationError("Die Speicheraktion ist ungültig.");
  }

  const requiresCompleteQuestion =
    payload.intent === "SUBMIT_FOR_REVIEW" || payload.intent === "APPROVE";

  if (
    (payload.questionId !== undefined &&
      (!Number.isInteger(payload.questionId) || payload.questionId <= 0)) ||
    typeof payload.questionText !== "string" ||
    typeof payload.sourceOrRemark !== "string" ||
    typeof payload.moderationNotes !== "string" ||
    !Array.isArray(payload.answers) ||
    !Array.isArray(payload.categoryIds) ||
    (payload.validUntil !== null && typeof payload.validUntil !== "string") ||
    (payload.templateId !== null && typeof payload.templateId !== "string")
  ) {
    throw new DraftValidationError("Die Entwurfsdaten sind unvollständig.");
  }

  if (payload.questionText.length > 300) {
    throw new DraftValidationError(
      "Der Fragetext darf höchstens 300 Zeichen lang sein.",
      "questionText",
    );
  }

  if (payload.sourceOrRemark.length > 1000) {
    throw new DraftValidationError(
      "Quelle oder Bemerkung darf höchstens 1.000 Zeichen lang sein.",
    );
  }

  if (payload.moderationNotes.length > 1000) {
    throw new DraftValidationError(
      "Moderationsnotizen dürfen höchstens 1.000 Zeichen lang sein.",
    );
  }

  const answers = payload.answers.map((answer) => {
    if (
      !answer ||
      typeof answer !== "object" ||
      typeof answer.clientId !== "string" ||
      !answer.clientId.trim() ||
      answer.clientId.length > 100 ||
      typeof answer.text !== "string" ||
      typeof answer.isCorrect !== "boolean" ||
      typeof answer.additionalInfo !== "string" ||
      (answer.fieldLabel !== undefined &&
        typeof answer.fieldLabel !== "string") ||
      (answer.fieldGroupId !== undefined &&
        typeof answer.fieldGroupId !== "string") ||
      (answer.isRequired !== undefined &&
        typeof answer.isRequired !== "boolean") ||
      (answer.answerId !== undefined &&
        (!Number.isInteger(answer.answerId) || answer.answerId <= 0)) ||
      (answer.answerFieldId !== undefined &&
        (!Number.isInteger(answer.answerFieldId) || answer.answerFieldId <= 0)) ||
      (answer.solutionId !== undefined &&
        (!Number.isInteger(answer.solutionId) || answer.solutionId <= 0))
    ) {
      throw new DraftValidationError("Mindestens eine Antwort ist ungültig.");
    }

    if (answer.text.length > 200) {
      throw new DraftValidationError(
        "Antworttexte dürfen höchstens 200 Zeichen lang sein.",
        "answers",
      );
    }

    if (answer.additionalInfo.length > 500) {
      throw new DraftValidationError(
        "Zusatzinformationen dürfen höchstens 500 Zeichen lang sein.",
        "answers",
      );
    }

    const media = normalizeQuestionMedia(answer.media, "answers");

    if (media?.operation === "NEW" && media.mediaType !== "IMAGE") {
      throw new DraftValidationError(
        "Für Antworten sind nur Bilder erlaubt.",
        "answers",
      );
    }

    const fieldLabel = answer.fieldLabel?.trim() || undefined;

    if (
      (fieldLabel && answer.answerId !== undefined) ||
      (!fieldLabel &&
        (answer.answerFieldId !== undefined || answer.solutionId !== undefined))
    ) {
      throw new DraftValidationError(
        "Die Antwortzuordnung ist technisch inkonsistent.",
        "answers",
      );
    }

    return {
      clientId: answer.clientId.trim(),
      answerId: answer.answerId,
      answerFieldId: answer.answerFieldId,
      solutionId: answer.solutionId,
      fieldGroupId: answer.fieldGroupId?.trim() || undefined,
      fieldLabel,
      isRequired: answer.isRequired,
      text: answer.text.trim(),
      isCorrect: answer.isCorrect,
      additionalInfo: answer.additionalInfo.trim(),
      media,
    };
  });

  if (new Set(answers.map((answer) => answer.clientId)).size !== answers.length) {
    throw new DraftValidationError(
      "Die Antwort-IDs sind technisch inkonsistent.",
      "answers",
    );
  }
  const fieldsByGroup = new Map<
    string,
    {
      label: string;
      isRequired: boolean;
      answerFieldId?: number;
      mediaSignature: string;
    }
  >();

  for (const answer of answers) {
    if (!answer.fieldGroupId || !answer.fieldLabel) {
      continue;
    }

    const existingField = fieldsByGroup.get(answer.fieldGroupId);
    const isRequired = answer.isRequired !== false;
    const mediaSignature = JSON.stringify(answer.media);

    if (
      existingField &&
      (existingField.label !== answer.fieldLabel ||
        existingField.isRequired !== isRequired ||
        existingField.answerFieldId !== answer.answerFieldId ||
        existingField.mediaSignature !== mediaSignature)
    ) {
      throw new DraftValidationError(
        "Beschriftete Antwortdaten sind technisch inkonsistent.",
        "answers",
      );
    }

    fieldsByGroup.set(answer.fieldGroupId, {
      label: answer.fieldLabel,
      isRequired,
      answerFieldId: answer.answerFieldId,
      mediaSignature,
    });
  }

  const questionText = payload.questionText.trim();

  if (!questionText && !answers.some((answer) => answer.text)) {
    throw new DraftValidationError(
      "Gib mindestens einen Fragetext oder eine Antwort ein.",
      "questionText",
    );
  }

  if (requiresCompleteQuestion && !questionText) {
    throw new DraftValidationError(
      "Gib einen Fragetext ein.",
      "questionText",
    );
  }

  if (
    requiresCompleteQuestion &&
    !answers.some((answer) => answer.text && answer.isCorrect)
  ) {
    throw new DraftValidationError(
      "Markiere mindestens eine ausgefüllte Antwort als richtig.",
      "answers",
    );
  }

  if (
    requiresCompleteQuestion &&
    answers.some(
      (answer) =>
        answer.fieldLabel && answer.isRequired !== false && !answer.text,
    )
  ) {
    throw new DraftValidationError(
      "Fülle alle beschrifteten Antwortfelder aus.",
      "answers",
    );
  }

  if (
    requiresCompleteQuestion &&
    answers.some(
      (answer) =>
        !answer.fieldLabel && !answer.text && answer.additionalInfo,
    )
  ) {
    throw new DraftValidationError(
      "Ergänze den Antworttext zur vorhandenen Zusatzinformation.",
      "answers",
    );
  }

  if (
    !payload.categoryIds.every(
      (categoryId) => Number.isInteger(categoryId) && categoryId > 0,
    )
  ) {
    throw new DraftValidationError(
      "Die Kategorieauswahl ist ungültig.",
      "categories",
    );
  }

  return {
    questionText,
    questionMedia: normalizeQuestionMedia(payload.questionMedia),
    answers,
    categoryIds: [...new Set(payload.categoryIds)],
    sourceOrRemark: payload.sourceOrRemark.trim(),
    moderationNotes: payload.moderationNotes.trim(),
    validUntil: parseValidUntil(
      payload.validUntil,
      requiresCompleteQuestion,
    ),
    reviewFeedback: normalizeReviewFeedback(payload),
  };
}

function canPerformSaveIntent(
  intent: QuestionSaveIntent,
  session: Awaited<ReturnType<typeof requireQuestionEditor>>,
): boolean {
  if (intent === "DRAFT") {
    return canCreateQuestions(session);
  }

  if (intent === "SUBMIT_FOR_REVIEW") {
    return canSubmitForReview(session);
  }

  if (intent === "REQUEST_CHANGES") {
    return canReviewQuestions(session);
  }

  return canReviewQuestions(session);
}

export async function saveQuestion(
  payload: SaveQuestionPayload,
): Promise<SaveQuestionResult> {
  const session = await requireQuestionEditor();

  if (
    !payload ||
    (payload.intent !== "DRAFT" &&
      payload.intent !== "SUBMIT_FOR_REVIEW" &&
      payload.intent !== "APPROVE" &&
      payload.intent !== "REQUEST_CHANGES")
  ) {
    return { success: false, message: "Die Speicheraktion ist ungültig." };
  }

  if (!canPerformSaveIntent(payload.intent, session)) {
    return {
      success: false,
      message: "Du bist für diese Speicheraktion nicht berechtigt.",
    };
  }

  if (
    payload.intent === "REQUEST_CHANGES" &&
    payload.questionId === undefined
  ) {
    return {
      success: false,
      message: "Nur eine bestehende Frage kann zurückgegeben werden.",
    };
  }

  let draft: NormalizedDraft;

  try {
    draft = validateQuestion(payload);
    if (draft.questionMedia) {
      draft.questionMedia = await verifyUploadedQuestionMedia(
        draft.questionMedia,
      );
    }
    for (const answer of draft.answers) {
      if (answer.media) {
        answer.media = await verifyUploadedQuestionMedia(
          answer.media,
          "ANSWER",
          "answers",
        );
      }
    }
  } catch (error) {
    if (error instanceof DraftValidationError) {
      return {
        success: false,
        message: error.message,
        validationTarget: error.validationTarget,
      };
    }

    console.error("Entwurfsdaten konnten nicht validiert werden", error);

    return {
      success: false,
      message: "Der Entwurf konnte nicht geprüft werden.",
    };
  }

  const requiresCompleteQuestion =
    payload.intent === "SUBMIT_FOR_REVIEW" || payload.intent === "APPROVE";
  const selectedTemplate = questionTemplates.find(
    (template) => template.id === payload.templateId,
  );
  const requiredMediaSlot = selectedTemplate?.questionMediaSlot?.required
    ? selectedTemplate.questionMediaSlot
    : null;
  const classicAnswers = draft.answers.filter(
    (answer) =>
      !answer.fieldLabel &&
      (answer.text || (!requiresCompleteQuestion && answer.additionalInfo)),
  );
  const labeledAnswerGroups = Array.from(
    draft.answers.reduce(
      (groups, answer, index) => {
        if (!answer.fieldLabel) {
          return groups;
        }

        const groupId = answer.fieldGroupId ?? `single-field-${index}`;
        const existingGroup = groups.get(groupId);

        if (existingGroup) {
          existingGroup.solutions.push(answer);
        } else {
          groups.set(groupId, {
            answerFieldId: answer.answerFieldId,
            label: answer.fieldLabel,
            isRequired: answer.isRequired !== false,
            sortOrder: index + 1,
            media: answer.media,
            solutions: [answer],
          });
        }

        return groups;
      },
      new Map<
        string,
        {
          answerFieldId?: number;
          label: string;
          isRequired: boolean;
          sortOrder: number;
          media: NormalizedMediaDraft;
          solutions: NormalizedAnswer[];
        }
      >(),
    ).values(),
  );

  try {
    const userId = getCurrentUserId(session);
    const question = await prisma.$transaction(async (tx) => {
      const existingCategoryCount = await tx.fragenkategorie.count({
        where: {
          fragenkategorie_id: {
            in: draft.categoryIds,
          },
        },
      });

      if (existingCategoryCount !== draft.categoryIds.length) {
        throw new DraftValidationError(
          "Mindestens eine ausgewählte Kategorie existiert nicht mehr.",
          "categories",
        );
      }

      const standardAnswerType = classicAnswers.length
        ? await tx.antworttyp.findFirst({
            where: {
              antworttyp: {
                equals: "Standard",
                mode: "insensitive",
              },
            },
            select: {
              antworttyp_id: true,
            },
          })
        : null;

      if (classicAnswers.length && !standardAnswerType) {
        throw new DraftValidationError(
          "Der Standard-Antworttyp ist nicht konfiguriert.",
        );
      }

      const requestedMediaTypeName =
        draft.questionMedia?.mediaType === "IMAGE" ? "Bild" : "Audio";
      const matchingMediaTypes =
        draft.questionMedia?.operation === "NEW" &&
        draft.questionMedia.mediaType
          ? await tx.medientyp.findMany({
              where: {
                medientyp: {
                  equals: requestedMediaTypeName,
                  mode: "insensitive",
                },
              },
              select: { medientyp_id: true, medientyp: true },
            })
          : [];

      if (
        draft.questionMedia?.operation === "NEW" &&
        matchingMediaTypes.length !== 1
      ) {
        throw new DraftValidationError(
          "Der Medientyp ist nicht eindeutig konfiguriert.",
          "questionMedia",
        );
      }

      const requestedMediaTypeId =
        matchingMediaTypes[0]?.medientyp_id ?? null;
      const hasNewAnswerImage = draft.answers.some(
        (answer) => answer.media?.operation === "NEW",
      );
      const matchingAnswerImageTypes = hasNewAnswerImage
        ? await tx.medientyp.findMany({
            where: {
              medientyp: {
                equals: "Bild",
                mode: "insensitive",
              },
            },
            select: { medientyp_id: true },
          })
        : [];

      if (hasNewAnswerImage && matchingAnswerImageTypes.length !== 1) {
        throw new DraftValidationError(
          "Der Medientyp Bild ist nicht eindeutig konfiguriert.",
          "answers",
        );
      }

      const answerImageTypeId =
        matchingAnswerImageTypes[0]?.medientyp_id ?? null;

      const categoryCreates = draft.categoryIds.map((categoryId) => ({
        fragenkategorie: {
          connect: {
            fragenkategorie_id: categoryId,
          },
        },
      }));
      const storedMediaSelect = {
        medien_id: true,
        datei: true,
        medientyp: { select: { medientyp: true } },
      } as const;

      async function createClassicAnswer(
        questionId: number,
        answer: NormalizedAnswer,
      ) {
        if (
          answer.answerId !== undefined ||
          answer.media?.operation === "UNCHANGED" ||
          answer.media?.existingMediaId
        ) {
          throw new DraftValidationError(
            "Eine neue Antwort verweist auf nicht zugehörige gespeicherte Daten.",
            "answers",
          );
        }

        const created = await tx.antworten.create({
          data: {
            fragen_id: questionId,
            antwort: answer.text,
            ist_richtig: answer.isCorrect,
            zusatzinformation: answer.additionalInfo || null,
            antworttyp_id: standardAnswerType!.antworttyp_id,
          },
          select: { antwort_id: true },
        });

        if (
          answer.media?.operation === "NEW" &&
          answer.media.url &&
          answerImageTypeId
        ) {
          await tx.medien.create({
            data: {
              fragen_id: null,
              antwort_id: created.antwort_id,
              medientyp_id: answerImageTypeId,
              datei: answer.media.url,
              sortierung: 1,
            },
          });
        }

        const storedMedia = await tx.medien.findMany({
          where: { antwort_id: created.antwort_id },
          orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
          select: storedMediaSelect,
        });

        return {
          clientId: answer.clientId,
          answerId: created.antwort_id,
          media: createAnswerMediaDraftFromStoredMedia(storedMedia),
        };
      }

      async function createLabeledAnswerGroup(
        questionId: number,
        group: (typeof labeledAnswerGroups)[number],
      ) {
        if (
          group.answerFieldId !== undefined ||
          group.solutions.some((solution) => solution.solutionId !== undefined) ||
          group.media?.operation === "UNCHANGED" ||
          group.media?.existingMediaId
        ) {
          throw new DraftValidationError(
            "Ein neues Antwortfeld verweist auf nicht zugehörige gespeicherte Daten.",
            "answers",
          );
        }

        const createdField = await tx.frage_antwortfelder.create({
          data: {
            fragen_id: questionId,
            label: group.label,
            sortierung: group.sortOrder,
            ist_pflicht: group.isRequired,
          },
          select: { antwortfeld_id: true },
        });

        if (
          group.media?.operation === "NEW" &&
          group.media.url &&
          answerImageTypeId
        ) {
          await tx.medien.create({
            data: {
              fragen_id: null,
              antwortfeld_id: createdField.antwortfeld_id,
              medientyp_id: answerImageTypeId,
              datei: group.media.url,
              sortierung: 1,
            },
          });
        }

        const storedMedia = await tx.medien.findMany({
          where: { antwortfeld_id: createdField.antwortfeld_id },
          orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
          select: storedMediaSelect,
        });
        const savedMedia = createAnswerMediaDraftFromStoredMedia(storedMedia);
        const answerStates: Array<{
          clientId: string;
          answerFieldId: number;
          solutionId?: number;
          media: ReturnType<typeof createAnswerMediaDraftFromStoredMedia>;
        }> = [];
        let solutionSortOrder = 0;

        for (const solution of group.solutions) {
          if (!solution.text && !solution.additionalInfo) {
            answerStates.push({
              clientId: solution.clientId,
              answerFieldId: createdField.antwortfeld_id,
              media: savedMedia,
            });
            continue;
          }

          solutionSortOrder += 1;
          const createdSolution = await tx.frage_antwortfeld_loesungen.create({
            data: {
              antwortfeld_id: createdField.antwortfeld_id,
              loesung_text: solution.text,
              sortierung: solutionSortOrder,
              ist_akzeptiert: solution.isCorrect,
              zusatzinformation: solution.additionalInfo || null,
            },
            select: { loesung_id: true },
          });
          answerStates.push({
            clientId: solution.clientId,
            answerFieldId: createdField.antwortfeld_id,
            solutionId: createdSolution.loesung_id,
            media: savedMedia,
          });
        }

        return answerStates;
      }

      if (payload.questionId === undefined) {
        if (draft.questionMedia?.operation === "UNCHANGED") {
          throw new DraftValidationError(
            "Ein vorhandenes Medium kann keiner neuen Frage zugeordnet werden.",
            "questionMedia",
          );
        }

        if (
          requiresCompleteQuestion &&
          requiredMediaSlot &&
          (draft.questionMedia?.operation !== "NEW" ||
            draft.questionMedia.mediaType !==
              requiredMediaSlot.allowedMediaType)
        ) {
          throw new DraftValidationError(
            `Für diese Spezialfrage ist ${requiredMediaSlot.label} erforderlich.`,
            "questionMedia",
          );
        }

        const approval = resolveQuestionApprovalOnCreate(
          session,
          payload.intent === "APPROVE",
        );

        const createdQuestion = await tx.fragen.create({
          data: {
            frage: draft.questionText,
            quelle: draft.sourceOrRemark || null,
            ist_archiviert: false,
            ist_unfertig: payload.intent === "DRAFT",
            moderationsnotizen: draft.moderationNotes || null,
            gueltig_bis: draft.validUntil,
            freigegeben: approval.freigegeben,
            approved_by_user_id: approval.approved_by_user_id,
            approved_at: approval.approved_at,
            review_status:
              payload.intent === "DRAFT"
                ? "DRAFT"
                : payload.intent === "SUBMIT_FOR_REVIEW"
                  ? "IN_REVIEW"
                  : "APPROVED",
            submitted_at:
              payload.intent === "SUBMIT_FOR_REVIEW" ? new Date() : null,
            submitted_by_user_id:
              payload.intent === "SUBMIT_FOR_REVIEW" ? userId : null,
            review_feedback: null,
            reviewed_at:
              payload.intent === "APPROVE" ? approval.approved_at : null,
            reviewed_by_user_id:
              payload.intent === "APPROVE" ? userId : null,
            created_by_user_id: userId,
            last_modified_by_user_id: userId,
            fragen_kategorien: { create: categoryCreates },
          },
          select: {
            fragen_id: true,
          },
        });

        if (
          draft.questionMedia?.operation === "NEW" &&
          draft.questionMedia.url &&
          requestedMediaTypeId
        ) {
          await tx.medien.create({
            data: {
              fragen_id: createdQuestion.fragen_id,
              medientyp_id: requestedMediaTypeId,
              datei: draft.questionMedia.url,
              sortierung: 1,
            },
          });
        }

        const answerStates: SavedAnswerState[] = [];

        for (const answer of classicAnswers) {
          answerStates.push(
            await createClassicAnswer(createdQuestion.fragen_id, answer),
          );
        }
        for (const group of labeledAnswerGroups) {
          answerStates.push(
            ...(await createLabeledAnswerGroup(
              createdQuestion.fragen_id,
              group,
            )),
          );
        }
        for (const answer of draft.answers) {
          if (!answerStates.some((state) => state.clientId === answer.clientId)) {
            answerStates.push({ clientId: answer.clientId, media: null });
          }
        }

        const storedMedia = await tx.medien.findMany({
          where: { fragen_id: createdQuestion.fragen_id },
          orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
          select: {
            medien_id: true,
            datei: true,
            medientyp: { select: { medientyp: true } },
          },
        });

        return {
          fragen_id: createdQuestion.fragen_id,
          questionMedia:
            createQuestionMediaDraftFromStoredMedia(storedMedia),
          answers: answerStates,
        };
      }

      const existingQuestion = await tx.fragen.findUnique({
        where: { fragen_id: payload.questionId },
        select: {
          created_by_user_id: true,
          freigegeben: true,
          review_status: true,
          ist_archiviert: true,
          medien: {
            orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
            select: {
              medien_id: true,
              datei: true,
              medientyp: { select: { medientyp: true } },
            },
          },
          antworten: {
            orderBy: { antwort_id: "asc" },
            select: {
              antwort_id: true,
              antwort: true,
              ist_richtig: true,
              zusatzinformation: true,
              medien: {
                orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
                select: storedMediaSelect,
              },
              team_antworten: {
                select: { team_antwort_id: true },
                take: 1,
              },
            },
          },
          antwortfelder: {
            orderBy: [{ sortierung: "asc" }, { antwortfeld_id: "asc" }],
            select: {
              antwortfeld_id: true,
              label: true,
              ist_pflicht: true,
              medien: {
                orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
                select: storedMediaSelect,
              },
              team_antworten: {
                select: { team_antwortfeld_id: true },
                take: 1,
              },
              loesungen: {
                orderBy: [{ sortierung: "asc" }, { loesung_id: "asc" }],
                select: {
                  loesung_id: true,
                  loesung_text: true,
                  ist_akzeptiert: true,
                  zusatzinformation: true,
                },
              },
            },
          },
        },
      });

      if (!existingQuestion) {
        throw new DraftValidationError(
          "Die gespeicherte Frage existiert nicht mehr.",
        );
      }

      const questionAccess = {
        createdByUserId: existingQuestion.created_by_user_id,
        reviewStatus: existingQuestion.review_status,
        isArchived: existingQuestion.ist_archiviert,
      };
      const mayPerformUpdate =
        payload.intent === "APPROVE"
          ? canApproveQuestion(session, existingQuestion.review_status)
          : payload.intent === "REQUEST_CHANGES"
            ? canRequestQuestionChanges(
                session,
                existingQuestion.review_status,
              )
            : canEditQuestion(session, questionAccess) &&
              (payload.intent !== "SUBMIT_FOR_REVIEW" ||
                canSubmitForReview(session));

      if (!mayPerformUpdate) {
        throw new DraftValidationError(
          "Du darfst diese Aktion für diese Frage nicht ausführen.",
        );
      }

      const mediaOperation = draft.questionMedia?.operation ?? "UNCHANGED";
      const existingQuestionMedia = existingQuestion.medien;

      if (
        existingQuestionMedia.length > 1 &&
        mediaOperation !== "UNCHANGED"
      ) {
        throw new DraftValidationError(
          "Diese Frage besitzt mehrere Fragenmedien. Sie können im MVP nicht ersetzt oder entfernt werden.",
          "questionMedia",
        );
      }

      if (
        draft.questionMedia?.existingMediaId &&
        !existingQuestionMedia.some(
          (medium) =>
            medium.medien_id === draft.questionMedia?.existingMediaId,
        )
      ) {
        throw new DraftValidationError(
          "Das vorhandene Medium gehört nicht mehr zu dieser Frage.",
          "questionMedia",
        );
      }

      const effectiveMediaType =
        mediaOperation === "NEW"
          ? draft.questionMedia?.mediaType ?? null
          : mediaOperation === "REMOVE" || existingQuestionMedia.length !== 1
            ? null
            : getQuestionMediaTypeFromName(
                existingQuestionMedia[0].medientyp.medientyp,
              );

      if (
        requiresCompleteQuestion &&
        requiredMediaSlot &&
        effectiveMediaType !== requiredMediaSlot.allowedMediaType
      ) {
        throw new DraftValidationError(
          `Für diese Spezialfrage ist ${requiredMediaSlot.label} erforderlich.`,
          "questionMedia",
        );
      }

      const existingClassicAnswersById = new Map(
        existingQuestion.antworten.map((answer) => [answer.antwort_id, answer]),
      );
      const requestedClassicAnswerIds = new Set<number>();

      for (const answer of classicAnswers) {
        if (answer.answerId === undefined) {
          continue;
        }

        if (
          requestedClassicAnswerIds.has(answer.answerId) ||
          !existingClassicAnswersById.has(answer.answerId)
        ) {
          throw new DraftValidationError(
            "Eine klassische Antwort gehört nicht zu dieser Frage.",
            "answers",
          );
        }
        const existingAnswer = existingClassicAnswersById.get(answer.answerId)!;
        if (
          existingAnswer.team_antworten.length > 0 &&
          (existingAnswer.antwort !== answer.text ||
            existingAnswer.ist_richtig !== answer.isCorrect ||
            (existingAnswer.zusatzinformation ?? "") !== answer.additionalInfo)
        ) {
          throw new DraftValidationError(
            "Eine bereits im Quiz beantwortete Antwort kann inhaltlich nicht verändert werden.",
            "answers",
          );
        }
        requestedClassicAnswerIds.add(answer.answerId);
      }

      for (const existingAnswer of existingQuestion.antworten) {
        if (requestedClassicAnswerIds.has(existingAnswer.antwort_id)) {
          continue;
        }

        if (existingAnswer.team_antworten.length > 0) {
          throw new DraftValidationError(
            "Eine bereits im Quiz beantwortete Antwort kann nicht entfernt werden.",
            "answers",
          );
        }
        if (existingAnswer.medien.length > 1) {
          throw new DraftValidationError(
            "Eine Antwort mit mehreren Medien kann im MVP nicht entfernt werden.",
            "answers",
          );
        }
      }

      const existingFieldsById = new Map(
        existingQuestion.antwortfelder.map((field) => [
          field.antwortfeld_id,
          field,
        ]),
      );
      const requestedFieldIds = new Set<number>();

      for (const group of labeledAnswerGroups) {
        if (group.answerFieldId === undefined) {
          if (group.solutions.some((solution) => solution.solutionId !== undefined)) {
            throw new DraftValidationError(
              "Eine neue Lösung verweist auf ein nicht gespeichertes Antwortfeld.",
              "answers",
            );
          }
          continue;
        }

        const existingField = existingFieldsById.get(group.answerFieldId);

        if (requestedFieldIds.has(group.answerFieldId) || !existingField) {
          throw new DraftValidationError(
            "Ein beschriftetes Antwortfeld gehört nicht zu dieser Frage.",
            "answers",
          );
        }
        requestedFieldIds.add(group.answerFieldId);

        const requestedSolutions = group.solutions
          .filter((solution) => solution.text || solution.additionalInfo)
          .map((solution) => ({
            text: solution.text,
            isCorrect: solution.isCorrect,
            additionalInfo: solution.additionalInfo,
          }));
        const storedSolutions = existingField.loesungen.map((solution) => ({
          text: solution.loesung_text,
          isCorrect: solution.ist_akzeptiert,
          additionalInfo: solution.zusatzinformation ?? "",
        }));

        if (
          existingField.team_antworten.length > 0 &&
          (existingField.label !== group.label ||
            existingField.ist_pflicht !== group.isRequired ||
            JSON.stringify(storedSolutions) !==
              JSON.stringify(requestedSolutions))
        ) {
          throw new DraftValidationError(
            "Ein bereits im Quiz beantwortetes Antwortfeld kann inhaltlich nicht verändert werden.",
            "answers",
          );
        }

        const existingSolutionIds = new Set(
          existingField.loesungen.map((solution) => solution.loesung_id),
        );
        const requestedSolutionIds = new Set<number>();

        for (const solution of group.solutions) {
          if (solution.solutionId === undefined) {
            continue;
          }
          if (
            requestedSolutionIds.has(solution.solutionId) ||
            !existingSolutionIds.has(solution.solutionId)
          ) {
            throw new DraftValidationError(
              "Eine Lösung gehört nicht zu diesem Antwortfeld.",
              "answers",
            );
          }
          requestedSolutionIds.add(solution.solutionId);
        }
      }

      for (const existingField of existingQuestion.antwortfelder) {
        if (requestedFieldIds.has(existingField.antwortfeld_id)) {
          continue;
        }

        if (existingField.team_antworten.length > 0) {
          throw new DraftValidationError(
            "Ein bereits im Quiz beantwortetes Antwortfeld kann nicht entfernt werden.",
            "answers",
          );
        }
        if (existingField.medien.length > 1) {
          throw new DraftValidationError(
            "Ein Antwortfeld mit mehreren Medien kann im MVP nicht entfernt werden.",
            "answers",
          );
        }
      }

      async function applyAnswerMediaChange(
        media: NormalizedMediaDraft,
        existingMedia: Array<{
          medien_id: number;
          datei: string;
          medientyp: { medientyp: string };
        }>,
        target:
          | { type: "CLASSIC"; answerId: number }
          | { type: "LABELED_FIELD"; answerFieldId: number },
      ) {
        const operation = media?.operation ?? "UNCHANGED";

        if (existingMedia.length > 1 && operation !== "UNCHANGED") {
          throw new DraftValidationError(
            "Mehrere vorhandene Antwortmedien können im MVP nicht ersetzt oder entfernt werden.",
            "answers",
          );
        }

        if (
          media?.existingMediaId &&
          !existingMedia.some(
            (medium) => medium.medien_id === media.existingMediaId,
          )
        ) {
          throw new DraftValidationError(
            "Das vorhandene Bild gehört nicht mehr zu dieser Antwort.",
            "answers",
          );
        }

        const relationData =
          target.type === "CLASSIC"
            ? {
                fragen_id: null,
                antwort_id: target.answerId,
                antwortfeld_id: null,
              }
            : {
                fragen_id: null,
                antwort_id: null,
                antwortfeld_id: target.answerFieldId,
              };

        if (operation === "NEW" && media?.url && answerImageTypeId) {
          if (existingMedia.length === 1) {
            await tx.medien.update({
              where: { medien_id: existingMedia[0].medien_id },
              data: {
                ...relationData,
                datei: media.url,
                medientyp_id: answerImageTypeId,
                sortierung: 1,
              },
            });
          } else {
            await tx.medien.create({
              data: {
                ...relationData,
                datei: media.url,
                medientyp_id: answerImageTypeId,
                sortierung: 1,
              },
            });
          }
        } else if (operation === "REMOVE" && existingMedia.length === 1) {
          await tx.medien.delete({
            where: { medien_id: existingMedia[0].medien_id },
          });
        }

        const storedMedia = await tx.medien.findMany({
          where:
            target.type === "CLASSIC"
              ? { antwort_id: target.answerId }
              : { antwortfeld_id: target.answerFieldId },
          orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
          select: storedMediaSelect,
        });

        return createAnswerMediaDraftFromStoredMedia(storedMedia);
      }

      const approval =
        payload.intent === "APPROVE"
          ? resolveQuestionApprovalOnUpdate(
              session,
              existingQuestion.freigegeben,
              true,
            )
          : {
              freigegeben: false,
              approved_by_user_id: null,
              approved_at: null,
            };

      const reviewUpdate =
        payload.intent === "DRAFT"
          ? { review_status: "DRAFT" as const }
          : payload.intent === "SUBMIT_FOR_REVIEW"
            ? {
                review_status: "IN_REVIEW" as const,
                submitted_at: new Date(),
                submitted_by_user_id: userId,
                review_feedback: null,
              }
            : payload.intent === "APPROVE"
              ? {
                  review_status: "APPROVED" as const,
                  review_feedback: null,
                  reviewed_at: approval.approved_at,
                  reviewed_by_user_id: userId,
                }
              : {
                  review_status: "CHANGES_REQUESTED" as const,
                  review_feedback: draft.reviewFeedback,
                  reviewed_at: new Date(),
                  reviewed_by_user_id: userId,
                };

      await tx.fragen_kategorien.deleteMany({
        where: { fragen_id: payload.questionId },
      });

      if (
        mediaOperation === "NEW" &&
        draft.questionMedia?.url &&
        requestedMediaTypeId
      ) {
        if (existingQuestionMedia.length === 1) {
          await tx.medien.update({
            where: { medien_id: existingQuestionMedia[0].medien_id },
            data: {
              datei: draft.questionMedia.url,
              medientyp_id: requestedMediaTypeId,
              sortierung: 1,
            },
          });
        } else {
          await tx.medien.create({
            data: {
              fragen_id: payload.questionId,
              datei: draft.questionMedia.url,
              medientyp_id: requestedMediaTypeId,
              sortierung: 1,
            },
          });
        }
      } else if (
        mediaOperation === "REMOVE" &&
        existingQuestionMedia.length === 1
      ) {
        await tx.medien.delete({
          where: { medien_id: existingQuestionMedia[0].medien_id },
        });
      }

      const updatedQuestion = await tx.fragen.update({
        where: { fragen_id: payload.questionId },
        data: {
          frage: draft.questionText,
          quelle: draft.sourceOrRemark || null,
          ist_unfertig: payload.intent === "DRAFT",
          moderationsnotizen: draft.moderationNotes || null,
          gueltig_bis: draft.validUntil,
          freigegeben: approval.freigegeben,
          approved_by_user_id: approval.approved_by_user_id,
          approved_at: approval.approved_at,
          ...reviewUpdate,
          last_modified_by_user_id: userId,
          fragen_kategorien: { create: categoryCreates },
        },
        select: {
          fragen_id: true,
        },
      });

      const answerStates: SavedAnswerState[] = [];

      for (const answer of classicAnswers) {
        if (answer.answerId === undefined) {
          answerStates.push(
            await createClassicAnswer(payload.questionId, answer),
          );
          continue;
        }

        const existingAnswer = existingClassicAnswersById.get(answer.answerId)!;
        await tx.antworten.update({
          where: { antwort_id: answer.answerId },
          data: {
            antwort: answer.text,
            ist_richtig: answer.isCorrect,
            zusatzinformation: answer.additionalInfo || null,
            antworttyp_id: standardAnswerType!.antworttyp_id,
          },
        });
        const savedMedia = await applyAnswerMediaChange(
          answer.media,
          existingAnswer.medien,
          { type: "CLASSIC", answerId: answer.answerId },
        );
        answerStates.push({
          clientId: answer.clientId,
          answerId: answer.answerId,
          media: savedMedia,
        });
      }

      const classicIdsToDelete = existingQuestion.antworten
        .map((answer) => answer.antwort_id)
        .filter((answerId) => !requestedClassicAnswerIds.has(answerId));
      if (classicIdsToDelete.length > 0) {
        await tx.antworten.deleteMany({
          where: { antwort_id: { in: classicIdsToDelete } },
        });
      }

      for (const group of labeledAnswerGroups) {
        if (group.answerFieldId === undefined) {
          answerStates.push(
            ...(await createLabeledAnswerGroup(payload.questionId, group)),
          );
          continue;
        }

        const existingField = existingFieldsById.get(group.answerFieldId)!;
        await tx.frage_antwortfelder.update({
          where: { antwortfeld_id: group.answerFieldId },
          data: {
            label: group.label,
            sortierung: group.sortOrder,
            ist_pflicht: group.isRequired,
          },
        });
        const savedMedia = await applyAnswerMediaChange(
          group.media,
          existingField.medien,
          { type: "LABELED_FIELD", answerFieldId: group.answerFieldId },
        );
        const solutionIdsToKeep = new Set<number>();
        let solutionSortOrder = 0;

        for (const solution of group.solutions) {
          if (!solution.text && !solution.additionalInfo) {
            answerStates.push({
              clientId: solution.clientId,
              answerFieldId: group.answerFieldId,
              media: savedMedia,
            });
            continue;
          }

          solutionSortOrder += 1;
          let solutionId = solution.solutionId;

          if (solutionId === undefined) {
            const createdSolution =
              await tx.frage_antwortfeld_loesungen.create({
                data: {
                  antwortfeld_id: group.answerFieldId,
                  loesung_text: solution.text,
                  sortierung: solutionSortOrder,
                  ist_akzeptiert: solution.isCorrect,
                  zusatzinformation: solution.additionalInfo || null,
                },
                select: { loesung_id: true },
              });
            solutionId = createdSolution.loesung_id;
          } else {
            await tx.frage_antwortfeld_loesungen.update({
              where: { loesung_id: solutionId },
              data: {
                loesung_text: solution.text,
                sortierung: solutionSortOrder,
                ist_akzeptiert: solution.isCorrect,
                zusatzinformation: solution.additionalInfo || null,
              },
            });
          }

          solutionIdsToKeep.add(solutionId);
          answerStates.push({
            clientId: solution.clientId,
            answerFieldId: group.answerFieldId,
            solutionId,
            media: savedMedia,
          });
        }

        const solutionIdsToDelete = existingField.loesungen
          .map((solution) => solution.loesung_id)
          .filter((solutionId) => !solutionIdsToKeep.has(solutionId));
        if (solutionIdsToDelete.length > 0) {
          await tx.frage_antwortfeld_loesungen.deleteMany({
            where: { loesung_id: { in: solutionIdsToDelete } },
          });
        }
      }

      const fieldIdsToDelete = existingQuestion.antwortfelder
        .map((field) => field.antwortfeld_id)
        .filter((fieldId) => !requestedFieldIds.has(fieldId));
      if (fieldIdsToDelete.length > 0) {
        await tx.frage_antwortfelder.deleteMany({
          where: { antwortfeld_id: { in: fieldIdsToDelete } },
        });
      }
      for (const answer of draft.answers) {
        if (!answerStates.some((state) => state.clientId === answer.clientId)) {
          answerStates.push({ clientId: answer.clientId, media: null });
        }
      }

      const storedMedia = await tx.medien.findMany({
        where: { fragen_id: payload.questionId },
        orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
        select: {
          medien_id: true,
          datei: true,
          medientyp: { select: { medientyp: true } },
        },
      });

      return {
        fragen_id: updatedQuestion.fragen_id,
        questionMedia: createQuestionMediaDraftFromStoredMedia(storedMedia),
        answers: answerStates,
      };
    });

    revalidatePath("/fragen");

    return {
      success: true,
      questionId: question.fragen_id,
      questionMedia: question.questionMedia,
      answers: question.answers,
      message: createSuccessMessage(
        payload.intent,
        question.fragen_id,
        payload.templateId !== null,
        payload.questionId !== undefined,
      ),
    };
  } catch (error) {
    if (error instanceof DraftValidationError) {
      return {
        success: false,
        message: error.message,
        validationTarget: error.validationTarget,
      };
    }

    console.error("Frage konnte nicht gespeichert werden", error);

    return {
      success: false,
      message:
        "Die Frage konnte nicht gespeichert werden. Bitte versuche es erneut.",
    };
  }
}

function createSuccessMessage(
  intent: QuestionSaveIntent,
  questionId: number,
  hasTemplate: boolean,
  wasUpdated: boolean,
): string {
  const message =
    intent === "DRAFT"
      ? wasUpdated
        ? `Entwurf aktualisiert. Fragen-ID: ${questionId}`
        : `Entwurf gespeichert. Fragen-ID: ${questionId}`
      : intent === "SUBMIT_FOR_REVIEW"
        ? wasUpdated
          ? `Frage aktualisiert und zur Prüfung eingereicht. Fragen-ID: ${questionId}`
          : `Frage zur Prüfung eingereicht. Fragen-ID: ${questionId}`
        : intent === "REQUEST_CHANGES"
          ? `Frage zur Überarbeitung zurückgegeben. Fragen-ID: ${questionId}`
          : wasUpdated
            ? `Frage aktualisiert und freigegeben. Fragen-ID: ${questionId}`
            : `Frage gespeichert und freigegeben. Fragen-ID: ${questionId}`;

  return hasTemplate
    ? `${message}. Die Spezialfrage-Herkunft wird noch nicht gespeichert.`
    : message;
}
