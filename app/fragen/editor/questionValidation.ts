import { loadQuestionEditorMessages } from "@/app/i18n/questionEditorMessages";
import { isMediaSlotKey } from "./mediaSlots";
import { normalizeGeneratorParameters } from "./generators/parameters";
import { normalizeQuestionTemplateConfig, parseQuestionTemplateConfigDraft } from "./pixelTemplateConfig";
import { getQuestionTemplateValidationIssue } from "./templates/questionTemplateData";
import { questionTemplateDefinitions } from "./templates/questionTemplates";
import {
  findQuestionTemplate, isPollQuestionTemplateId, isMemeCaptionQuestionTemplateId,
  questionTemplateIds, resolveCanonicalQuestionTemplateId,
} from "./templates/questionTemplateRegistry";
import type {
  GeneratorParametersDraft, MediaSlotKey, QuestionEditorErrorCode, QuestionMediaDraft,
  QuestionMediaOperation, QuestionMediaType, QuestionTemplateConfig, QuestionValidationTarget,
  ReviewReasonCode, SaveQuestionPayload,
} from "./types";

const serverMessages = loadQuestionEditorMessages("de");

export class DraftValidationError extends Error {
  constructor(
    message: string,
    readonly validationTarget?: QuestionValidationTarget,
    readonly errorCode: QuestionEditorErrorCode = "VALIDATION_ERROR",
  ) {
    super(message);
  }
}

