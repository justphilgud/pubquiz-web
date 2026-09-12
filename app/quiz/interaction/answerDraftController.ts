import type { TeamAnswerDraft } from "../[quizId]/antworten/GenericAnswerRenderer";

export type DraftSaveResult = { success: true; draftRevision: number; confirmedValue?: TeamAnswerDraft } | {
  success: false; reason: "LIVE_STATE_CHANGED" | "REVISION_CONFLICT" | "FINALIZED";
  currentDraftRevision?: number; currentValue?: TeamAnswerDraft;
};
export type DraftEntry = {
  runId: number;
  value: TeamAnswerDraft;
  serverValue: TeamAnswerDraft;
  baseRevision: number;
  serverRevision: number;
  version: number;
  writable: boolean;
  status: "saved" | "dirty" | "saving" | "error" | "conflict" | "recovered" | "closed";
  failures: number;
};
type Attempt = { runId: number; version: number; value: TeamAnswerDraft; revision: number };
type Dependencies = {
  save: (questionId: number, runId: number, revision: number, value: TeamAnswerDraft) => Promise<DraftSaveResult>;
  persist: (journal: Record<number, DraftEntry>) => void;
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> | number;
  cancel: (timer: ReturnType<typeof setTimeout> | number) => void;
};
export const EMPTY_TEAM_DRAFT: TeamAnswerDraft = { antwortText: null, antwortId: null, antwortfelder: {} };

// Compare the actual transmitted content, not a display label or a local counter.
export function sameDraft(a: TeamAnswerDraft, b: TeamAnswerDraft) {
  return (a.antwortText ?? "") === (b.antwortText ?? "") &&
    JSON.stringify([...(a.antwortIds ?? (a.antwortId === null ? [] : [a.antwortId]))].sort()) ===
      JSON.stringify([...(b.antwortIds ?? (b.antwortId === null ? [] : [b.antwortId]))].sort()) &&
    JSON.stringify(Object.entries(a.antwortfelder).filter(([, text]) => text.trim()).sort()) ===
      JSON.stringify(Object.entries(b.antwortfelder).filter(([, text]) => text.trim()).sort());
}

