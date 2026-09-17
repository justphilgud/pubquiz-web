export const REFRESH_MS = 30_000;
export const STALE_MS = 2 * REFRESH_MS;
// Conservative V1 starting threshold from AP9.5 analysis, not a measured SLO.
export const DB_WARNING_MS = 500;
export type Severity = "green" | "yellow" | "red";
export type Area = "application" | "database" | "live" | "answers" | "backup" | "deployment";
export type Card = { area: Area; title: string; severity: Severity; summary: string; detail: string };
export type LiveQuiz = {
  id: number; name: string; slide: number; registeredTeams: number;
  stateChangedAt: string; phase: string; savedAnswers: number | null;
  lastDraftAt: string | null;
};
export type BackupEvidence = {
  snapshotAt: string; checkedAt: string; durationSeconds: number;
  integrity: boolean; restore: "validated-browser-open" | "accepted";
  source: string;
};
export type Snapshot = {
  checkedAt: string; environment: "production" | "preview" | "development" | "unknown";
  release: string | null; db: { ok: boolean; latencyMs: number | null; lastSuccessAt: string | null };
  live: LiveQuiz[] | null; truncated: boolean; backup: BackupEvidence | null;
  collectionMs: number; readQueries: number; simulation: string | null;
};
export function aggregate(cards: readonly Pick<Card, "severity">[]): Severity {
  return cards.some(c => c.severity === "red") ? "red" : cards.some(c => c.severity === "yellow") ? "yellow" : "green";
}
export const STATUS_LABELS = { green: "System betriebsbereit", yellow: "Auffälligkeiten", red: "Handlungsbedarf" };
export function cardsFor(snapshot: Snapshot, now: number): Card[] {
  const stale = now - Date.parse(snapshot.checkedAt) > STALE_MS;
  const goodConfig = snapshot.environment !== "unknown";
  return [
    { area: "application", title: "Anwendung", severity: !goodConfig ? "red" : stale ? "yellow" : "green",
      summary: !goodConfig ? "Umgebung nicht bestätigt" : stale ? "Prüfung veraltet" : "Monitoring erreichbar",
      detail: "Geschützter Healthread erfolgreich beantwortet. Kein unabhängiger Außencheck; zentrale Serverfehlerstatistik nicht verfügbar." },
    { area: "database", title: "Datenbank", severity: !snapshot.db.ok ? "red" : stale || (snapshot.db.latencyMs ?? Infinity) >= DB_WARNING_MS ? "yellow" : "green",
      summary: snapshot.db.ok ? `Erreichbar · SELECT 1: ${snapshot.db.latencyMs} ms` : "Leseprüfung fehlgeschlagen",
      detail: "Ausschließlich lesende Transaktion. Ab 500 ms Warnung: vorläufiger, in der Generalprobe zu kalibrierender Wert. Bei Fehler auch Pool/Netz/Timeout prüfen; kein Beweis eines Datenbankausfalls." },
    { area: "live", title: "Live-Quiz", severity: snapshot.live === null || stale || snapshot.truncated ? "yellow" : "green",
      summary: snapshot.live === null ? "Live-Daten nicht verfügbar" : !snapshot.live.length ? "Kein Quiz aktiv" : `${snapshot.live.length}${snapshot.truncated ? "+" : ""} laufende Quizze`,
      detail: "Lifecycle RUNNING, höchstens sechs Quizze. Registrierte Teams sind keine aktiven Clients. Statuszeit ist der letzte Zustandswechsel, kein Heartbeat." },
    { area: "answers", title: "Antworten", severity: "yellow",
      summary: "Save-Zuverlässigkeit noch nicht messbar",
      detail: "Gespeicherte Antwortdatensätze und Draft-Zeit stammen nur aus dem aktuellen Antwortlauf. Versuche, Fehler, Erfolgsquote, Save-Latenz und Retries sind nicht zentral erfasst. Kein Save ohne Bestätigung wird als verloren gewertet. Client-/Präsentationsfrische ist unbekannt." },
    { area: "backup", title: "Backup", severity: "yellow",
      summary: snapshot.backup ? "Dokumentierter AP9.4-Nachweis" : "Kein Backupnachweis verfügbar",
      detail: snapshot.backup ? "Historischer Production-Nachweis, kein automatischer Operationsabruf. Ein neuerer Lauf oder Fehler ist hier nicht erkennbar. Keine Aussage zur heutigen Eventfreigabe." : "Die Quelle fehlt. Das bedeutet nicht, dass kein Backup existiert." },
    { area: "deployment", title: "Deployment", severity: !goodConfig ? "red" : !snapshot.release ? "yellow" : "green",
      summary: `${snapshot.environment} · ${snapshot.release?.slice(0, 12) ?? "Release unbekannt"}`,
      detail: "Umgebung und Commit dieser laufenden Instanz. Kein Provider-READY-/CI-Status und keine Aussage über andere Deployments." },
  ];
}
export function safeRelease(value: string | undefined): string | null {
  return value && /^[a-f0-9]{40}$/i.test(value) ? value : null;
}

// Browser history tracks monitor observations, never alleged answer failures.
export type Observation = { at: string; severity: Severity; source: string };
export function recordObservation(history: Observation[], next: Observation): Observation[] {
  if (history[0]?.severity === next.severity && history[0]?.source === next.source) return history;
  return [next, ...history].slice(0, 20);
}
