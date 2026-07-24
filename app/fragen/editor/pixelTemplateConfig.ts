import type {
  FaceMorphPixelQuestionOptionKey,
  FaceMorphPixelQuestionOptions,
  QuestionTemplateConfig,
} from "./types";
import { questionTemplateIds } from "./templates/questionTemplateRegistry";
import { parseQuestionTemplateData } from "./templates/questionTemplateData";

export const PIXEL_STAGE_DURATION_MIN_SECONDS = 1;
export const PIXEL_STAGE_DURATION_MAX_SECONDS = 120;
export const DEFAULT_PIXEL_TEMPLATE_CONFIG: QuestionTemplateConfig = {
  stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 },
  createPixelQuestionByAnswer: { answer1: false, answer2: false },
};

export const DEFAULT_FACE_MORPH_PIXEL_QUESTION_OPTIONS: FaceMorphPixelQuestionOptions = {
  answer1: false,
  answer2: false,
};

export const NEW_FACE_MORPH_PIXEL_QUESTION_OPTIONS: FaceMorphPixelQuestionOptions = {
  answer1: true,
  answer2: true,
};

export function parseQuestionTemplateConfigDraft(
  value: unknown,
  templateId: string | null = null,
): QuestionTemplateConfig | null {
  if (value === undefined || value === null) {
    const templateData = parseQuestionTemplateData(
      undefined,
      templateId,
      false,
    );
    return templateData
      ? { ...DEFAULT_PIXEL_TEMPLATE_CONFIG, templateData }
      : DEFAULT_PIXEL_TEMPLATE_CONFIG;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  const durations = config.stageDurationsSeconds;
  const pixelQuestionOptions = config.createPixelQuestionByAnswer;
  const templateData = parseQuestionTemplateData(
    config.templateData,
    templateId,
    false,
  );
  if (templateData === null) return null;

  if (
    durations !== undefined &&
    (!durations || typeof durations !== "object" || Array.isArray(durations))
  ) {
    return null;
  }

  if (
    pixelQuestionOptions !== undefined &&
    (!pixelQuestionOptions ||
      typeof pixelQuestionOptions !== "object" ||
      Array.isArray(pixelQuestionOptions))
  ) {
    return null;
  }

  const parsedPixelQuestionOptions = pixelQuestionOptions as
    | Record<string, unknown>
    | undefined;
  const answer1 = parsedPixelQuestionOptions?.answer1 ?? false;
  const answer2 = parsedPixelQuestionOptions?.answer2 ?? false;

  if (typeof answer1 !== "boolean" || typeof answer2 !== "boolean") {
    return null;
  }

  if (
    templateId !== questionTemplateIds.faceMorph &&
    (answer1 || answer2)
  ) {
    return null;
  }

  if (durations === undefined) {
    return {
      ...DEFAULT_PIXEL_TEMPLATE_CONFIG,
      createPixelQuestionByAnswer: { answer1, answer2 },
      ...(templateData ? { templateData } : {}),
    };
  }

  const candidate = durations as Record<string, unknown>;
  const values = [candidate.stage3, candidate.stage2, candidate.stage1];
  if (!values.every((entry) => typeof entry === "number" && Number.isFinite(entry))) {
    return null;
  }
  return {
    stageDurationsSeconds: {
      stage3: Number(candidate.stage3),
      stage2: Number(candidate.stage2),
      stage1: Number(candidate.stage1),
    },
    createPixelQuestionByAnswer: { answer1, answer2 },
    ...(templateData ? { templateData } : {}),
  };
}

export function normalizeQuestionTemplateConfig(
  value: unknown,
  templateId: string | null = null,
): QuestionTemplateConfig | null {
  const draft = parseQuestionTemplateConfigDraft(value, templateId);
  if (!draft) return null;
  const values = Object.values(draft.stageDurationsSeconds);
  if (!values.every((entry) => Number.isInteger(entry) && entry >= PIXEL_STAGE_DURATION_MIN_SECONDS && entry <= PIXEL_STAGE_DURATION_MAX_SECONDS)) {
    return null;
  }
  const templateData = parseQuestionTemplateData(
    draft.templateData,
    templateId,
    true,
  );
  if (templateData === null) return null;
  return templateData ? { ...draft, templateData } : draft;
}

export function updateFaceMorphPixelQuestionOption(
  config: QuestionTemplateConfig,
  option: FaceMorphPixelQuestionOptionKey,
  checked: boolean,
): QuestionTemplateConfig {
  return {
    ...config,
    createPixelQuestionByAnswer: {
      ...config.createPixelQuestionByAnswer,
      [option]: checked,
    },
  };
}

export function withoutFaceMorphPixelQuestionOptions(
  config: QuestionTemplateConfig,
): QuestionTemplateConfig {
  return {
    ...config,
    createPixelQuestionByAnswer: {
      ...DEFAULT_FACE_MORPH_PIXEL_QUESTION_OPTIONS,
    },
  };
}

export function withFaceMorphPixelQuestionOptions(
  config: QuestionTemplateConfig,
  options: FaceMorphPixelQuestionOptions,
): QuestionTemplateConfig {
  return {
    ...config,
    createPixelQuestionByAnswer: { ...options },
  };
}

export function getFaceMorphPixelQuestionOptionsForTemplate(
  config: QuestionTemplateConfig,
  templateId: string | null,
): FaceMorphPixelQuestionOptions | undefined {
  return templateId === questionTemplateIds.faceMorph
    ? config.createPixelQuestionByAnswer
    : undefined;
}
