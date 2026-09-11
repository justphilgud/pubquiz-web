import type { DraftEntry } from "./answerDraftController";

const MAX_AGE = 24 * 60 * 60 * 1000;
function isDraft(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (draft.antwortText === null || typeof draft.antwortText === "string") &&
    (draft.antwortId === null || Number.isSafeInteger(draft.antwortId)) &&
    (draft.antwortIds === undefined || Array.isArray(draft.antwortIds) && draft.antwortIds.every(Number.isSafeInteger)) &&
    !!draft.antwortfelder && typeof draft.antwortfelder === "object" &&
    Object.values(draft.antwortfelder).every(text => typeof text === "string");
}
export function readDraftJournal(raw: string | null, now = Date.now()): Record<number, DraftEntry> {
  if (!raw || raw.length > 1_000_000) return {};
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Number.isFinite(data.at) || now - data.at > MAX_AGE || data.at > now + 60000 || !data.entries) return {};
    return Object.fromEntries(Object.entries(data.entries).filter(([id, value]) => {
      const e = value as DraftEntry;
      return Number.isSafeInteger(Number(id)) && Number(id) > 0 && e &&
        Number.isSafeInteger(e.runId) && e.runId > 0 && Number.isSafeInteger(e.baseRevision) && e.baseRevision >= 0 &&
        Number.isSafeInteger(e.serverRevision) && e.serverRevision >= e.baseRevision &&
        Number.isSafeInteger(e.version) && e.version >= 0 && isDraft(e.value) && isDraft(e.serverValue);
    })) as Record<number, DraftEntry>;
  } catch { return {}; }
}

/** Separate records per mounted client: another tab never overwrites the local recovery copy. */
export function createDraftJournal(scope: string, storage: Storage, clientId: string) {
  const prefix = `quiz-unsaved-v1:${scope}:`;
  const key = `${prefix}${clientId}`;

  return {
    load() {
      const own = readDraftJournal(storage.getItem(key));
      if (Object.keys(own).length) return own;
      const records: { key: string; at: number; entries: Record<number, DraftEntry> }[] = [];
      for (let i = 0; i < storage.length; i++) {
        const candidate = storage.key(i);
        if (!candidate?.startsWith(prefix)) continue;
        const raw = storage.getItem(candidate);
        const entries = readDraftJournal(raw);
        if (Object.keys(entries).length) records.push({ key: candidate, at: JSON.parse(raw!).at, entries });
      }
      records.sort((a, b) => a.at - b.at);
      return Object.assign({}, ...records.map(record => record.entries)) as Record<number, DraftEntry>;
    },
    save(entries: Record<number, DraftEntry>) {
      if (Object.keys(entries).length) storage.setItem(key, JSON.stringify({ version: 1, at: Date.now(), entries }));
      else storage.removeItem(key);
    },
  };
}
