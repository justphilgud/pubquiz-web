import { hasAnswerContentChanged } from "../evaluation/answerContent";

export type PixelAnswerStage = 1 | 2 | 3;
export type PixelStageHistory = {
  snapshots: { stage: PixelAnswerStage; text: string | null; at: string }[];
  relevantStage: PixelAnswerStage | null;
};

export function readPixelStageHistory(value: unknown): PixelStageHistory {
  if (!value || typeof value !== "object" || !("snapshots" in value) || !Array.isArray(value.snapshots)) {
    return { snapshots: [], relevantStage: null };
  }
  const snapshots = value.snapshots.filter((entry): entry is PixelStageHistory["snapshots"][number] =>
    entry && typeof entry === "object" && [1, 2, 3].includes(entry.stage) &&
    (entry.text === null || typeof entry.text === "string") && typeof entry.at === "string");
  const relevantStage = "relevantStage" in value && (value.relevantStage === 1 || value.relevantStage === 2 || value.relevantStage === 3)
    ? value.relevantStage : null;
  return { snapshots, relevantStage };
}

/** Called only under the run lock, before a later-stage draft can overwrite this text. */
export function snapshotPixelStage(history: PixelStageHistory, stage: PixelAnswerStage, text: string | null, at: string): PixelStageHistory {
  if (history.snapshots.some((snapshot) => snapshot.stage === stage)) return history;
  const normalizedText = text?.trim() ? text : null;
  const previous = history.snapshots.at(-1)?.text ?? null;
  const content = (answerText: string | null) => ({ answerText, selectedAnswerIds: [], structuredAnswers: [] });
  return {
    snapshots: [...history.snapshots, { stage, text: normalizedText, at }],
    relevantStage: normalizedText === null ? null
      : history.relevantStage === null || hasAnswerContentChanged(content(previous), content(normalizedText))
        ? stage : history.relevantStage,
  };
}
