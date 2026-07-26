export type PresentationPlaybackCommand = "play" | "pause" | "stop" | null;

export type PresentationLiveState = {
  slideIndex: number;
  slideStartedAt: string | null;
  quizStartedAt: string | null;
  revealCount: number;
  mediaOverlayActive: boolean;
  playbackCommand: PresentationPlaybackCommand;
  playbackCommandId: number;
  countdownDurationSeconds: number | null;
  countdownStartedAt: string | null;
  countdownStatus: string;
  estimation: {
    phase: "HIDDEN" | "RUNNING" | "SOLUTION";
    questionId: number | null;
  };
  updatedAt: string | null;
};

type DateValue = Date | string | null | undefined;

export type StoredPresentationStatus = {
  slide_index: number;
  slide_started_at?: DateValue;
  quiz_started_at?: DateValue;
  endstand_reveal_count?: number | null;
  medium_overlay_aktiv?: boolean | null;
  audio_aktion?: string | null;
  audio_aktion_id?: number | null;
  countdown_dauer_sekunden?: number | null;
  countdown_started_at?: DateValue;
  countdown_status?: string | null;
  show_schaetzfrage?: boolean | null;
  zeige_schaetzantwort?: boolean | null;
  schaetzfrage_id?: number | null;
  updated_at?: DateValue;
};

function serializeDate(value: DateValue) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function normalizePlaybackCommand(
  value: string | null | undefined,
): PresentationPlaybackCommand {
  return value === "play" || value === "pause" || value === "stop"
    ? value
    : null;
}

export function resolvePresentationLiveState(
  status: StoredPresentationStatus | null,
): PresentationLiveState {
  if (!status) {
    return {
      slideIndex: 0,
      slideStartedAt: null,
      quizStartedAt: null,
      revealCount: 1,
      mediaOverlayActive: false,
      playbackCommand: null,
      playbackCommandId: 0,
      countdownDurationSeconds: null,
      countdownStartedAt: null,
      countdownStatus: "idle",
      estimation: { phase: "HIDDEN", questionId: null },
      updatedAt: null,
    };
  }

  return {
    slideIndex: Math.max(0, status.slide_index),
    slideStartedAt: serializeDate(status.slide_started_at),
    quizStartedAt: serializeDate(status.quiz_started_at),
    revealCount: Math.max(1, status.endstand_reveal_count ?? 1),
    mediaOverlayActive: status.medium_overlay_aktiv ?? false,
    playbackCommand: normalizePlaybackCommand(status.audio_aktion),
    playbackCommandId: status.audio_aktion_id ?? 0,
    countdownDurationSeconds: status.countdown_dauer_sekunden ?? null,
    countdownStartedAt: serializeDate(status.countdown_started_at),
    countdownStatus: status.countdown_status ?? "idle",
    estimation: {
      phase: !status.show_schaetzfrage
        ? "HIDDEN"
        : status.zeige_schaetzantwort
          ? "SOLUTION"
          : "RUNNING",
      questionId: status.schaetzfrage_id ?? null,
    },
    updatedAt: serializeDate(status.updated_at),
  };
}
