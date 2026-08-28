export const LIVE_POLL_TYPES = ["SINGLE_CHOICE", "FREE_TEXT"] as const;
export type LivePollType = (typeof LIVE_POLL_TYPES)[number];

export const LIVE_POLL_PUBLICATION_MODES = ["AUTOMATIC", "MODERATED"] as const;
export type LivePollPublicationMode = (typeof LIVE_POLL_PUBLICATION_MODES)[number];

export const LIVE_POLL_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type LivePollStatus = (typeof LIVE_POLL_STATUSES)[number];

export const LIVE_POLL_SCOPES = ["GLOBAL", "EVENT_SERIES", "QUIZ"] as const;
export type LivePollScope = (typeof LIVE_POLL_SCOPES)[number];

export type LivePollOption = { id: string; label: string };

export type LivePollRuntimeConfig = {
  version: 1;
  pollId: number;
  pollRevisionId: number;
  type: LivePollType;
  prompt: string;
  publicationMode: LivePollPublicationMode;
  options: LivePollOption[];
};

export type LivePollMutationInput = {
  type: unknown;
  prompt: unknown;
  publicationMode: unknown;
  options: unknown;
  moderatorNote?: unknown;
  status: unknown;
  scope: unknown;
  eventSeriesId?: unknown;
  quizId?: unknown;
};

export type ValidatedLivePollInput = {
  type: LivePollType;
  prompt: string;
  publicationMode: LivePollPublicationMode;
  options: LivePollOption[];
  moderatorNote: string | null;
  status: Exclude<LivePollStatus, "ARCHIVED">;
  scope: LivePollScope;
  eventSeriesId: number | null;
  quizId: number | null;
};

export type LivePollValidation =
  | { ok: true; value: ValidatedLivePollInput }
  | { ok: false; message: string };

function normalizeText(value: unknown, limit: number, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if ((required && !normalized) || normalized.length > limit) return null;
  return normalized;
}

function normalizeOptionalId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const id = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : Number.NaN;
}

export function isLivePollType(value: unknown): value is LivePollType {
  return typeof value === "string" && LIVE_POLL_TYPES.some((type) => type === value);
}

export function isLivePollPublicationMode(value: unknown): value is LivePollPublicationMode {
  return typeof value === "string" && LIVE_POLL_PUBLICATION_MODES.some((mode) => mode === value);
}

export function isLivePollStatus(value: unknown): value is LivePollStatus {
  return typeof value === "string" && LIVE_POLL_STATUSES.some((status) => status === value);
}

export function isLivePollScope(value: unknown): value is LivePollScope {
  return typeof value === "string" && LIVE_POLL_SCOPES.some((scope) => scope === value);
}

export function parseLivePollOptions(value: unknown): LivePollOption[] | null {
  if (!Array.isArray(value)) return null;
  const options: LivePollOption[] = [];
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const idValue = "id" in item ? item.id : `option-${index + 1}`;
    const labelValue = "label" in item ? item.label : null;
    const id = normalizeText(idValue, 64, true);
    const label = normalizeText(labelValue, 160, true);
    if (!id || !label || ids.has(id)) return null;
    ids.add(id);
    options.push({ id, label });
  }
  return options;
}

export function validateLivePollInput(input: LivePollMutationInput): LivePollValidation {
  if (!isLivePollType(input.type)) return { ok: false, message: "Der Umfragetyp ist ungültig." };
  if (!isLivePollPublicationMode(input.publicationMode)) {
    return { ok: false, message: "Der Veröffentlichungsmodus ist ungültig." };
  }
  if (!isLivePollStatus(input.status) || input.status === "ARCHIVED") {
    return { ok: false, message: "Der Umfragestatus ist ungültig." };
  }
  if (!isLivePollScope(input.scope)) return { ok: false, message: "Der Geltungsbereich ist ungültig." };

  const prompt = normalizeText(input.prompt, 300, true);
  const moderatorNote = normalizeText(input.moderatorNote, 2_000);
  if (!prompt || moderatorNote === null) return { ok: false, message: "Prompt oder Moderationsnotiz ist ungültig." };

  const parsedOptions = parseLivePollOptions(input.options);
  const options = input.type === "SINGLE_CHOICE" ? parsedOptions : [];
  if (input.type === "SINGLE_CHOICE" && (!options || options.length < 2 || options.length > 6)) {
    return { ok: false, message: "Eine Auswahl-Umfrage benötigt zwei bis sechs eindeutige Optionen." };
  }
  if (input.type === "FREE_TEXT" && input.publicationMode !== "AUTOMATIC" && input.publicationMode !== "MODERATED") {
    return { ok: false, message: "Der Veröffentlichungsmodus ist ungültig." };
  }

  const eventSeriesId = normalizeOptionalId(input.eventSeriesId);
  const quizId = normalizeOptionalId(input.quizId);
  if (Number.isNaN(eventSeriesId) || Number.isNaN(quizId)) {
    return { ok: false, message: "Eventreihe oder Quiz ist ungültig." };
  }
  if (
    (input.scope === "GLOBAL" && (eventSeriesId !== null || quizId !== null)) ||
    (input.scope === "EVENT_SERIES" && (eventSeriesId === null || quizId !== null)) ||
    (input.scope === "QUIZ" && (quizId === null || eventSeriesId !== null))
  ) {
    return { ok: false, message: "Der Geltungsbereich ist unvollständig oder widersprüchlich." };
  }

  return {
    ok: true,
    value: {
      type: input.type,
      prompt,
      publicationMode: input.publicationMode,
      options: options ?? [],
      moderatorNote: moderatorNote || null,
      status: input.status,
      scope: input.scope,
      eventSeriesId,
      quizId,
    },
  };
}

export function readLivePollRuntimeConfig(value: unknown): LivePollRuntimeConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const options = parseLivePollOptions(candidate.options);
  if (
    candidate.version !== 1 ||
    !Number.isSafeInteger(candidate.pollId) || Number(candidate.pollId) <= 0 ||
    !Number.isSafeInteger(candidate.pollRevisionId) || Number(candidate.pollRevisionId) <= 0 ||
    !isLivePollType(candidate.type) ||
    typeof candidate.prompt !== "string" || !candidate.prompt.trim() || candidate.prompt.length > 300 ||
    !isLivePollPublicationMode(candidate.publicationMode) ||
    !options ||
    (candidate.type === "SINGLE_CHOICE" && (options.length < 2 || options.length > 6)) ||
    (candidate.type === "FREE_TEXT" && options.length !== 0)
  ) return null;
  return {
    version: 1,
    pollId: Number(candidate.pollId),
    pollRevisionId: Number(candidate.pollRevisionId),
    type: candidate.type,
    prompt: candidate.prompt.trim(),
    publicationMode: candidate.publicationMode,
    options,
  };
}

export function getLivePollTypeLabel(type: LivePollType) {
  return type === "SINGLE_CHOICE" ? "Auswahl-Umfrage" : "Freitext-Umfrage";
}
