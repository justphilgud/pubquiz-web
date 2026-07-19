import type { QuestionTemplateConfig } from "./types";

export const PIXEL_STAGE_DURATION_MIN_SECONDS = 1;
export const PIXEL_STAGE_DURATION_MAX_SECONDS = 120;
export const DEFAULT_PIXEL_TEMPLATE_CONFIG: QuestionTemplateConfig = {
  stageDurationsSeconds: { stage3: 20, stage2: 20, stage1: 20 },
};

export function parseQuestionTemplateConfigDraft(value: unknown): QuestionTemplateConfig | null {
  if (value === undefined || value === null) return DEFAULT_PIXEL_TEMPLATE_CONFIG;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const durations = (value as Record<string, unknown>).stageDurationsSeconds;
  if (!durations || typeof durations !== "object" || Array.isArray(durations)) return null;
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
  };
}

export function normalizeQuestionTemplateConfig(value: unknown): QuestionTemplateConfig | null {
  const draft = parseQuestionTemplateConfigDraft(value);
  if (!draft) return null;
  const values = Object.values(draft.stageDurationsSeconds);
  if (!values.every((entry) => Number.isInteger(entry) && entry >= PIXEL_STAGE_DURATION_MIN_SECONDS && entry <= PIXEL_STAGE_DURATION_MAX_SECONDS)) {
    return null;
  }
  return draft;
}
