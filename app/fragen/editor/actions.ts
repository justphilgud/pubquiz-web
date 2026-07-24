"use server";

import { head } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { requireQuestionEditor } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import {
  getMediaVerificationServerConfig,
  logMediaUploadFailure,
} from "./mediaUploadEnvironment";
import { getCurrentUserId } from "@/app/services/questionService";
import {
  createAnswerMediaDraftFromStoredMedia,
  createQuestionMediaDraftFromStoredMedia,
  getQuestionMediaFileName,
  getQuestionMediaTypeFromName,
  isAllowedQuestionMediaPathname,
  questionMediaRules,
} from "./questionMedia";
import { questionTemplateDefinitions } from "./templates/questionTemplates";
import {
  findQuestionTemplate,
  getQuestionTemplatePersistenceIds,
  resolveCanonicalQuestionTemplateId,
} from "./templates/questionTemplateRegistry";
import type {
  QuestionMediaOperation,
  QuestionMediaDraft,
  QuestionMediaType,
  QuestionSaveIntent,
  QuestionValidationTarget,
  ReviewReasonCode,
  SaveQuestionPayload,
  SaveQuestionResult,
  QuestionEditorErrorCode,
  QuestionEditorSuccessCode,
  GeneratorParametersDraft,
  QuestionTemplateConfig,
} from "./types";
import { loadQuestionEditorMessages } from "@/app/i18n/questionEditorMessages";
import { formatMessage } from "@/app/i18n/formatMessage";
import {
  getMediaSlotDefinition,
  hasExactlyOneMediaOwner,
  isMediaSlotAllowedForTemplate,
  isMediaSlotKey,
} from "./mediaSlots";
import type { MediaSlotKey } from "./types";
import { getGeneratorDefinition } from "./generators/registry";
import {
  generatorParametersEqual,
  normalizeGeneratorParameters,
} from "./generators/parameters";
import {
  normalizeQuestionTemplateConfig,
  parseQuestionTemplateConfigDraft,
} from "./pixelTemplateConfig";
import { hasRequiredTemplateAnswerImages } from "./questionQuality";
import { synchronizeFaceMorphPixelQuestions } from "./faceMorphPixelQuestions.server";
import { getAffectedQuestionIds } from "./questionSaveResult";
import {
  getQuestionActor,
  mapQuestionAccessContext,
  requireQuestionScopeSelection,
} from "./questionAccess.server";
import {
  canApproveScopedQuestion,
  canEditScopedQuestion,
  canRequestChangesForScopedQuestion,
  canUseQuestionScope,
} from "./questionScopePolicy";
import { isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import {
  PendingCategoryReviewError,
  resolvePendingCategoryReview,
} from "./pendingCategoryReview";

const serverMessages = loadQuestionEditorMessages("de");

class DraftValidationError extends Error {
  constructor(
    message: string,
    readonly validationTarget?: QuestionValidationTarget,
    readonly errorCode: QuestionEditorErrorCode = "VALIDATION_ERROR",
  ) {
    super(message);
  }
}

function createValidationFailure(error: DraftValidationError): SaveQuestionResult {
  return {
    success: false,
    errorCode: error.errorCode,
    errorParams:
      error.errorCode === "VALIDATION_ERROR"
        ? { detail: error.message }
        : undefined,
    fallbackMessage: error.message,
    validationTarget: error.validationTarget,
  };
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
  templateId: string | null;
  questionText: string;
  questionMedia: Exclude<NormalizedMediaDraft, null>[];
  answers: NormalizedAnswer[];
  categoryIds: number[];
  sourceOrRemark: string;
  moderationNotes: string;
  categoryRequest: string;
  validUntil: Date | null;
  reviewFeedback: string | null;
  generatorParameters: GeneratorParametersDraft;
  templateConfig: QuestionTemplateConfig;
};

type NormalizedMediaDraft = {
  slotKey: MediaSlotKey;
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

const reviewReasonLabels: Record<ReviewReasonCode, string> =
  serverMessages.review.reasons;

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
  value: QuestionMediaDraft | null,
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
      value.mediaType !== "AUDIO" &&
      value.mediaType !== "VIDEO") ||
    !isMediaSlotKey(value.slotKey) ||
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
    slotKey: value.slotKey,
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
    const uploadConfig = getMediaVerificationServerConfig();
    const metadata = await head(media.url, uploadConfig.blobAuthentication);
    const rule = questionMediaRules[media.mediaType];
    const slotDefinition = getMediaSlotDefinition(media.slotKey);

    if (
      !isAllowedQuestionMediaPathname(
        metadata.pathname,
        media.mediaType,
        target,
        uploadConfig.environmentPrefix,
        media.slotKey,
      )
    ) {
      throw new DraftValidationError(
        "Dateipfad oder Dateiendung des Mediums ist ungültig.",
        validationTarget,
      );
    }

    if (!slotDefinition.allowedMimeTypes.includes(metadata.contentType.toLowerCase())) {
      throw new DraftValidationError(
        "Der tatsächliche Dateityp des Mediums wird nicht unterstützt.",
        validationTarget,
      );
    }

    if (metadata.size > slotDefinition.maxFileSizeBytes) {
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
    typeof payload.categoryRequest !== "string" ||
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

  if (payload.categoryRequest.length > 500) {
    throw new DraftValidationError(
      "Der Kategorienwunsch darf höchstens 500 Zeichen lang sein.",
      "categories",
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

    if (media && (media.slotKey !== "answer_image" || (media.operation === "NEW" && media.mediaType !== "IMAGE"))) {
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

  const templateId = resolveCanonicalQuestionTemplateId(payload.templateId);
  const template = findQuestionTemplate(questionTemplateDefinitions, templateId ?? "standard");
  const generatorParameters: GeneratorParametersDraft = {};
  for (const generatorId of template?.generators ?? []) {
    const parameters = normalizeGeneratorParameters(generatorId, payload.generatorParameters?.[generatorId]);
    if (!parameters) {
      throw new DraftValidationError("Die Generatorparameter sind ungültig.", "questionMedia");
    }
    generatorParameters[generatorId] = parameters;
  }
  const templateConfig = requiresCompleteQuestion
    ? normalizeQuestionTemplateConfig(payload.templateConfig, templateId)
    : parseQuestionTemplateConfigDraft(payload.templateConfig, templateId);
  if (!templateConfig) {
    throw new DraftValidationError("Die Anzeigedauern der Pixelstufen sind ungültig.", "questionMedia");
  }

  return {
    templateId,
    questionText,
    questionMedia: (() => {
      if (!Array.isArray(payload.questionMedia)) {
        throw new DraftValidationError("Die Fragenmedien sind ungültig.", "questionMedia");
      }
      const normalized = payload.questionMedia.map((media) => normalizeQuestionMedia(media));
      if (normalized.some((media) => media === null)) {
        throw new DraftValidationError("Die Fragenmedien sind ungültig.", "questionMedia");
      }
      const slots = normalized.map((media) => media!.slotKey);
      if (new Set(slots).size !== slots.length) {
        throw new DraftValidationError("Ein Medienslot darf nur einmal vorkommen.", "questionMedia", "CONFLICT");
      }
      return normalized as Exclude<NormalizedMediaDraft, null>[];
    })(),
    answers,
    categoryIds: [...new Set(payload.categoryIds)],
    sourceOrRemark: payload.sourceOrRemark.trim(),
    moderationNotes: payload.moderationNotes.trim(),
    categoryRequest: payload.categoryRequest.trim(),
    validUntil: parseValidUntil(
      payload.validUntil,
      requiresCompleteQuestion,
    ),
    reviewFeedback: normalizeReviewFeedback(payload),
    generatorParameters,
    templateConfig,
  };
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
    return {
      success: false,
      errorCode: "INVALID_SAVE_ACTION",
      fallbackMessage: serverMessages.errors.INVALID_SAVE_ACTION,
    };
  }

  if (
    (payload.scope !== "GLOBAL" && payload.scope !== "EVENT_SERIES") ||
    !Array.isArray(payload.eventSeriesIds)
  ) {
    return {
      success: false,
      errorCode: "VALIDATION_ERROR",
      fallbackMessage: "Der Geltungsbereich ist ungültig.",
    };
  }

  if (
    payload.intent === "REQUEST_CHANGES" &&
    payload.questionId === undefined
  ) {
    return {
      success: false,
      errorCode: "VALIDATION_ERROR",
      fallbackMessage: "Nur eine bestehende Frage kann zurückgegeben werden.",
    };
  }

  const actor = await getQuestionActor(session);
  const preflightQuestion = payload.questionId === undefined
    ? null
    : await prisma.fragen.findUnique({
        where: { fragen_id: payload.questionId },
        select: {
          geltungsbereich: true,
          created_by_user_id: true,
          review_status: true,
          ist_archiviert: true,
          freigegeben: true,
          eventreihen: { select: { eventreihe_id: true } },
        },
      });
  if (payload.questionId !== undefined && !preflightQuestion) {
    return {
      success: false,
      errorCode: "QUESTION_NOT_FOUND",
      fallbackMessage: serverMessages.errors.QUESTION_NOT_FOUND,
    };
  }

  const currentContext = preflightQuestion
    ? mapQuestionAccessContext(preflightQuestion)
    : null;
  const targetContext = {
    scope: payload.scope,
    eventSeriesIds: payload.scope === "GLOBAL" ? [] : payload.eventSeriesIds,
    createdByUserId: currentContext?.createdByUserId ?? actor.userId,
    reviewStatus: currentContext?.reviewStatus ?? "DRAFT" as const,
    isArchived: currentContext?.isArchived ?? false,
    isApproved: currentContext?.isApproved ?? false,
  };
  const keepsLegacyGlobalScope = currentContext?.scope === "GLOBAL" && payload.scope === "GLOBAL";

  try {
    if (!keepsLegacyGlobalScope || isAdministrator(actor) || payload.questionId === undefined) {
      await requireQuestionScopeSelection(payload.scope, payload.eventSeriesIds, session);
    }
  } catch {
    return {
      success: false,
      errorCode: "PERMISSION_DENIED",
      fallbackMessage: "Der gewählte Geltungsbereich ist nicht erlaubt.",
    };
  }

  const mayPerformIntent = payload.questionId === undefined
    ? payload.intent === "DRAFT" ||
      (payload.intent === "SUBMIT_FOR_REVIEW" && !isAdministrator(actor)) ||
      (payload.intent === "APPROVE" && canApproveScopedQuestion(actor, targetContext))
    : payload.intent === "APPROVE"
      ? canApproveScopedQuestion(actor, targetContext)
      : payload.intent === "REQUEST_CHANGES"
        ? canRequestChangesForScopedQuestion(actor, targetContext)
        : (
            canEditScopedQuestion(actor, currentContext!) &&
            (canUseQuestionScope(actor, payload.scope, targetContext.eventSeriesIds) || keepsLegacyGlobalScope) &&
            (payload.intent !== "SUBMIT_FOR_REVIEW" || !isAdministrator(actor))
          );
  if (!mayPerformIntent) {
    return {
      success: false,
      errorCode: "PERMISSION_DENIED",
      fallbackMessage: serverMessages.errors.PERMISSION_DENIED,
    };
  }

  let draft: NormalizedDraft;

  try {
    draft = validateQuestion(payload);
    draft.questionMedia = await Promise.all(
      draft.questionMedia.map((media) => verifyUploadedQuestionMedia(media)),
    );
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
      return createValidationFailure(error);
    }

    console.error("Entwurfsdaten konnten nicht validiert werden", error);

    return {
      success: false,
      errorCode: "UNEXPECTED_ERROR",
      fallbackMessage: serverMessages.errors.UNEXPECTED_ERROR,
    };
  }

  const requiresCompleteQuestion =
    payload.intent === "SUBMIT_FOR_REVIEW" || payload.intent === "APPROVE";
  const selectedTemplate = findQuestionTemplate(
    questionTemplateDefinitions,
    draft.templateId ?? "standard",
  );
  const templateMediaSlots = selectedTemplate?.mediaSlots ?? [];
  const requiredMediaSlots = templateMediaSlots.filter((slot) => slot.required);
  const requiredMediaSlot = requiredMediaSlots[0] ?? null;
  const requiredMediaLabel = requiredMediaSlot ? serverMessages.media.existingLabel : null;

  if (selectedTemplate?.requiresAnswerImages) {
    const requiredQuestionMediaMissing = requiredMediaSlots.some((slot) => {
      const media = draft.questionMedia.find(
        (candidate) => candidate.slotKey === slot.slotKey,
      );
      return !media || media.operation === "REMOVE" || !media.url;
    });
    if (requiredQuestionMediaMissing) {
      return createValidationFailure(
        new DraftValidationError(
          "Das FaceMorph-Ergebnisbild ist erforderlich.",
          "questionMedia",
        ),
      );
    }
    if (
      !hasRequiredTemplateAnswerImages(
        draft.answers,
        selectedTemplate.initialAnswers.length,
      )
    ) {
      return createValidationFailure(
        new DraftValidationError(
          "Für FaceMorph sind beide Antwortbilder erforderlich.",
          "answers",
        ),
      );
    }
  }

  try {
    for (const media of draft.questionMedia) {
      const definition = getMediaSlotDefinition(media.slotKey);
      if (
        definition.scope !== "QUESTION" ||
        definition.mediaType !== media.mediaType ||
        (media.operation === "NEW" && !definition.manualUploadAllowed) ||
        (media.operation === "NEW" && !isMediaSlotAllowedForTemplate(templateMediaSlots, media.slotKey))
      ) {
        throw new DraftValidationError(
          "Ein Fragenmedium gehört nicht zu einem zulässigen Slot der Vorlage.",
          "questionMedia",
          "CONFLICT",
        );
      }
    }
  } catch (error) {
    if (error instanceof DraftValidationError) {
      return createValidationFailure(error);
    }
    throw error;
  }
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
      const selectedCategories = await tx.fragenkategorie.findMany({
        where: {
          fragenkategorie_id: {
            in: draft.categoryIds,
          },
        },
        select: {
          fragenkategorie_id: true,
          status: true,
        },
      });

      if (selectedCategories.length !== draft.categoryIds.length) {
        throw new DraftValidationError(
          "Mindestens eine ausgewählte Kategorie existiert nicht mehr.",
          "categories",
        );
      }
      const categoryReview = (() => {
        try {
          return resolvePendingCategoryReview({
            intent: payload.intent,
            isAdministrator: isAdministrator(actor),
            selectedCategoryIds: draft.categoryIds,
            pendingCategoryIds: selectedCategories.flatMap((category) =>
              category.status === "PENDING"
                ? [category.fragenkategorie_id]
                : [],
            ),
            decisions: payload.categoryReviewDecisions,
          });
        } catch (error) {
          if (error instanceof PendingCategoryReviewError) {
            throw new DraftValidationError(
              error.code === "ADMIN_REQUIRED"
                ? "Offene Kategorien müssen vor der Freigabe durch einen Administrator geprüft werden."
                : "Für jede offene Kategorie ist vor der Freigabe eine Entscheidung erforderlich.",
              "categories",
              error.code === "ADMIN_REQUIRED"
                ? "PERMISSION_DENIED"
                : "VALIDATION_ERROR",
            );
          }
          throw error;
        }
      })();

      if (categoryReview.approvedCategoryIds.length > 0) {
        const approvedCategories = await tx.fragenkategorie.updateMany({
          where: {
            fragenkategorie_id: {
              in: categoryReview.approvedCategoryIds,
            },
            status: "PENDING",
          },
          data: { status: "ACTIVE" },
        });
        if (
          approvedCategories.count !==
          categoryReview.approvedCategoryIds.length
        ) {
          throw new DraftValidationError(
            "Mindestens eine offene Kategorie wurde zwischenzeitlich geändert.",
            "categories",
            "CONFLICT",
          );
        }
      }

      async function finalizeDiscardedCategories() {
        for (const categoryId of categoryReview.discardedCategoryIds) {
          const otherReferenceCount = await tx.fragen_kategorien.count({
            where: {
              fragenkategorie_id: categoryId,
              ...(payload.questionId
                ? { fragen_id: { not: payload.questionId } }
                : {}),
            },
          });
          if (otherReferenceCount === 0) {
            await tx.fragenkategorie.delete({
              where: { fragenkategorie_id: categoryId },
            });
          } else {
            await tx.fragenkategorie.update({
              where: { fragenkategorie_id: categoryId },
              data: { status: "ARCHIVED" },
            });
          }
        }
      }

      const archivedCategoryIds = selectedCategories.flatMap((category) =>
        category.status === "ARCHIVED"
          ? [category.fragenkategorie_id]
          : [],
      );
      if (archivedCategoryIds.length > 0) {
        const retainedArchivedCount = payload.questionId
          ? await tx.fragen_kategorien.count({
              where: {
                fragen_id: payload.questionId,
                fragenkategorie_id: { in: archivedCategoryIds },
              },
            })
          : 0;
        if (retainedArchivedCount !== archivedCategoryIds.length) {
          throw new DraftValidationError(
            "Archivierte Kategorien können nur an bestehenden Fragen beibehalten werden.",
            "categories",
          );
        }
      }

      const persistedTemplates = draft.templateId
        ? await tx.frage_vorlagen.findMany({
            where: {
              code: {
                in: [...getQuestionTemplatePersistenceIds(draft.templateId)],
              },
            },
            select: { vorlage_id: true, code: true },
          })
        : [];
      const persistedTemplate = draft.templateId
        ? persistedTemplates.find(({ code }) => code === draft.templateId) ??
          persistedTemplates[0] ??
          null
        : null;

      if (draft.templateId && !persistedTemplate) {
        throw new DraftValidationError(
          serverMessages.errors.UNKNOWN_TEMPLATE,
          undefined,
          "UNKNOWN_TEMPLATE",
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

      const newQuestionMediaTypes = new Set(
        draft.questionMedia
          .filter((media) => media.operation === "NEW" && media.mediaType)
          .map((media) => media.mediaType!),
      );
      const mediaTypeName = (type: QuestionMediaType) =>
        type === "IMAGE" ? "Bild" : type === "AUDIO" ? "Audio" : "Video";
      const matchingMediaTypes = newQuestionMediaTypes.size
        ? await tx.medientyp.findMany({
            where: { medientyp: { in: [...newQuestionMediaTypes].map(mediaTypeName), mode: "insensitive" } },
            select: { medientyp_id: true, medientyp: true },
          })
        : [];
      const requestedMediaTypeIds = new Map<QuestionMediaType, number>();
      for (const mediaType of newQuestionMediaTypes) {
        const matches = matchingMediaTypes.filter(
          (candidate) => candidate.medientyp.toLowerCase() === mediaTypeName(mediaType).toLowerCase(),
        );
        if (matches.length !== 1) {
          throw new DraftValidationError("Der Medientyp ist nicht eindeutig konfiguriert.", "questionMedia");
        }
        requestedMediaTypeIds.set(mediaType, matches[0].medientyp_id);
      }
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

      const categoryCreates = categoryReview.retainedCategoryIds.map((categoryId) => ({
        fragenkategorie: {
          connect: {
            fragenkategorie_id: categoryId,
          },
        },
      }));
      const storedMediaSelect = {
        medien_id: true,
        datei: true,
        slot_key: true,
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
              slot_key: "answer_image",
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
              slot_key: "answer_image",
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
        await finalizeDiscardedCategories();
        if (draft.questionMedia.some((media) => media.operation === "UNCHANGED" || media.existingMediaId !== null)) {
          throw new DraftValidationError(
            "Ein vorhandenes Medium kann keiner neuen Frage zugeordnet werden.",
            "questionMedia",
          );
        }

        if (
          requiresCompleteQuestion &&
          requiredMediaSlots.some((slot) =>
            !draft.questionMedia.some(
              (media) => media.slotKey === slot.slotKey && media.operation === "NEW",
            ),
          )
        ) {
          throw new DraftValidationError(
            formatMessage(serverMessages.editor.requiredTemplateMedia, {
              label: serverMessages.media.existingLabel,
            }),
            "questionMedia",
          );
        }

        const approvalDate = payload.intent === "APPROVE" ? new Date() : null;
        const approval = {
          freigegeben: payload.intent === "APPROVE",
          approved_by_user_id: payload.intent === "APPROVE" ? userId : null,
          approved_at: approvalDate,
        };

        const createdQuestion = await tx.fragen.create({
          data: {
            frage: draft.questionText,
            geltungsbereich: payload.scope,
            quelle: draft.sourceOrRemark || null,
            vorlage_id: persistedTemplate?.vorlage_id ?? null,
            template_config_json: draft.templateConfig,
            ist_archiviert: false,
            ist_unfertig: payload.intent === "DRAFT",
            moderationsnotizen: draft.moderationNotes || null,
            kategorienwunsch: draft.categoryRequest || null,
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
            eventreihen: payload.scope === "EVENT_SERIES"
              ? { create: payload.eventSeriesIds.map((eventSeriesId) => ({ eventreihe_id: eventSeriesId })) }
              : undefined,
          },
          select: {
            fragen_id: true,
          },
        });

        for (const media of draft.questionMedia) {
          if (media.operation !== "NEW" || !media.url || !media.mediaType) continue;
          const medientypId = requestedMediaTypeIds.get(media.mediaType);
          if (!medientypId || !hasExactlyOneMediaOwner({ questionId: createdQuestion.fragen_id })) {
            throw new DraftValidationError("Die Medienzuordnung ist ungültig.", "questionMedia");
          }
          await tx.medien.create({ data: {
            fragen_id: createdQuestion.fragen_id,
            antwort_id: null,
            antwortfeld_id: null,
            slot_key: media.slotKey,
            medientyp_id: medientypId,
            datei: media.url,
            sortierung: 1,
          } });
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
            slot_key: true,
            medientyp: { select: { medientyp: true } },
          },
        });

        return {
          fragen_id: createdQuestion.fragen_id,
          questionMedia:
            createQuestionMediaDraftFromStoredMedia(storedMedia, draft.templateId),
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
          geltungsbereich: true,
          eventreihen: { select: { eventreihe_id: true } },
          medien: {
            orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
            select: {
              medien_id: true,
              datei: true,
              slot_key: true,
              medientyp: { select: { medientyp: true } },
            },
          },
          generator_laefe: {
            select: {
              generator_id: true,
              generator_version: true,
              status: true,
              parameters_json: true,
              medien: { select: { medien_id: true, rolle: true, slot_key: true } },
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
          serverMessages.errors.QUESTION_NOT_FOUND,
          undefined,
          "QUESTION_NOT_FOUND",
        );
      }

      if (!mayPerformIntent) {
        throw new DraftValidationError(
          "Du darfst diese Aktion für diese Frage nicht ausführen.",
          undefined,
          "PERMISSION_DENIED",
        );
      }

      const primaryQuestionMedia = draft.questionMedia[0] ?? null;
      const mediaOperation = primaryQuestionMedia?.operation ?? "UNCHANGED";
      const existingQuestionMedia = existingQuestion.medien;

      if (
        false && existingQuestionMedia.length > 1 &&
        mediaOperation !== "UNCHANGED"
      ) {
        throw new DraftValidationError(
          "Diese Frage besitzt mehrere Fragenmedien. Sie können im MVP nicht ersetzt oder entfernt werden.",
          "questionMedia",
          "CONFLICT",
        );
      }

      if (
        primaryQuestionMedia?.existingMediaId &&
        !existingQuestionMedia.some(
          (medium) =>
            medium.medien_id === primaryQuestionMedia?.existingMediaId,
        )
      ) {
        throw new DraftValidationError(
          "Das vorhandene Medium gehört nicht mehr zu dieser Frage.",
          "questionMedia",
        );
      }

      const effectiveMediaType =
        mediaOperation === "NEW"
          ? primaryQuestionMedia?.mediaType ?? null
          : mediaOperation === "REMOVE" || existingQuestionMedia.length !== 1
            ? null
            : getQuestionMediaTypeFromName(
                existingQuestionMedia[0].medientyp.medientyp,
              );

      if (
        false && requiresCompleteQuestion &&
        requiredMediaSlot &&
        effectiveMediaType !== getMediaSlotDefinition(requiredMediaSlot.slotKey).mediaType
      ) {
        throw new DraftValidationError(
          formatMessage(serverMessages.editor.requiredTemplateMedia, {
            label: requiredMediaLabel ?? serverMessages.media.existingLabel,
          }),
          "questionMedia",
        );
      }

      const existingIds = new Set(existingQuestionMedia.map((medium) => medium.medien_id));
      const requestedExistingIds = new Set<number>();
      for (const media of draft.questionMedia) {
        if (media.existingMediaId === null) continue;
        if (requestedExistingIds.has(media.existingMediaId) || !existingIds.has(media.existingMediaId)) {
          throw new DraftValidationError("Das vorhandene Medium gehört nicht mehr zu dieser Frage.", "questionMedia");
        }
        requestedExistingIds.add(media.existingMediaId);
      }
      const visibleQuestionMedia = draft.questionMedia.filter(
        (media) => media.operation !== "REMOVE" && Boolean(media.url),
      );
      const hasLegacyGeneratorOutput = (selectedTemplate?.generators ?? []).some((generatorId) => {
        const definition = getGeneratorDefinition(generatorId);
        const runs = existingQuestion.generator_laefe.filter((run) => run.generator_id === generatorId);
        const legacyPixelRun = generatorId === "image_pixelate" &&
          visibleQuestionMedia.some((media) => media.slotKey === "pixel_result_image") &&
          !runs.some((run) => run.generator_version >= 2);
        return legacyPixelRun || Boolean(definition && runs.length === 0 &&
          definition.inputSlots.every((slotKey) => !visibleQuestionMedia.some((media) => media.slotKey === slotKey)) &&
          definition.outputSlots.every((slotKey) => visibleQuestionMedia.some((media) => media.slotKey === slotKey)));
      });
      const generatorMediaMissing = (selectedTemplate?.generators ?? []).some((generatorId) => {
        const definition = getGeneratorDefinition(generatorId);
        if (!definition) return true;
        const inputMedia = definition.inputSlots.map((slotKey) =>
          visibleQuestionMedia.find((media) => media.slotKey === slotKey),
        );
        const outputMedia = definition.outputSlots.map((slotKey) =>
          visibleQuestionMedia.find((media) => media.slotKey === slotKey),
        );
        const desiredParameters = draft.generatorParameters[generatorId];
        return inputMedia.some((media) => !media || media.operation !== "UNCHANGED") || outputMedia.some((media) => !media) ||
          !existingQuestion.generator_laefe.some((run) => {
            const runParameters = normalizeGeneratorParameters(generatorId, run.parameters_json);
            return run.generator_id === generatorId && run.generator_version === definition.version &&
              run.status === "SUCCEEDED" && Boolean(desiredParameters && runParameters && generatorParametersEqual(desiredParameters, runParameters)) &&
              inputMedia.every((media) => media?.existingMediaId !== null && run.medien.some((item) => item.rolle === "INPUT" && item.medien_id === media?.existingMediaId)) &&
              outputMedia.every((media) => media?.existingMediaId !== null && run.medien.some((item) => item.rolle === "OUTPUT" && item.medien_id === media?.existingMediaId));
          });
      });
      const requiredMediaMissing = hasLegacyGeneratorOutput
        ? false
        : generatorMediaMissing || requiredMediaSlots.some(
            (slot) => !visibleQuestionMedia.some((media) => media.slotKey === slot.slotKey),
          );
      if (requiresCompleteQuestion && requiredMediaMissing) {
        throw new DraftValidationError(
          formatMessage(serverMessages.editor.requiredTemplateMedia, { label: serverMessages.media.existingLabel }),
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
          slot_key: string | null;
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
                slot_key: "answer_image",
                medientyp_id: answerImageTypeId,
                sortierung: 1,
              },
            });
          } else {
            await tx.medien.create({
              data: {
                ...relationData,
                datei: media.url,
                slot_key: "answer_image",
                medientyp_id: answerImageTypeId,
                sortierung: 1,
              },
            });
          }
        } else if (operation === "REMOVE" && existingMedia.length === 1) {
          await tx.medien.delete({
            where: { medien_id: existingMedia[0].medien_id },
          });
        } else if (operation === "UNCHANGED" && existingMedia.length === 1 && existingMedia[0].slot_key === null) {
          await tx.medien.update({
            where: { medien_id: existingMedia[0].medien_id },
            data: { slot_key: "answer_image" },
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

      const approvalDate = payload.intent === "APPROVE" ? new Date() : null;
      const approval = payload.intent === "APPROVE"
        ? { freigegeben: true, approved_by_user_id: userId, approved_at: approvalDate }
        : { freigegeben: false, approved_by_user_id: null, approved_at: null };

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
      await finalizeDiscardedCategories();

      for (const media of draft.questionMedia) {
        const existing = media.existingMediaId === null
          ? null
          : existingQuestionMedia.find((candidate) => candidate.medien_id === media.existingMediaId) ?? null;
        if (media.operation === "NEW" && media.url && media.mediaType) {
          const medientypId = requestedMediaTypeIds.get(media.mediaType);
          if (!medientypId) throw new DraftValidationError("Der Medientyp ist nicht konfiguriert.", "questionMedia");
          if (existing) {
            await tx.medien.update({
              where: { medien_id: existing.medien_id },
              data: { datei: media.url, medientyp_id: medientypId, slot_key: media.slotKey, sortierung: 1 },
            });
          } else {
            await tx.medien.create({ data: {
              fragen_id: payload.questionId,
              antwort_id: null,
              antwortfeld_id: null,
              slot_key: media.slotKey,
              datei: media.url,
              medientyp_id: medientypId,
              sortierung: 1,
            } });
          }
        } else if (media.operation === "REMOVE" && existing) {
          await tx.medien.delete({ where: { medien_id: existing.medien_id } });
        } else if (media.operation === "UNCHANGED" && existing && existing.slot_key === null) {
          await tx.medien.update({ where: { medien_id: existing.medien_id }, data: { slot_key: media.slotKey } });
        }
      }

      const changedGeneratorSlots = draft.questionMedia
        .filter((media) => media.operation === "NEW" || media.operation === "REMOVE")
        .map((media) => media.slotKey);
      const staleGeneratorIds = (selectedTemplate?.generators ?? []).filter((generatorId) => {
        const definition = getGeneratorDefinition(generatorId);
        return definition && [...definition.inputSlots, ...definition.outputSlots]
          .some((slotKey) => changedGeneratorSlots.includes(slotKey));
      });
      if (staleGeneratorIds.length > 0) {
        await tx.medien_generator_laefe.updateMany({
          where: {
            fragen_id: payload.questionId,
            generator_id: { in: staleGeneratorIds },
            status: "SUCCEEDED",
          },
          data: { status: "STALE", finished_at: new Date() },
        });
      }

      if (existingQuestion.geltungsbereich === "GLOBAL" && payload.scope === "EVENT_SERIES") {
        const conflictingQuizzes = await tx.quiz_fragen.findMany({
          where: {
            fragen_id: payload.questionId,
            quiz: { eventreihe_id: { notIn: payload.eventSeriesIds } },
          },
          select: { quiz_id: true },
          distinct: ["quiz_id"],
        });
        if (conflictingQuizzes.length > 0) {
          throw new DraftValidationError(
            `Der Geltungsbereich kann nicht eingeschränkt werden. Die Frage wird in Quiz ${conflictingQuizzes.map((entry) => entry.quiz_id).join(", ")} anderer Eventreihen verwendet.`,
            undefined,
            "CONFLICT",
          );
        }
      }

      const updatedQuestion = await tx.fragen.update({
        where: { fragen_id: payload.questionId },
        data: {
          frage: draft.questionText,
          geltungsbereich: payload.scope,
          quelle: draft.sourceOrRemark || null,
          vorlage_id: persistedTemplate?.vorlage_id ?? null,
          template_config_json: draft.templateConfig,
          ist_unfertig: payload.intent === "DRAFT",
          moderationsnotizen: draft.moderationNotes || null,
          kategorienwunsch: draft.categoryRequest || null,
          gueltig_bis: draft.validUntil,
          freigegeben: approval.freigegeben,
          approved_by_user_id: approval.approved_by_user_id,
          approved_at: approval.approved_at,
          ...reviewUpdate,
          last_modified_by_user_id: userId,
          fragen_kategorien: { create: categoryCreates },
          eventreihen: {
            deleteMany: {},
            ...(payload.scope === "EVENT_SERIES"
              ? { create: payload.eventSeriesIds.map((eventSeriesId) => ({ eventreihe_id: eventSeriesId })) }
              : {}),
          },
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
          slot_key: true,
          medientyp: { select: { medientyp: true } },
        },
      });

      return {
        fragen_id: updatedQuestion.fragen_id,
        questionMedia: createQuestionMediaDraftFromStoredMedia(storedMedia, draft.templateId),
        answers: answerStates,
      };
    });

    const pixelQuestionSync = await synchronizeFaceMorphPixelQuestions(
      question.fragen_id,
      userId,
    );
    const affectedQuestionIds = getAffectedQuestionIds(
      question.fragen_id,
      pixelQuestionSync,
    );

    revalidatePath("/fragen");

    return {
      success: true,
      questionId: question.fragen_id,
      affectedQuestionIds,
      questionMedia: question.questionMedia,
      answers: question.answers,
      pixelQuestionSync,
      messageCode: createSuccessCode(
        payload.intent,
        payload.questionId !== undefined,
      ),
      messageParams: {
        id: question.fragen_id,
        ids: affectedQuestionIds.join(", "),
      },
      fallbackMessage: formatMessage(
        serverMessages.success[
          createSuccessCode(payload.intent, payload.questionId !== undefined)
        ],
        { id: question.fragen_id, ids: affectedQuestionIds.join(", ") },
      ),
    };
  } catch (error) {
    if (error instanceof DraftValidationError) {
      return createValidationFailure(error);
    }

    console.error("Frage konnte nicht gespeichert werden", error);

    return {
      success: false,
      errorCode: "UNEXPECTED_ERROR",
      fallbackMessage: serverMessages.errors.UNEXPECTED_ERROR,
    };
  }
}

function createSuccessCode(
  intent: QuestionSaveIntent,
  wasUpdated: boolean,
): QuestionEditorSuccessCode {
  return (
    intent === "DRAFT"
      ? wasUpdated
        ? "draftUpdated"
        : "draftCreated"
      : intent === "SUBMIT_FOR_REVIEW"
        ? wasUpdated
          ? "submittedUpdated"
          : "submittedCreated"
        : intent === "REQUEST_CHANGES"
          ? "changesRequested"
          : wasUpdated
            ? "approvedUpdated"
            : "approvedCreated"
  );
}
