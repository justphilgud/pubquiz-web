import type { QuestionEditorDraft } from "./types";
import { questionTemplateDefinitions } from "./templates/questionTemplates";
import {
  findQuestionTemplate,
  questionTemplateIds,
} from "./templates/questionTemplateRegistry";
import { getMediaSlotDefinition } from "./mediaSlots";
import { getGeneratorDefinition } from "./generators/registry";
import {
  generatorParametersEqual,
  normalizeGeneratorParameters,
} from "./generators/parameters";
import { normalizeQuestionTemplateConfig } from "./pixelTemplateConfig";
import { getQuestionTemplateValidationIssue } from "./templates/questionTemplateData";

export type QuestionQualityIssueCode =
  | "QUESTION_TEXT_REQUIRED"
  | "TEMPLATE_MEDIA_REQUIRED"
  | "MEDIA_SLOT_REQUIRED"
  | "MEDIA_SLOT_TYPE_MISMATCH"
  | "MEDIA_SLOT_CONFLICT"
  | "MEDIA_SLOT_TOO_MANY_ITEMS"
  | "MEDIA_UPLOAD_IN_PROGRESS"
  | "MEDIA_UPLOAD_FAILED"
  | "MEDIA_OWNER_INVALID"
  | "GENERATOR_INPUT_REQUIRED"
  | "GENERATOR_OUTPUT_REQUIRED"
  | "GENERATOR_IN_PROGRESS"
  | "GENERATOR_FAILED"
  | "GENERATOR_OUTPUT_STALE"
  | "GENERATOR_OUTPUT_MISMATCH"
  | "GENERATOR_OUTPUT_MISSING"
  | "GENERATOR_LEGACY_OUTPUT"
  | "GENERATOR_CONFLICT"
  | "PIXEL_STAGE_DURATIONS_INVALID"
  | "ESTIMATE_UNIT_REQUIRED"
  | "CORRECT_ANSWER_REQUIRED"
  | "ANSWER_MEDIA_REQUIRED"
  | "REQUIRED_LABELED_ANSWER_EMPTY"
  | "VALID_UNTIL_INVALID"
  | "LABELED_ANSWERS_INCONSISTENT"
  | "SOURCE_MISSING"
  | "CATEGORY_MISSING"
  | "ADDITIONAL_INFO_MISSING";

export type QuestionQualityIssue = {
  code: QuestionQualityIssueCode;
  params?: Record<string, string | number>;
  field?: "questionText" | "questionMedia" | "templateUnit" | "answers" | "categories" | "validUntil";
};

export type QuestionQualityResult = {
  blockers: QuestionQualityIssue[];
  warnings: QuestionQualityIssue[];
};

type AnswerWithMedia = {
  fieldGroupId?: string;
  fieldLabel?: string;
  media: {
    url: string | null;
    mediaType: string | null;
    operation: string;
    blockedReason?: string;
    blockedReasonCode?: string;
  } | null;
};

