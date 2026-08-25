import type {
  MediaSlotKey,
  QuestionAnswerDraft,
  QuestionEditorDraft,
  QuestionMediaDraft,
  QuestionMediaType,
  QuestionTemplate,
  QuestionTemplateConfig,
} from "../types";
import { isMediaSlotKey } from "../mediaSlots";

export const dynamicQuestionTemplateRoles = [
  "FIXED",
  "REQUIRED_NEW",
  "EXCLUDED",
] as const;

export type DynamicQuestionTemplateRole =
  (typeof dynamicQuestionTemplateRoles)[number];

export type DynamicQuestionTemplateRuleSelection = {
  questionText: DynamicQuestionTemplateRole;
  media: Array<{
    sourceMediaId: number | null;
    slotKey: MediaSlotKey;
    role: DynamicQuestionTemplateRole;
  }>;
  answers: Array<{
    sourceKey: string;
    role: DynamicQuestionTemplateRole;
  }>;
};

export type PersistedDynamicQuestionTemplateRuleSelection = Omit<
  DynamicQuestionTemplateRuleSelection,
  "media"
> & {
  media: Array<{
    sourceMediaId: number;
    slotKey: MediaSlotKey;
    role: DynamicQuestionTemplateRole;
  }>;
};

export type DynamicQuestionTemplateSnapshot = {
  version: 1;
  questionText: {
    role: DynamicQuestionTemplateRole;
    value: string;
  };
  media: Array<{
    slotKey: MediaSlotKey;
    mediaType: QuestionMediaType;
    role: DynamicQuestionTemplateRole;
    fixedUrl?: string;
  }>;
  answers: Array<{
    sourceKey: string;
    fieldLabel?: string;
    isRequired?: boolean;
    isCorrect: boolean;
    role: DynamicQuestionTemplateRole;
    text: string;
    additionalInfo: string;
  }>;
  templateConfig: QuestionTemplateConfig;
};

export function getDynamicQuestionTemplateInitialStatus(isAdmin: boolean) {
  return isAdmin ? "ACTIVE" as const : "PENDING" as const;
}

function isRole(value: unknown): value is DynamicQuestionTemplateRole {
  return typeof value === "string" &&
    dynamicQuestionTemplateRoles.includes(value as DynamicQuestionTemplateRole);
}

