export type PresentationPlaybackCommand = "play" | "pause" | "stop" | null;

export type PresentationLiveState = {
  slideIndex: number;
  slideKey: string | null;
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

export type PresentationQuestionIdentity = {
  questionAssignmentId: number;
  questionId: number;
  sectionId: number | null;
};

export type PresentationSlideIdentity =
  | {
      kind: "LIVE_POLL";
      placementId: number;
    }
  | {
      kind: "QUESTION";
      phase: "QUESTION" | "FUNNY" | "SOLUTION";
      questionAssignmentId: number;
    }
  | {
      kind: "NON_QUESTION";
      slideType: string;
      statusText: string;
    }
  | { kind: "UNKNOWN" };

export type PresentationAudienceState =
  | ({
      kind: "QUESTION";
      phase: "QUESTION" | "FUNNY" | "SOLUTION";
      slideKey: string;
    } & PresentationQuestionIdentity)
  | {
      kind: "NON_QUESTION";
      phase: "NON_QUESTION";
      slideKey: string;
      slideType: string;
      statusText: string;
    }
  | {
      kind: "LEGACY";
      phase: "LEGACY";
      slideKey: null;
    }
  | {
      kind: "UNKNOWN";
      phase: "UNKNOWN";
      slideKey: string;
      statusText: string;
    };

type DateValue = Date | string | null | undefined;

export type StoredPresentationStatus = {
  slide_index: number;
  slide_key?: string | null;
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

const NON_QUESTION_STATUS_BY_TYPE: Readonly<Record<string, string>> = {
  WAITING: "Das Quiz startet gleich",
  START_SEQUENCE: "Das Quiz startet gleich",
  WELCOME: "Das Quiz startet gleich",
  PRIZES: "Das Quiz startet gleich",
  QR_CODE: "Das Quiz startet gleich",
  RULES: "Das Quiz startet gleich",
  ROUND_INTRO: "Die nächste Runde beginnt gleich",
  BREAK: "Pause",
  COUNTDOWN: "Pause",
  INTERMEDIATE_STANDINGS: "Der Zwischenstand wird gezeigt",
  FINAL_STANDINGS: "Das Quiz ist beendet",
  WINNER: "Das Quiz ist beendet",
  YEARLY_STANDINGS: "Das Quiz ist beendet",
  CUSTOM_MESSAGE: "Das Quiz startet gleich",
  QUESTION_SUBMISSION_QR: "Das Quiz ist beendet",
  CALENDAR_SUBSCRIPTION: "Das Quiz ist beendet",
  CLOSING: "Das Quiz ist beendet",
  "vor-dem-start": "Das Quiz startet gleich",
  startsequenz: "Das Quiz startet gleich",
  begruessung: "Das Quiz startet gleich",
  preise: "Das Quiz startet gleich",
  regeln: "Das Quiz startet gleich",
  qrcode: "Das Quiz startet gleich",
  bekanntmachungen: "Das Quiz ist beendet",
  intro: "Die nächste Runde beginnt gleich",
  break: "Pause",
  standings: "Der Zwischenstand wird gezeigt",
  final: "Das Quiz ist beendet",
  BLOCK_ITEM: "Bitte folgt der Präsentation",
  LIVE_POLL: "Die Umfrage läuft",
};

function parsePositiveInteger(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parsePresentationSlideKey(
  slideKey: string | null | undefined,
): PresentationSlideIdentity | null {
  if (!slideKey) return null;

  const parts = slideKey.split(":");
  if (parts[0] === "question" && parts.length === 3) {
    const questionAssignmentId = parsePositiveInteger(parts[1]);
    const phase = parts[2] === "question"
      ? "QUESTION"
      : parts[2] === "funny"
        ? "FUNNY"
        : parts[2] === "solution"
          ? "SOLUTION"
          : null;
    return questionAssignmentId && phase
      ? { kind: "QUESTION", phase, questionAssignmentId }
      : { kind: "UNKNOWN" };
  }

  if (
    parts[0] === "poll-placement" &&
    parts.length === 2
  ) {
    const placementId = parsePositiveInteger(parts[1]);
    return placementId ? { kind: "LIVE_POLL", placementId } : { kind: "UNKNOWN" };
  }

  if (
    parts[0] === "block-item" &&
    parts.length === 2 &&
    parsePositiveInteger(parts[1])
  ) {
    return {
      kind: "NON_QUESTION",
      slideType: "BLOCK_ITEM",
      statusText: NON_QUESTION_STATUS_BY_TYPE.BLOCK_ITEM,
    };
  }

  if (
    parts[0] === "story-placement" &&
    parts.length === 2 &&
    parsePositiveInteger(parts[1])
  ) {
    return {
      kind: "NON_QUESTION",
      slideType: "STORY_ELEMENT",
      statusText: "Bitte folgt der Präsentation",
    };
  }

  const type = parts.at(-1) ?? "";
  const statusText = NON_QUESTION_STATUS_BY_TYPE[type];
  if (
    statusText &&
    ["flow", "default", "fixed", "section"].includes(parts[0] ?? "")
  ) {
    return { kind: "NON_QUESTION", slideType: type, statusText };
  }

  return { kind: "UNKNOWN" };
}

export function resolvePresentationAudienceState(
  liveState: Pick<PresentationLiveState, "slideKey">,
  questions: readonly PresentationQuestionIdentity[],
): PresentationAudienceState {
  if (!liveState.slideKey) {
    return { kind: "LEGACY", phase: "LEGACY", slideKey: null };
  }

  const identity = parsePresentationSlideKey(liveState.slideKey);
  if (identity?.kind === "QUESTION") {
    const question = questions.find(
      (entry) =>
        entry.questionAssignmentId === identity.questionAssignmentId,
    );
    if (question) {
      return {
        kind: "QUESTION",
        phase: identity.phase,
        slideKey: liveState.slideKey,
        ...question,
      };
    }
  }

  if (identity?.kind === "NON_QUESTION") {
    return {
      kind: "NON_QUESTION",
      phase: "NON_QUESTION",
      slideKey: liveState.slideKey,
      slideType: identity.slideType,
      statusText: identity.statusText,
    };
  }

  if (identity?.kind === "LIVE_POLL") {
    return {
      kind: "NON_QUESTION",
      phase: "NON_QUESTION",
      slideKey: liveState.slideKey,
      slideType: "LIVE_POLL",
      statusText: NON_QUESTION_STATUS_BY_TYPE.LIVE_POLL,
    };
  }

  return {
    kind: "UNKNOWN",
    phase: "UNKNOWN",
    slideKey: liveState.slideKey,
    statusText: "Der aktuelle Quizstatus konnte nicht sicher zugeordnet werden",
  };
}

export function resolvePresentationSequenceIndex(
  liveState: Pick<PresentationLiveState, "slideIndex" | "slideKey">,
  slideKeys: readonly string[],
) {
  if (liveState.slideKey) {
    const keyedIndex = slideKeys.indexOf(liveState.slideKey);
    return {
      index: keyedIndex,
      resolution: keyedIndex >= 0 ? "SLIDE_KEY" : "UNRESOLVED",
    } as const;
  }

  if (slideKeys.length === 0) {
    return { index: -1, resolution: "UNRESOLVED" } as const;
  }

  return {
    index: Math.min(Math.max(liveState.slideIndex, 0), slideKeys.length - 1),
    resolution: "LEGACY_INDEX",
  } as const;
}

export function resolvePresentationLiveState(
  status: StoredPresentationStatus | null,
): PresentationLiveState {
  if (!status) {
    return {
      slideIndex: 0,
      slideKey: null,
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
    slideKey: status.slide_key ?? null,
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