export type NormalizedAnswer = {
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

export type NormalizedDraft = {
  templateId: string | null;
  sourceTemplateId: number | null;
  questionText: string;
  questionMedia: Exclude<NormalizedMediaDraft, null>[];
  answers: NormalizedAnswer[];
  categoryIds: number[];
  sourceOrRemark: string;
  moderationNotes: string;
  categoryRequest: string;
  validUntil: Date | null;
  reviewFrom: Date | null;
  reviewFeedback: string | null;
  generatorParameters: GeneratorParametersDraft;
  templateConfig: QuestionTemplateConfig;
};

export type NormalizedMediaDraft = {
  slotKey: MediaSlotKey;
  existingMediaId: number | null;
  url: string | null;
  mediaType: QuestionMediaType | null;
  fileName?: string;
  mimeType?: string;
  operation: QuestionMediaOperation;
} | null;

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

export function validateQuestion(payload: SaveQuestionPayload, requireCompleteContent = false): NormalizedDraft {
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
    requireCompleteContent || payload.intent === "SUBMIT_FOR_REVIEW" || payload.intent === "APPROVE";

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
    (payload.reviewFrom !== undefined &&
      payload.reviewFrom !== null &&
      typeof payload.reviewFrom !== "string") ||
    (payload.templateId !== null && typeof payload.templateId !== "string") ||
    (payload.sourceTemplateId !== null &&
      (!Number.isInteger(payload.sourceTemplateId) || payload.sourceTemplateId <= 0))
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

  const canonicalTemplateId = resolveCanonicalQuestionTemplateId(payload.templateId);
  const isPoll = isPollQuestionTemplateId(canonicalTemplateId);
  const isMemeCaption = isMemeCaptionQuestionTemplateId(canonicalTemplateId);
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
      isCorrect: isPoll || isMemeCaption ? false : answer.isCorrect,
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
    !isPoll &&
    !isMemeCaption &&
    canonicalTemplateId !== questionTemplateIds.pairs &&
    !answers.some((answer) => answer.text && answer.isCorrect)
  ) {
    throw new DraftValidationError(
      "Markiere mindestens eine ausgefüllte Antwort als richtig.",
      "answers",
    );
  }

  if (
    requiresCompleteQuestion &&
    (canonicalTemplateId === questionTemplateIds.pollSingle ||
      canonicalTemplateId === questionTemplateIds.pollMulti) &&
    answers.filter((answer) => answer.text).length < 2
  ) {
    throw new DraftValidationError(
      "Gib mindestens zwei Umfrageoptionen ein.",
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

  const templateId = canonicalTemplateId;
  const template = findQuestionTemplate(questionTemplateDefinitions, templateId ?? "standard");
  const generatorParameters: GeneratorParametersDraft = {};
  for (const generatorId of template?.generators ?? []) {
    const parameters = normalizeGeneratorParameters(generatorId, payload.generatorParameters?.[generatorId]);
    if (!parameters) {
      throw new DraftValidationError("Die Generatorparameter sind ungültig.", "questionMedia");
    }
    generatorParameters[generatorId] = parameters;
  }
  const specificTemplateIssue = getQuestionTemplateValidationIssue(
    payload.templateConfig.templateData,
    templateId,
  );
  if (
    specificTemplateIssue &&
    (
      requiresCompleteQuestion ||
      !["ESTIMATE_UNIT_REQUIRED", "POLL_SCALE_INVALID"].includes(
        specificTemplateIssue.code,
      )
    )
  ) {
    throw new DraftValidationError(
      specificTemplateIssue.message,
      specificTemplateIssue.field,
    );
  }
  const templateConfig = requiresCompleteQuestion
    ? normalizeQuestionTemplateConfig(payload.templateConfig, templateId)
    : parseQuestionTemplateConfigDraft(payload.templateConfig, templateId);
  if (!templateConfig) {
    if (templateId === questionTemplateIds.memeCaption) {
      throw new DraftValidationError("Das Caption-Layout ist ungültig.", "templateMemeCaptionLayout");
    }
    throw new DraftValidationError("Die Anzeigedauern der Pixelstufen sind ungültig.", "questionMedia");
  }

  if (templateConfig.templateData?.kind === "PAIRS" && answers.length > 0) {
    throw new DraftValidationError("Paare werden ausschließlich im Paar-Editor gepflegt.", "answers");
  }
  if (templateConfig.templateData?.kind === "FACTS") {
    const data = templateConfig.templateData;
    const expected = data.response === "TEXT" && data.options.length
      ? data.options.map((option) => ({ text: option.text.trim(), isCorrect: option.isCorrect }))
      : [data.solution, ...(data.response === "TEXT" ? data.acceptedVariants : [])].map((text) => ({ text: text.trim(), isCorrect: true }));
    if (answers.length !== expected.length || answers.some((answer, index) =>
      answer.text !== expected[index].text || answer.isCorrect !== expected[index].isCorrect || answer.fieldGroupId || answer.media)) {
      throw new DraftValidationError("Fakten-Lösung und Antwortdaten stimmen nicht überein.", "answers");
    }
  }

  const validUntil = parseValidUntil(
    payload.validUntil,
    requiresCompleteQuestion,
  );
  const reviewFrom = parseReviewFrom(
    payload.reviewFrom,
    requiresCompleteQuestion,
  );
  if (validUntil !== null && reviewFrom !== null) {
    throw new DraftValidationError(
      "Wähle entweder ‚Veraltet ab‘ oder ‚Prüfen ab‘, nicht beides.",
      "reviewFrom",
    );
  }

  return {
    templateId,
    sourceTemplateId: payload.sourceTemplateId,
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
    validUntil,
    reviewFrom,
    reviewFeedback: normalizeReviewFeedback(payload),
    generatorParameters,
    templateConfig,
  };
}

function parseReviewFrom(
  value: string | null | undefined,
  requireCompleteDate: boolean,
): Date | null {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    if (requireCompleteDate && value !== null && value !== undefined) {
      throw new DraftValidationError(
        "Wähle ein vollständiges Prüfdatum aus.",
        "reviewFrom",
      );
    }
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new DraftValidationError(
      "Das Prüfdatum ist nicht vollständig oder ungültig.",
      "reviewFrom",
    );
  }
  const date = new Date(`${normalizedValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalizedValue) {
    throw new DraftValidationError("Das Prüfdatum ist ungültig.", "reviewFrom");
  }
  return date;
}
