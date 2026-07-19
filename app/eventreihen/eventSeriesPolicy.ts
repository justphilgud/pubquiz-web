export const EVENT_SERIES_LIMITS = {
  name: 150,
  publicName: 150,
  description: 2000,
  internalNote: 2000,
} as const;

export type EventSeriesInput = {
  name: string;
  publicName?: string;
  description?: string;
  internalNote?: string;
  isPublic: boolean;
};

export type NormalizedEventSeriesInput = {
  name: string;
  publicName: string | null;
  description: string | null;
  internalNote: string | null;
  isPublic: boolean;
};

export type EventSeriesValidationResult =
  | { ok: true; value: NormalizedEventSeriesInput }
  | { ok: false; errors: Record<string, string> };

function optional(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function validateEventSeriesInput(
  input: EventSeriesInput,
): EventSeriesValidationResult {
  const value: NormalizedEventSeriesInput = {
    name: input.name.trim(),
    publicName: optional(input.publicName),
    description: optional(input.description),
    internalNote: optional(input.internalNote),
    isPublic: input.isPublic,
  };
  const errors: Record<string, string> = {};

  if (!value.name) errors.name = "Name ist erforderlich.";
  else if (value.name.length > EVENT_SERIES_LIMITS.name) {
    errors.name = `Name darf maximal ${EVENT_SERIES_LIMITS.name} Zeichen enthalten.`;
  }
  if ((value.publicName?.length ?? 0) > EVENT_SERIES_LIMITS.publicName) {
    errors.publicName = `Öffentlicher Name darf maximal ${EVENT_SERIES_LIMITS.publicName} Zeichen enthalten.`;
  }
  if ((value.description?.length ?? 0) > EVENT_SERIES_LIMITS.description) {
    errors.description = `Beschreibung darf maximal ${EVENT_SERIES_LIMITS.description} Zeichen enthalten.`;
  }
  if ((value.internalNote?.length ?? 0) > EVENT_SERIES_LIMITS.internalNote) {
    errors.internalNote = `Interne Bemerkung darf maximal ${EVENT_SERIES_LIMITS.internalNote} Zeichen enthalten.`;
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, value };
}

export function eventSeriesSlugBase(name: string) {
  return name
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "eventreihe";
}

export async function generateUniqueEventSeriesSlug(
  name: string,
  isTaken: (slug: string) => Promise<boolean>,
) {
  const base = eventSeriesSlugBase(name);
  let candidate = base;
  let suffix = 2;

  while (await isTaken(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function isEventSeriesSelectable(
  series: { id: number; isArchived: boolean },
  currentEventSeriesId?: number,
) {
  return !series.isArchived || series.id === currentEventSeriesId;
}

export function eventSeriesArchiveState(isArchived: boolean, now = new Date()) {
  return isArchived
    ? { ist_archiviert: true, archiviert_am: now }
    : { ist_archiviert: false, archiviert_am: null };
}