function isMediaType(value: unknown): value is QuestionMediaType {
  return value === "IMAGE" || value === "AUDIO" || value === "VIDEO";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseDynamicQuestionTemplateSnapshot(
  value: unknown,
): DynamicQuestionTemplateSnapshot | null {
  if (!isRecord(value) || value.version !== 1 ||
    !isRecord(value.questionText) || !isRole(value.questionText.role) ||
    typeof value.questionText.value !== "string" ||
    !Array.isArray(value.media) || !Array.isArray(value.answers) ||
    !isRecord(value.templateConfig)) {
    return null;
  }

  const media: DynamicQuestionTemplateSnapshot["media"] = [];
  for (const item of value.media) {
    if (!isRecord(item) || !isMediaSlotKey(item.slotKey) ||
      !isMediaType(item.mediaType) || !isRole(item.role) ||
      (item.fixedUrl !== undefined && typeof item.fixedUrl !== "string") ||
      (item.role === "FIXED" && !item.fixedUrl) ||
      (item.role !== "FIXED" && item.fixedUrl !== undefined)) {
      return null;
    }
    media.push({
      slotKey: item.slotKey,
      mediaType: item.mediaType,
      role: item.role,
      ...(item.fixedUrl ? { fixedUrl: item.fixedUrl } : {}),
    });
  }

  const answers: DynamicQuestionTemplateSnapshot["answers"] = [];
  for (const item of value.answers) {
    if (!isRecord(item) || typeof item.sourceKey !== "string" ||
      !item.sourceKey || !isRole(item.role) ||
      typeof item.isCorrect !== "boolean" || typeof item.text !== "string" ||
      typeof item.additionalInfo !== "string" ||
      (item.fieldLabel !== undefined && typeof item.fieldLabel !== "string") ||
      (item.isRequired !== undefined && typeof item.isRequired !== "boolean")) {
      return null;
    }
    answers.push({
      sourceKey: item.sourceKey,
      role: item.role,
      isCorrect: item.isCorrect,
      text: item.text,
      additionalInfo: item.additionalInfo,
      ...(item.fieldLabel ? { fieldLabel: item.fieldLabel } : {}),
      ...(item.isRequired !== undefined ? { isRequired: item.isRequired } : {}),
    });
  }

  return {
    version: 1,
    questionText: {
      role: value.questionText.role,
      value: value.questionText.value,
    },
    media,
    answers,
    templateConfig: value.templateConfig as QuestionTemplateConfig,
  };
}

export function getDynamicTemplateAnswerSourceKey(
  answer: Pick<QuestionAnswerDraft, "answerId" | "answerFieldId" | "solutionId" | "id">,
) {
  if (answer.answerId) return `answer:${answer.answerId}`;
  if (answer.solutionId) return `solution:${answer.solutionId}`;
  if (answer.answerFieldId) return `field:${answer.answerFieldId}`;
  return `draft:${answer.id}`;
}

export function createDefaultDynamicTemplateRuleSelection(
  draft: QuestionEditorDraft,
): DynamicQuestionTemplateRuleSelection {
  return {
    questionText: "FIXED",
    media: draft.questionMedia
      .filter((medium) => medium.operation !== "REMOVE" && Boolean(medium.url))
      .map((medium) => ({
        sourceMediaId: medium.existingMediaId,
        slotKey: medium.slotKey,
        role: "REQUIRED_NEW" as const,
      })),
    answers: draft.answers.map((answer) => ({
      sourceKey: getDynamicTemplateAnswerSourceKey(answer),
      role: answer.isCorrect ? "REQUIRED_NEW" as const : "EXCLUDED" as const,
    })),
  };
}

export function resolveDynamicTemplateMediaRule(
  rules: DynamicQuestionTemplateRuleSelection,
  medium: Pick<QuestionMediaDraft, "existingMediaId" | "slotKey">,
) {
  const sourceMediaId = medium.existingMediaId;
  return rules.media.find((rule) =>
    sourceMediaId !== null
      ? rule.sourceMediaId === sourceMediaId
      : rule.sourceMediaId === null && rule.slotKey === medium.slotKey,
  ) ?? {
    sourceMediaId,
    slotKey: medium.slotKey,
    role: "REQUIRED_NEW" as const,
  };
}

export function remapDynamicTemplateRuleSelection(
  rules: DynamicQuestionTemplateRuleSelection,
  beforeSave: QuestionEditorDraft,
  afterSave: QuestionEditorDraft,
): PersistedDynamicQuestionTemplateRuleSelection {
  const beforeMediaBySlot = new Map(
    beforeSave.questionMedia.map((medium) => [medium.slotKey, medium]),
  );
  const beforeAnswersByClientId = new Map(
    beforeSave.answers.map((answer) => [answer.id, answer]),
  );

  return {
    questionText: rules.questionText,
    media: afterSave.questionMedia.flatMap((medium) => {
      if (medium.existingMediaId === null || medium.operation === "REMOVE") return [];
      const beforeMedium = beforeMediaBySlot.get(medium.slotKey);
      const previousRule = beforeMedium
        ? resolveDynamicTemplateMediaRule(rules, beforeMedium)
        : null;
      return [{
        sourceMediaId: medium.existingMediaId,
        slotKey: medium.slotKey,
        role: previousRule?.role ?? "REQUIRED_NEW",
      }];
    }),
    answers: afterSave.answers.map((answer) => {
      const beforeAnswer = beforeAnswersByClientId.get(answer.id);
      const previousRule = beforeAnswer
        ? resolveDynamicTemplateAnswerRule(rules, beforeAnswer)
        : null;
      return {
        sourceKey: getDynamicTemplateAnswerSourceKey(answer),
        role: previousRule?.role ?? (answer.isCorrect ? "REQUIRED_NEW" : "EXCLUDED"),
      };
    }),
  };
}

export function resolveDynamicTemplateAnswerRule(
  rules: DynamicQuestionTemplateRuleSelection,
  answer: QuestionAnswerDraft,
) {
  const sourceKey = getDynamicTemplateAnswerSourceKey(answer);
  return rules.answers.find((rule) => rule.sourceKey === sourceKey) ?? {
    sourceKey,
    role: answer.isCorrect ? "REQUIRED_NEW" as const : "EXCLUDED" as const,
  };
}

export function buildDynamicQuestionTemplate(
  input: {
    id: number;
    name: string;
    description: string | null;
    baseTemplate: QuestionTemplate;
    snapshot: DynamicQuestionTemplateSnapshot;
  },
): QuestionTemplate {
  const { baseTemplate, snapshot } = input;
  const mediaRules = new Map(snapshot.media.map((medium) => [medium.slotKey, medium]));
  const mediaSlots = baseTemplate.mediaSlots.flatMap((slot) => {
    const rule = mediaRules.get(slot.key);
    if (rule?.role === "EXCLUDED") return [];
    return [{
      ...slot,
      required: rule?.role === "FIXED" || rule?.role === "REQUIRED_NEW"
        ? true
        : slot.required,
    }];
  });
  for (const rule of snapshot.media) {
    if (rule.role === "EXCLUDED" || mediaSlots.some((slot) => slot.key === rule.slotKey)) continue;
    mediaSlots.push({
      key: rule.slotKey,
      allowedMediaType: rule.mediaType,
      required: true,
      label: rule.mediaType === "IMAGE" ? "Bild" : rule.mediaType === "AUDIO" ? "Audio" : "Video",
      manualUploadAllowed: true,
      generatorInput: false,
      generatorOutput: false,
    });
  }

  return {
    ...baseTemplate,
    id: `dynamic:${input.id}`,
    enabled: true,
    selectable: true,
    baseTemplateId: baseTemplate.id === "standard" ? null : baseTemplate.id,
    sourceTemplateId: input.id,
    name: input.name,
    description: input.description?.trim() || `Aus einer bestehenden Frage erstellte Vorlage auf Basis von ${baseTemplate.name}.`,
    defaultQuestionText:
      snapshot.questionText.role === "FIXED" ? snapshot.questionText.value : "",
    initialAnswers: snapshot.answers
      .filter((answer) => answer.role !== "EXCLUDED")
      .map((answer) => ({
        fieldLabel: answer.fieldLabel,
        isCorrect: answer.isCorrect,
        text: answer.role === "FIXED" ? answer.text : "",
        additionalInfo: answer.role === "FIXED" ? answer.additionalInfo : "",
      })),
    mediaSlots,
    initialQuestionMedia: snapshot.media.flatMap((medium) =>
      medium.role === "FIXED" && medium.fixedUrl
        ? [{
            slotKey: medium.slotKey,
            existingMediaId: null,
            url: medium.fixedUrl,
            mediaType: medium.mediaType,
            operation: "NEW" as const,
            existingMediaCount: 0,
          }]
        : []),
    initialTemplateConfig: structuredClone(snapshot.templateConfig),
  };
}

export function getDynamicTemplateRequirementIssue(
  snapshot: DynamicQuestionTemplateSnapshot,
  draft: {
    questionText: string;
    questionMedia: Array<Pick<QuestionMediaDraft, "slotKey" | "operation" | "url">>;
    answers: Array<Pick<QuestionAnswerDraft, "text">>;
  },
): "QUESTION_TEXT" | "MEDIA" | "ANSWER" | null {
  if (snapshot.questionText.role === "REQUIRED_NEW" && !draft.questionText.trim()) {
    return "QUESTION_TEXT";
  }
  if (snapshot.media.some((rule) =>
    (rule.role === "REQUIRED_NEW" || rule.role === "FIXED") &&
    !draft.questionMedia.some((medium) =>
      medium.slotKey === rule.slotKey && medium.operation !== "REMOVE" && Boolean(medium.url)))) {
    return "MEDIA";
  }
  const includedAnswers = snapshot.answers.filter((answer) => answer.role !== "EXCLUDED");
  if (includedAnswers.some((rule, index) =>
    rule.role === "REQUIRED_NEW" && !draft.answers[index]?.text.trim())) {
    return "ANSWER";
  }
  return null;
}
