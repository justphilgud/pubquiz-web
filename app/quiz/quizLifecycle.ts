export type QuizLifecycle = "PREPARATION" | "RUNNING" | "STOPPED";

export function resolveQuizLifecycle(status: {
  quiz_started_at?: Date | string | null;
  quiz_stopped_at?: Date | string | null;
} | null): QuizLifecycle {
  if (status?.quiz_stopped_at) return "STOPPED";
  return status?.quiz_started_at ? "RUNNING" : "PREPARATION";
}

export const QUIZ_LIFECYCLE_LABELS: Record<QuizLifecycle, string> = {
  PREPARATION: "Vorbereitung",
  RUNNING: "Laufend",
  STOPPED: "Beendet",
};

export function assertLifecycleRevision(actual: number, expected: number) {
  if (!Number.isSafeInteger(expected) || actual !== expected) {
    throw new Error("Der Quizdurchlauf hat sich geändert. Bitte den aktuellen Status laden.");
  }
}