export function hasRequiredTemplateAnswerImages(
  answers: AnswerWithMedia[],
  requiredGroupCount: number,
) {
  const groups = new Map<string, AnswerWithMedia>();
  for (const answer of answers) {
    if (answer.fieldLabel) {
      groups.set(answer.fieldGroupId ?? answer.fieldLabel, answer);
    }
  }

  return groups.size >= requiredGroupCount && [...groups.values()].every(
    (answer) =>
      answer.media?.operation !== "REMOVE" &&
      answer.media?.mediaType === "IMAGE" &&
      Boolean(answer.media.url) &&
      !answer.media.blockedReason &&
      !answer.media.blockedReasonCode,
  );
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function evaluateQuestionQuality(
  draft: QuestionEditorDraft,
): QuestionQualityResult {
  const blockers: QuestionQualityIssue[] = [];
  const warnings: QuestionQualityIssue[] = [];
  const filledAnswers = draft.answers.filter((answer) => answer.text.trim());
  const mediaSlots = findQuestionTemplate(
    questionTemplateDefinitions,
    draft.templateId,
  )?.mediaSlots ?? [];
  const visibleMedia = draft.questionMedia.filter(
    (medium) => medium.operation !== "REMOVE" && Boolean(medium.url),
  );
  const template = findQuestionTemplate(questionTemplateDefinitions, draft.templateId);
  const specificTemplateIssue = getQuestionTemplateValidationIssue(
    draft.templateConfig.templateData,
    draft.templateId,
  );
  const generatorSlotKeys = new Set(
    (template?.generators ?? []).flatMap((generatorId) => {
      const definition = getGeneratorDefinition(generatorId);
      return definition ? [...definition.inputSlots, ...definition.outputSlots] : [];
    }),
  );

  if (!draft.questionText.trim()) {
    blockers.push({ code: "QUESTION_TEXT_REQUIRED", field: "questionText" });
  }

  if (
    template?.id === questionTemplateIds.pixelImage &&
    !normalizeQuestionTemplateConfig(draft.templateConfig, draft.templateId)
  ) {
    blockers.push({ code: "PIXEL_STAGE_DURATIONS_INVALID", field: "questionMedia" });
  }

  if (
    template?.editorKind !== "STANDARD" &&
    !specificTemplateIssue &&
    !normalizeQuestionTemplateConfig(draft.templateConfig, draft.templateId)
  ) {
    blockers.push({ code: "CORRECT_ANSWER_REQUIRED", field: "answers" });
  }
  if (specificTemplateIssue) {
    blockers.push({
      code: specificTemplateIssue.code,
      field: specificTemplateIssue.field,
    });
  }

  for (const mediaSlot of mediaSlots.filter((slot) => slot.required && !generatorSlotKeys.has(slot.slotKey))) {
    const definition = getMediaSlotDefinition(mediaSlot.slotKey);
    const media = draft.questionMedia.find((candidate) => candidate.slotKey === mediaSlot.slotKey);
    if (!media || media.operation === "REMOVE" || !media.url || media.mediaType !== definition.mediaType || media.blockedReason || media.blockedReasonCode) {
      blockers.push({ code: "MEDIA_SLOT_REQUIRED", params: { labelKey: mediaSlot.slotKey }, field: "questionMedia" });
    }
  }

  for (const generatorId of template?.generators ?? []) {
    const definition = getGeneratorDefinition(generatorId);
    if (!definition) {
      blockers.push({ code: "GENERATOR_CONFLICT", field: "questionMedia" });
      continue;
    }
    const inputMedia = definition.inputSlots.map((slotKey) =>
      visibleMedia.find((medium) => medium.slotKey === slotKey),
    );
    const outputMedia = definition.outputSlots.map((slotKey) =>
      visibleMedia.find((medium) => medium.slotKey === slotKey),
    );
    const runs = (draft.generatorRuns ?? []).filter((run) => run.generatorId === generatorId);
    const legacyGeneratorOutput = inputMedia.every((media) => !media) &&
      outputMedia.every(Boolean) && runs.length === 0;
    const legacyPixelOutput = generatorId === "image_pixelate" &&
      Boolean(visibleMedia.find((media) => media.slotKey === "pixel_result_image")) &&
      !runs.some((run) => run.generatorVersion >= 2);
    if (legacyGeneratorOutput || legacyPixelOutput) {
      warnings.push({ code: "GENERATOR_LEGACY_OUTPUT", field: "questionMedia" });
      continue;
    }
    if (inputMedia.some((media) => !media)) blockers.push({ code: "GENERATOR_INPUT_REQUIRED", field: "questionMedia" });
    if (outputMedia.some((media) => !media)) blockers.push({ code: "GENERATOR_OUTPUT_REQUIRED", field: "questionMedia" });
    const latest = runs[0];
    if (latest?.status === "PENDING" || latest?.status === "PROCESSING") blockers.push({ code: "GENERATOR_IN_PROGRESS", field: "questionMedia" });
    if (latest?.status === "FAILED") blockers.push({ code: "GENERATOR_FAILED", field: "questionMedia" });
    if (latest?.status === "STALE") blockers.push({ code: "GENERATOR_OUTPUT_STALE", field: "questionMedia" });
    const desiredParameters = normalizeGeneratorParameters(generatorId, draft.generatorParameters?.[generatorId]);
    const currentRun = runs.find((run) => run.status === "SUCCEEDED" && run.generatorVersion === definition.version &&
      inputMedia.every((media) => media?.operation === "UNCHANGED") &&
      Boolean(desiredParameters && generatorParametersEqual(run.parameters, desiredParameters)));
    if (!currentRun && latest?.status === "SUCCEEDED") {
      blockers.push({ code: "GENERATOR_OUTPUT_STALE", field: "questionMedia" });
    } else if (currentRun && currentRun.outputMediaIds.length !== definition.outputSlots.length) {
      blockers.push({ code: "GENERATOR_OUTPUT_MISSING", field: "questionMedia" });
    } else if (currentRun && (
      inputMedia.some((media) => !media?.existingMediaId || !currentRun.inputMediaIds.includes(media.existingMediaId)) ||
      outputMedia.some((media) => !media?.existingMediaId || !currentRun.outputMediaIds.includes(media.existingMediaId))
    )) {
      blockers.push({ code: "GENERATOR_OUTPUT_MISMATCH", field: "questionMedia" });
    }
  }

  for (const media of draft.questionMedia) {
    if (media.blockedReasonCode === "MULTIPLE_QUESTION_MEDIA") {
      blockers.push({ code: "MEDIA_SLOT_TOO_MANY_ITEMS", params: { labelKey: media.slotKey }, field: "questionMedia" });
    } else if (media.blockedReasonCode) {
      blockers.push({ code: "MEDIA_SLOT_CONFLICT", params: { labelKey: media.slotKey }, field: "questionMedia" });
    }
  }

  if (!filledAnswers.some((answer) => answer.isCorrect)) {
    blockers.push({ code: "CORRECT_ANSWER_REQUIRED", field: "answers" });
  }

  if (
    template?.requiresAnswerImages &&
    !hasRequiredTemplateAnswerImages(draft.answers, template.initialAnswers.length)
  ) {
    blockers.push({ code: "ANSWER_MEDIA_REQUIRED", field: "answers" });
  }

  if (
    draft.answers.some(
      (answer) =>
        answer.fieldLabel && answer.isRequired !== false && !answer.text.trim(),
    )
  ) {
    blockers.push({ code: "REQUIRED_LABELED_ANSWER_EMPTY", field: "answers" });
  }

  if (draft.validUntil !== null && !isValidDateInput(draft.validUntil)) {
    blockers.push({ code: "VALID_UNTIL_INVALID", field: "validUntil" });
  }

  const groupedFields = new Map<
    string,
    { label: string; isRequired: boolean }
  >();

  for (const answer of draft.answers) {
    if (!answer.fieldGroupId || !answer.fieldLabel) {
      continue;
    }

    const existingField = groupedFields.get(answer.fieldGroupId);
    const isRequired = answer.isRequired !== false;

    if (
      existingField &&
      (existingField.label !== answer.fieldLabel ||
        existingField.isRequired !== isRequired)
    ) {
      blockers.push({ code: "LABELED_ANSWERS_INCONSISTENT", field: "answers" });
      break;
    }

    groupedFields.set(answer.fieldGroupId, {
      label: answer.fieldLabel,
      isRequired,
    });
  }

  if (!draft.sourceOrRemark.trim()) {
    warnings.push({ code: "SOURCE_MISSING" });
  }

  if (draft.categoryIds.length === 0) {
    warnings.push({ code: "CATEGORY_MISSING", field: "categories" });
  }

  if (
    filledAnswers.length > 1 &&
    !filledAnswers.some((answer) => answer.additionalInfo.trim())
  ) {
    warnings.push({ code: "ADDITIONAL_INFO_MISSING", field: "answers" });
  }

  return { blockers, warnings };
}
