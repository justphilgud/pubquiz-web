import { sameDraft, type DraftEntry } from "./answerDraftController";

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

/** Separate records per mounted client; unconfirmed content in another tab stays protected. */
export function createDraftJournal(scope: string, storage: Storage, clientId: string, tabStorage?: Storage) {
  const prefix = `quiz-unsaved-v1:${scope}:`;
  const key = `${prefix}${clientId}`;
  const ignoredKey = `quiz-dismissed-recovery:${scope}`;
  let priorIgnored: unknown = [];
  try { priorIgnored = JSON.parse(tabStorage?.getItem(ignoredKey) ?? "[]"); } catch { /* Ignore corrupt receipts, never answer content. */ }
  const ignored = new Set<string>(Array.isArray(priorIgnored) ? priorIgnored.filter(value => typeof value === "string").slice(-200) : []);
  let sources: { key: string; raw: string; at: number; entries: Record<number, DraftEntry> }[] = [];
  const receipt = (source: { key: string; at: number }, id: string) => `${source.key}:${source.at}:${id}`;
  return {
    load() {
      sources = [];
      for (let i = 0; i < storage.length; i++) {
        const candidate = storage.key(i);
        if (!candidate?.startsWith(prefix)) continue;
        const raw = storage.getItem(candidate);
        const entries = readDraftJournal(raw);
        if (Object.keys(entries).length) {
          const source = { key: candidate, raw: raw!, at: JSON.parse(raw!).at, entries };
          source.entries = Object.fromEntries(Object.entries(entries).filter(([id]) => !ignored.has(receipt(source, id))));
          sources.push(source);
        }
      }
      sources.sort((a, b) => a.at - b.at);
      return Object.assign({}, ...sources.map(source => source.entries)) as Record<number, DraftEntry>;
    },
    save(entries: Record<number, DraftEntry>) {
      const pending = Object.fromEntries(Object.entries(entries).filter(([, entry]) => entry.status !== "saved"));
      if (Object.keys(pending).length) storage.setItem(key, JSON.stringify({ version: 1, at: Date.now(), entries: pending }));
      else storage.removeItem(key);
      for (const source of sources) {
        // Never modify a record another client has changed since recovery.
        if (storage.getItem(source.key) !== source.raw) continue;
        const remaining = readDraftJournal(source.raw);
        for (const [id, recovered] of Object.entries(source.entries)) {
          const current = entries[Number(id)];
          if (current?.status !== "saved" || current.runId !== recovered.runId) continue;
          if (sameDraft(current.serverValue, recovered.value)) {
            // This exact backup is now confirmed on the server. It is safe to retire.
            delete remaining[Number(id)];
          } else {
            // A deliberate different choice is remembered only by this tab. Another
            // active tab keeps its own unconfirmed copy and may still resolve it.
            ignored.add(receipt(source, id));
          }
        }
        const nextRaw = JSON.stringify({ version: 1, at: source.at, entries: remaining });
        if (Object.keys(remaining).length) storage.setItem(source.key, nextRaw);
        else storage.removeItem(source.key);
        source.raw = nextRaw;
      }
      tabStorage?.setItem(ignoredKey, JSON.stringify([...ignored].slice(-200)));
    },
  };
}
