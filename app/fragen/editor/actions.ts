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
  getCurrentUserId,
  resolveQuestionApprovalOnCreate,
  resolveQuestionApprovalOnUpdate,
} from "@/app/services/questionService";
import {
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
  fieldGroupId?: string;
  fieldLabel?: string;
  isRequired?: boolean;
  text: string;
  isCorrect: boolean;
  additionalInfo: string;
};

type NormalizedDraft = {
  questionText: string;
  questionMedia: NormalizedQuestionMedia;
  answers: NormalizedAnswer[];
  categoryIds: number[];
  sourceOrRemark: string;
  moderationNotes: string;
  validUntil: Date | null;
  reviewFeedback: string | null;
};

type NormalizedQuestionMedia = {
  existingMediaId: number | null;
  url: string | null;
  mediaType: QuestionMediaType | null;
  fileName?: string;
  mimeType?: string;
  operation: QuestionMediaOperation;
} | null;

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
): NormalizedQuestionMedia {
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
      "questionMedia",
    );
  }

  const url = value.url?.trim() || null;
  const fileName = value.fileName?.trim() || undefined;
  const mimeType = value.mimeType?.trim().toLowerCase() || undefined;

  if (url && url.length > 2048) {
    throw new DraftValidationError(
      "Die Medien-URL ist zu lang.",
      "questionMedia",
    );
  }

  if ((fileName?.length ?? 0) > 255 || (mimeType?.length ?? 0) > 100) {
    throw new DraftValidationError(
      "Die Metadaten des Mediums sind ungültig.",
      "questionMedia",
    );
  }

  if (value.operation === "NEW" && (!url || !value.mediaType)) {
    throw new DraftValidationError(
      "Das neue Medium wurde nicht vollständig hochgeladen.",
      "questionMedia",
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
  media: Exclude<NormalizedQuestionMedia, null>,
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
      "questionMedia",
    );
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".public.blob.vercel-storage.com")
  ) {
    throw new DraftValidationError(
      "Die Datei stammt nicht aus dem vorgesehenen Medienspeicher.",
      "questionMedia",
    );
  }

  try {
    const metadata = await head(media.url);
    const rule = questionMediaRules[media.mediaType];

    if (!isAllowedQuestionMediaPathname(metadata.pathname, media.mediaType)) {
      throw new DraftValidationError(
        "Dateipfad oder Dateiendung des Mediums ist ungültig.",
        "questionMedia",
      );
    }

    if (!rule.mimeTypes.includes(metadata.contentType.toLowerCase())) {
      throw new DraftValidationError(
        "Der tatsächliche Dateityp des Mediums wird nicht unterstützt.",
        "questionMedia",
      );
    }

    if (metadata.size > rule.maximumSizeInBytes) {
      throw new DraftValidationError(
        `Das Medium darf höchstens ${rule.sizeLabel} groß sein.`,
        "questionMedia",
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

    throw new DraftValidationError(
      "Die hochgeladene Datei konnte nicht verifiziert werden.",
      "questionMedia",
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
      typeof answer.text !== "string" ||
      typeof answer.isCorrect !== "boolean" ||
      typeof answer.additionalInfo !== "string" ||
      (answer.fieldLabel !== undefined &&
        typeof answer.fieldLabel !== "string") ||
      (answer.fieldGroupId !== undefined &&
        typeof answer.fieldGroupId !== "string") ||
      (answer.isRequired !== undefined &&
        typeof answer.isRequired !== "boolean")
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

    return {
      fieldGroupId: answer.fieldGroupId?.trim() || undefined,
      fieldLabel: answer.fieldLabel?.trim() || undefined,
      isRequired: answer.isRequired,
      text: answer.text.trim(),
      isCorrect: answer.isCorrect,
      additionalInfo: answer.additionalInfo.trim(),
    };
  });
  const fieldsByGroup = new Map<
    string,
    { label: string; isRequired: boolean }
  >();

  for (const answer of answers) {
    if (!answer.fieldGroupId || !answer.fieldLabel) {
      continue;
    }

    const existingField = fieldsByGroup.get(answer.fieldGroupId);
    const isRequired = answer.isRequired !== false;

    if (
      existingField &&
      (existingField.label !== answer.fieldLabel ||
        existingField.isRequired !== isRequired)
    ) {
      throw new DraftValidationError(
        "Beschriftete Antwortdaten sind technisch inkonsistent.",
        "answers",
      );
    }

    fieldsByGroup.set(answer.fieldGroupId, {
      label: answer.fieldLabel,
      isRequired,
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
            label: answer.fieldLabel,
            isRequired: answer.isRequired !== false,
            sortOrder: index + 1,
            solutions: [answer],
          });
        }

        return groups;
      },
      new Map<
        string,
        {
          label: string;
          isRequired: boolean;
          sortOrder: number;
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

      const categoryCreates = draft.categoryIds.map((categoryId) => ({
        fragenkategorie: {
          connect: {
            fragenkategorie_id: categoryId,
          },
        },
      }));
      const classicAnswerCreates = classicAnswers.map((answer) => ({
        antwort: answer.text,
        ist_richtig: answer.isCorrect,
        zusatzinformation: answer.additionalInfo || null,
        antworttyp_id: standardAnswerType!.antworttyp_id,
      }));
      const labeledAnswerCreates = labeledAnswerGroups.map((group) => ({
        label: group.label,
        sortierung: group.sortOrder,
        ist_pflicht: group.isRequired,
        loesungen: group.solutions.some(
          (answer) => answer.text || answer.additionalInfo,
        )
          ? {
              create: group.solutions
                .filter((answer) => answer.text || answer.additionalInfo)
                .map((answer, solutionIndex) => ({
                  loesung_text: answer.text,
                  sortierung: solutionIndex + 1,
                  ist_akzeptiert: answer.isCorrect,
                  zusatzinformation: answer.additionalInfo || null,
                })),
            }
          : undefined,
      }));

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
            antworten: { create: classicAnswerCreates },
            antwortfelder: { create: labeledAnswerCreates },
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
              antwort: true,
              ist_richtig: true,
              zusatzinformation: true,
              medien: { select: { medien_id: true }, take: 1 },
              team_antworten: {
                select: { team_antwort_id: true },
                take: 1,
              },
            },
          },
          antwortfelder: {
            orderBy: [{ sortierung: "asc" }, { antwortfeld_id: "asc" }],
            select: {
              label: true,
              ist_pflicht: true,
              medien: { select: { medien_id: true }, take: 1 },
              team_antworten: {
                select: { team_antwortfeld_id: true },
                take: 1,
              },
              loesungen: {
                orderBy: [{ sortierung: "asc" }, { loesung_id: "asc" }],
                select: {
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

      const existingAnswerStructure = {
        classic: existingQuestion.antworten.map((answer) => ({
          text: answer.antwort,
          isCorrect: answer.ist_richtig,
          additionalInfo: answer.zusatzinformation ?? "",
        })),
        labeled: existingQuestion.antwortfelder.map((field) => ({
          label: field.label,
          isRequired: field.ist_pflicht,
          solutions: field.loesungen.map((solution) => ({
            text: solution.loesung_text,
            isCorrect: solution.ist_akzeptiert,
            additionalInfo: solution.zusatzinformation ?? "",
          })),
        })),
      };
      const requestedAnswerStructure = {
        classic: classicAnswers.map((answer) => ({
          text: answer.text,
          isCorrect: answer.isCorrect,
          additionalInfo: answer.additionalInfo,
        })),
        labeled: labeledAnswerGroups.map((group) => ({
          label: group.label,
          isRequired: group.isRequired,
          solutions: group.solutions
            .filter((answer) => answer.text || answer.additionalInfo)
            .map((answer) => ({
              text: answer.text,
              isCorrect: answer.isCorrect,
              additionalInfo: answer.additionalInfo,
            })),
        })),
      };
      const answersChanged =
        JSON.stringify(existingAnswerStructure) !==
        JSON.stringify(requestedAnswerStructure);
      const hasAnswerDependencies =
        existingQuestion.antworten.some(
          (answer) =>
            answer.medien.length > 0 || answer.team_antworten.length > 0,
        ) ||
        existingQuestion.antwortfelder.some(
          (field) =>
            field.medien.length > 0 || field.team_antworten.length > 0,
        );

      if (answersChanged && hasAnswerDependencies) {
        throw new DraftValidationError(
          "Antworten mit Medien oder bereits abgegebenen Quizantworten können in diesem Editor noch nicht ersetzt werden.",
        );
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
      if (answersChanged) {
        await tx.antworten.deleteMany({
          where: { fragen_id: payload.questionId },
        });
        await tx.frage_antwortfelder.deleteMany({
          where: { fragen_id: payload.questionId },
        });
      }

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
          antworten: answersChanged
            ? { create: classicAnswerCreates }
            : undefined,
          antwortfelder: answersChanged
            ? { create: labeledAnswerCreates }
            : undefined,
        },
        select: {
          fragen_id: true,
        },
      });

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
      };
    });

    revalidatePath("/fragen");

    return {
      success: true,
      questionId: question.fragen_id,
      questionMedia: question.questionMedia,
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