/** Client orchestration only. The existing interaction service authorizes every write. */
export class AnswerDraftController {
  private entries: Record<number, DraftEntry> = {};
  private listeners = new Set<() => void>();
  private timers = new Map<number, ReturnType<typeof setTimeout> | number>();
  private pending = new Map<number, Promise<boolean>>();
  private attempts = new Map<number, Attempt>();
  private disposed = false;
  constructor(private dependencies: Dependencies) {}
  activate() { this.disposed = false; }
  getSnapshot = () => this.entries;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  journal() { return Object.fromEntries(Object.entries(this.entries).filter(([, e]) => e.status !== "saved")); }
  private put(id: number, entry: DraftEntry) {
    if (this.disposed) return;
    this.entries = { ...this.entries, [id]: entry };
    this.dependencies.persist(this.entries);
    this.listeners.forEach(listener => listener());
  }
  private clearTimer(id: number) {
    const timer = this.timers.get(id);
    if (timer !== undefined) this.dependencies.cancel(timer);
    this.timers.delete(id);
  }
  private enqueue(id: number, delay = 1200) {
    this.clearTimer(id);
    const entry = this.entries[id];
    if (this.disposed || !entry?.writable || !["dirty", "error"].includes(entry.status) || this.pending.has(id)) return;
    this.timers.set(id, this.dependencies.schedule(() => { void this.flush(id); }, delay));
  }
  restore(journal: Record<number, DraftEntry>) {
    // Restored content is never auto-submitted. A fresh authorized snapshot must arrive first.
    for (const [id, entry] of Object.entries(journal)) {
      this.entries = { ...this.entries, [Number(id)]: { ...entry, writable: false, status: "recovered", failures: 0 } };
    }
    this.dependencies.persist(this.entries);
    this.listeners.forEach(listener => listener());
  }
  hydrate(id: number, runId: number, value: TeamAnswerDraft, revision: number, writable: boolean) {
    const current = this.entries[id];
    if (!current || current.runId !== runId) {
      this.clearTimer(id);
      this.attempts.delete(id);
      this.put(id, { runId, value, serverValue: value, baseRevision: revision, serverRevision: revision, version: 0, writable, status: "saved", failures: 0 });
      return;
    }
    if (revision < current.serverRevision) return;
    const attempt = this.attempts.get(id);
    const ownAccepted = attempt?.runId === runId && revision > attempt.revision && sameDraft(value, attempt.value);
    const matching = sameDraft(current.value, value);
    const clean = current.status === "saved";
    let next: DraftEntry = { ...current, serverValue: value, serverRevision: revision, writable };
    if (clean || matching) {
      next = { ...next, value, baseRevision: revision, status: "saved", failures: 0 };
    } else if (!writable) {
      next.status = "closed";
    } else if (ownAccepted) {
      next.baseRevision = revision;
      next.status = "dirty";
    } else if (revision > current.baseRevision) {
      // NEVER advance the base of a local edit with another device's content.
      next.status = "conflict";
    } else if (current.status === "closed") {
      next.status = "recovered";
    }
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    this.put(id, next);
    if (next.status === "dirty" && current.status !== "dirty") this.enqueue(id);
  }
  edit(id: number, value: TeamAnswerDraft) {
    const current = this.entries[id];
    if (!current || !current.writable) return;
    const blocked = ["conflict", "recovered"].includes(current.status);
    this.put(id, { ...current, value, version: current.version + 1,
      status: blocked ? current.status : "dirty", failures: 0 });
    this.enqueue(id);
  }
  resolve(id: number, choice: "server" | "local") {
    const current = this.entries[id];
    if (!current) return;
    if (choice === "local" && !current.writable) return;
    this.put(id, { ...current, value: choice === "server" ? current.serverValue : current.value,
      baseRevision: current.serverRevision, version: current.version + 1, failures: 0,
      status: choice === "server" ? "saved" : "dirty" });
    this.enqueue(id);
  }
  async retry(id: number) {
    const current = this.entries[id];
    if (current?.status === "error") this.put(id, { ...current, failures: 0, status: "dirty" });
    return this.flush(id);
  }
  flush(id: number): Promise<boolean> {
    this.clearTimer(id);
    const existing = this.pending.get(id);
    if (existing) return existing.then(() => this.entries[id]?.status === "saved");
    const entry = this.entries[id];
    if (!entry || !entry.writable || !["saved", "dirty", "error"].includes(entry.status)) return Promise.resolve(false);
    if (entry.status === "saved") return Promise.resolve(true);
    const attempt = { runId: entry.runId, version: entry.version, value: entry.value, revision: entry.baseRevision };
    this.attempts.set(id, attempt);
    this.put(id, { ...entry, status: "saving" });
    const request = this.execute(id, attempt);
    this.pending.set(id, request);
    return request;
  }
  private async execute(id: number, attempt: Attempt): Promise<boolean> {
    try {
      const result = await this.dependencies.save(id, attempt.runId, attempt.revision, attempt.value);
      const current = this.entries[id];
      if (this.disposed || current?.runId !== attempt.runId) return false;
      if (result.success) {
        if (result.draftRevision < current.serverRevision) return false;
        const unchanged = current.version === attempt.version && sameDraft(current.value, attempt.value);
        this.put(id, { ...current, baseRevision: result.draftRevision, serverRevision: result.draftRevision,
          serverValue: result.confirmedValue ?? attempt.value, value: unchanged ? result.confirmedValue ?? attempt.value : current.value, failures: 0,
          status: unchanged ? "saved" : current.writable ? "dirty" : "closed" });
        return unchanged;
      }
      // A snapshot can confirm the content while an older retry is still in flight.
      if (current.status === "saved") return true;
      const server = result.reason === "REVISION_CONFLICT" && result.currentValue &&
        result.currentDraftRevision !== undefined && result.currentDraftRevision >= current.serverRevision
        ? { serverValue: result.currentValue, serverRevision: result.currentDraftRevision } : {};
      this.put(id, { ...current, ...server, status: result.reason === "REVISION_CONFLICT" ? "conflict" : "closed",
        writable: result.reason === "REVISION_CONFLICT" && current.writable });
    } catch {
      const current = this.entries[id];
      if (current?.runId === attempt.runId && !["saved", "conflict", "closed"].includes(current.status)) {
        this.put(id, { ...current, status: "error", failures: current.failures + 1 });
      }
    } finally {
      this.pending.delete(id);
      const current = this.entries[id];
      if (current?.status === "dirty") this.enqueue(id);
      if (current?.status === "error" && current.failures <= 3) this.enqueue(id, [2000, 5000, 10000][current.failures - 1]);
    }
    return false;
  }
  pauseMissing(visible: ReadonlySet<number>) {
    for (const [id, entry] of Object.entries(this.entries)) {
      if (!visible.has(Number(id)) && (entry.writable || entry.status === "recovered")) {
        this.clearTimer(Number(id));
        this.put(Number(id), { ...entry, writable: false, status: entry.status === "saved" ? "saved" : "closed" });
      }
    }
  }
  reconcileMissing(visible: ReadonlySet<number>, confirmations: readonly {
    questionId: number; runId: number; revision: number; value: TeamAnswerDraft;
  }[]) {
    this.pauseMissing(visible);
    for (const confirmation of confirmations) {
      const current = this.entries[confirmation.questionId];
      if (!visible.has(confirmation.questionId) && current?.runId === confirmation.runId) {
        this.hydrate(confirmation.questionId, confirmation.runId, confirmation.value, confirmation.revision, false);
      }
    }
  }
  dispose() {
    this.disposed = true;
    this.timers.forEach(timer => this.dependencies.cancel(timer));
    this.timers.clear();
    this.listeners.clear();
  }
}
